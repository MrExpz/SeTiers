import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import {
  getGamemodes,
  getGamemodeBySlug,
  getLeaderboard,
  getPlayerByName,
  getPlayerGamemodes,
  getTierHistory,
  getDb,
} from "./db";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  leaderboard: router({
    getGamemodes: publicProcedure.query(async () => {
      return await getGamemodes();
    }),

    getByGamemode: publicProcedure
      .input(z.object({ gamemodeSlug: z.string(), includeRetired: z.boolean().default(false) }))
      .query(async ({ input }) => {
        const gamemode = await getGamemodeBySlug(input.gamemodeSlug);
        if (!gamemode) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Gamemode not found" });
        }
        return await getLeaderboard(gamemode.id, 100, input.includeRetired ? true : false, true);
      }),

    getPlayerProfile: publicProcedure
      .input(z.object({ playerId: z.number() }))
      .query(async ({ input }) => {
        const playerGms = await getPlayerGamemodes(input.playerId);
        const history = await getTierHistory(input.playerId);
        return { gamemodes: playerGms, history };
      }),

    getPlayerDetails: publicProcedure
      .input(z.object({ playerId: z.number() }))
      .query(async ({ input }) => {
        const { players } = await import("../drizzle/schema");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        const result = await db.select().from(players).where(eq(players.id, input.playerId)).limit(1);
        if (!result.length) throw new TRPCError({ code: "NOT_FOUND" });
        
        const player = result[0];
        const playerGms = await getPlayerGamemodes(input.playerId);
        
        return {
          id: player.id,
          name: player.name,
          uuid: player.uuid,
          isRetired: player.isRetired,
          gamemodes: playerGms,
          position: 1,
          gamemodeDisplay: playerGms[0]?.gamemode.name || "Leaderboard",
        };
      }),
  }),

  admin: router({
    login: publicProcedure
      .input(z.object({ username: z.string(), password: z.string() }))
      .mutation(async ({ input, ctx }) => {
        // Hardcoded credentials for demo
        if (input.username === "FakeMace" && input.password === "1804@BlVeC@o#3h1") {
          // In a real app, you'd set a session cookie here
          // For now, we'll just return success and let the client handle it
          return { success: true, message: "Login successful" };
        }
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials" });
      }),

    fetchMinecraftUuid: publicProcedure
      .input(z.object({ username: z.string() }))
      .query(async ({ input }) => {
        try {
          const response = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(input.username)}`);
          if (!response.ok) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Player not found on Minecraft" });
          }
          const data = await response.json();
          return { uuid: data.id, name: data.name };
        } catch (error) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch UUID from Minecraft API" });
        }
      }),

    addPlayer: protectedProcedure
      .input(z.object({ 
        name: z.string(),
        uuid: z.string().optional(),
        gamemodes: z.array(z.object({
          gamemodeId: z.number(),
          tier: z.string(),
        }))
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { players, playerGamemodes } = await import("../drizzle/schema");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        // Check if player already exists
        const existing = await db.select().from(players).where(eq(players.name, input.name)).limit(1);
        let playerId: number;
        
        if (existing.length > 0) {
          // Player exists - remove old tiers and add new ones
          playerId = existing[0].id;
          
          // Delete old player gamemodes
          await db.delete(playerGamemodes).where(eq(playerGamemodes.playerId, playerId));
        } else {
          // Insert new player (auto-published)
          const playerResult = await db.insert(players).values({
            name: input.name,
            uuid: input.uuid || undefined,
            isRetired: 0,
            isPublished: 1,
          });
          
          // Extract playerId from result
          if (typeof playerResult === 'object' && playerResult !== null) {
            playerId = (playerResult as any).insertId || (playerResult as any)[0]?.id || 0;
          } else {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to get player ID" });
          }
          
          if (!playerId) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Invalid player ID" });
          }
        }
        
        // Insert player gamemodes
        for (const gm of input.gamemodes) {
          await db.insert(playerGamemodes).values({
            playerId: playerId,
            gamemodeId: gm.gamemodeId,
            tier: gm.tier,
            position: 0,
            isRetired: 0,
          });
        }
        
        return { success: true, playerId };
      }),

    updatePlayerTier: protectedProcedure
      .input(z.object({
        playerId: z.number(),
        gamemodeId: z.number(),
        newTier: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { playerGamemodes, tierHistory } = await import("../drizzle/schema");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        // Get current tier
        const current = await db
          .select()
          .from(playerGamemodes)
          .where(
            and(
              eq(playerGamemodes.playerId, input.playerId),
              eq(playerGamemodes.gamemodeId, input.gamemodeId)
            )
          )
          .limit(1);
        
        // Update or insert tier
        if (current.length === 0) {
          // Player doesn't have this gamemode yet - add it
          await db.insert(playerGamemodes).values({
            playerId: input.playerId,
            gamemodeId: input.gamemodeId,
            tier: input.newTier,
            position: 0,
            isRetired: 0,
          });
        } else {
          // Update existing tier
          await db
            .update(playerGamemodes)
            .set({ tier: input.newTier, updatedAt: new Date() })
            .where(
              and(
                eq(playerGamemodes.playerId, input.playerId),
                eq(playerGamemodes.gamemodeId, input.gamemodeId)
              )
            );
        }
        
        // Record history
        await db.insert(tierHistory).values({
          playerId: input.playerId,
          gamemodeId: input.gamemodeId,
          previousTier: current[0]?.tier,
          newTier: input.newTier,
          changedBy: ctx.user.id,
        });
        
        return { success: true };
      }),

    markRetired: protectedProcedure
      .input(z.object({
        playerId: z.number(),
        gamemodeId: z.number(),
        isRetired: z.boolean(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { playerGamemodes } = await import("../drizzle/schema");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        await db
          .update(playerGamemodes)
          .set({ isRetired: input.isRetired ? 1 : 0, updatedAt: new Date() })
          .where(
            and(
              eq(playerGamemodes.playerId, input.playerId),
              eq(playerGamemodes.gamemodeId, input.gamemodeId)
            )
          );
        
        return { success: true };
      }),

    removePlayer: protectedProcedure
      .input(z.object({ playerId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { players, playerGamemodes, tierHistory } = await import("../drizzle/schema");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        // Delete related records
        await db.delete(tierHistory).where(eq(tierHistory.playerId, input.playerId));
        await db.delete(playerGamemodes).where(eq(playerGamemodes.playerId, input.playerId));
        await db.delete(players).where(eq(players.id, input.playerId));
        
        return { success: true };
      }),

    removeTier: protectedProcedure
      .input(z.object({
        playerId: z.number(),
        gamemodeId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { playerGamemodes } = await import("../drizzle/schema");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        await db.delete(playerGamemodes).where(
          and(
            eq(playerGamemodes.playerId, input.playerId),
            eq(playerGamemodes.gamemodeId, input.gamemodeId)
          )
        );
        
        return { success: true };
      }),

    banPlayer: protectedProcedure
      .input(z.object({
        playerId: z.number(),
        reason: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { playerGamemodes, blacklist } = await import("../drizzle/schema");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        await db.delete(playerGamemodes).where(eq(playerGamemodes.playerId, input.playerId));
        
        await db.insert(blacklist).values({
          playerId: input.playerId,
          reason: input.reason,
          bannedBy: ctx.user.id,
        }).onDuplicateKeyUpdate({
          set: {
            reason: input.reason,
            bannedBy: ctx.user.id,
          },
        });
        
        return { success: true };
      }),

    publishPlayer: protectedProcedure
      .input(z.object({ playerId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { players } = await import("../drizzle/schema");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        await db.update(players).set({ isPublished: 1 }).where(eq(players.id, input.playerId));
        return { success: true };
      }),

    getAdminLeaderboard: protectedProcedure
      .input(z.object({ gamemodeSlug: z.string() }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const gamemode = await getGamemodeBySlug(input.gamemodeSlug);
        if (!gamemode) throw new TRPCError({ code: "NOT_FOUND" });
        return await getLeaderboard(gamemode.id, 100, false, false);
      }),
  }),
});

export type AppRouter = typeof appRouter;
