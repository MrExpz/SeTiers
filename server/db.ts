import { eq, and, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, gamemodes, players, playerGamemodes, tierHistory } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * Get all gamemodes
 */
export async function getGamemodes() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(gamemodes);
}

/**
 * Get a gamemode by slug
 */
export async function getGamemodeBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(gamemodes)
    .where(eq(gamemodes.slug, slug))
    .limit(1);
  return result[0];
}

/**
 * Get top players for a gamemode, sorted by tier and position
 */
export async function getLeaderboard(
  gamemodeId: number,
  limit: number = 100,
  includeRetired: boolean = false,
  isPublic: boolean = false
) {
  const db = await getDb();
  if (!db) return [];

  const whereConditions = [eq(playerGamemodes.gamemodeId, gamemodeId)];
  if (isPublic) {
    whereConditions.push(eq(players.isPublished, 1));
  }

  const results = await db
    .select({
      player: players,
      playerGamemode: playerGamemodes,
    })
    .from(playerGamemodes)
    .innerJoin(players, eq(playerGamemodes.playerId, players.id))
    .where(and(...whereConditions))
    .orderBy(
      playerGamemodes.tier,
      playerGamemodes.position
    );

  return results.slice(0, limit);
}

/**
 * Get a player by name
 */
export async function getPlayerByName(name: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(players)
    .where(eq(players.name, name))
    .limit(1);
  return result[0];
}

/**
 * Get player gamemodes
 */
export async function getPlayerGamemodes(playerId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db
    .select({
      id: playerGamemodes.id,
      playerId: playerGamemodes.playerId,
      gamemodeId: playerGamemodes.gamemodeId,
      tier: playerGamemodes.tier,
      position: playerGamemodes.position,
      isRetired: playerGamemodes.isRetired,
      gamemode: gamemodes,
      playerGamemode: playerGamemodes,
    })
    .from(playerGamemodes)
    .innerJoin(gamemodes, eq(playerGamemodes.gamemodeId, gamemodes.id))
    .where(eq(playerGamemodes.playerId, playerId));
}

/**
 * Get tier history for a player
 */
export async function getTierHistory(playerId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db
    .select()
    .from(tierHistory)
    .where(eq(tierHistory.playerId, playerId))
    .orderBy(desc(tierHistory.createdAt));
}
