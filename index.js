var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// drizzle/schema.ts
var schema_exports = {};
__export(schema_exports, {
  blacklist: () => blacklist,
  gamemodes: () => gamemodes,
  playerGamemodes: () => playerGamemodes,
  players: () => players,
  tierHistory: () => tierHistory,
  users: () => users
});
import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";
var users, gamemodes, players, playerGamemodes, tierHistory, blacklist;
var init_schema = __esm({
  "drizzle/schema.ts"() {
    "use strict";
    users = mysqlTable("users", {
      /**
       * Surrogate primary key. Auto-incremented numeric value managed by the database.
       * Use this for relations between tables.
       */
      id: int("id").autoincrement().primaryKey(),
      /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
      openId: varchar("openId", { length: 64 }).notNull().unique(),
      name: text("name"),
      email: varchar("email", { length: 320 }),
      loginMethod: varchar("loginMethod", { length: 64 }),
      role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
      lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
    });
    gamemodes = mysqlTable("gamemodes", {
      id: int("id").autoincrement().primaryKey(),
      name: varchar("name", { length: 64 }).notNull().unique(),
      slug: varchar("slug", { length: 64 }).notNull().unique(),
      description: text("description"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    players = mysqlTable("players", {
      id: int("id").autoincrement().primaryKey(),
      name: varchar("name", { length: 128 }).notNull().unique(),
      uuid: varchar("uuid", { length: 36 }),
      isRetired: int("isRetired").default(0).notNull(),
      isPublished: int("isPublished").default(0).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    playerGamemodes = mysqlTable("playerGamemodes", {
      id: int("id").autoincrement().primaryKey(),
      playerId: int("playerId").notNull(),
      gamemodeId: int("gamemodeId").notNull(),
      tier: varchar("tier", { length: 16 }).notNull(),
      // HT1-HT5, LT1-LT5
      position: int("position").notNull().default(0),
      // ranking position within tier
      isRetired: int("isRetired").default(0).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    tierHistory = mysqlTable("tierHistory", {
      id: int("id").autoincrement().primaryKey(),
      playerId: int("playerId").notNull(),
      gamemodeId: int("gamemodeId").notNull(),
      previousTier: varchar("previousTier", { length: 16 }),
      newTier: varchar("newTier", { length: 16 }).notNull(),
      changedBy: int("changedBy"),
      // admin user id
      reason: text("reason"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    blacklist = mysqlTable("blacklist", {
      id: int("id").autoincrement().primaryKey(),
      playerId: int("playerId").notNull().unique(),
      reason: text("reason"),
      bannedBy: int("bannedBy"),
      // admin user id
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
  }
});

// server/_core/index.ts
import "dotenv/config";
import express2 from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/db.ts
init_schema();
import { eq, and, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? ""
};

// server/db.ts
var _db = null;
async function getDb() {
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
async function upsertUser(user) {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values = {
      openId: user.openId
    };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod"];
    const assignNullable = (field) => {
      const value = user[field];
      if (value === void 0) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== void 0) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== void 0) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = /* @__PURE__ */ new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = /* @__PURE__ */ new Date();
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return void 0;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function getGamemodes() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(gamemodes);
}
async function getGamemodeBySlug(slug) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(gamemodes).where(eq(gamemodes.slug, slug)).limit(1);
  return result[0];
}
async function getLeaderboard(gamemodeId, limit = 100, includeRetired = false, isPublic = false) {
  const db = await getDb();
  if (!db) return [];
  const whereConditions = [eq(playerGamemodes.gamemodeId, gamemodeId)];
  if (isPublic) {
    whereConditions.push(eq(players.isPublished, 1));
  }
  const results = await db.select({
    player: players,
    playerGamemode: playerGamemodes
  }).from(playerGamemodes).innerJoin(players, eq(playerGamemodes.playerId, players.id)).where(and(...whereConditions)).orderBy(
    playerGamemodes.tier,
    playerGamemodes.position
  );
  return results.slice(0, limit);
}
async function getPlayerGamemodes(playerId) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: playerGamemodes.id,
    playerId: playerGamemodes.playerId,
    gamemodeId: playerGamemodes.gamemodeId,
    tier: playerGamemodes.tier,
    position: playerGamemodes.position,
    isRetired: playerGamemodes.isRetired,
    gamemode: gamemodes,
    playerGamemode: playerGamemodes
  }).from(playerGamemodes).innerJoin(gamemodes, eq(playerGamemodes.gamemodeId, gamemodes.id)).where(eq(playerGamemodes.playerId, playerId));
}
async function getTierHistory(playerId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tierHistory).where(eq(tierHistory.playerId, playerId)).orderBy(desc(tierHistory.createdAt));
}

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    const redirectUri = atob(state);
    return redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/routers.ts
import { z as z2 } from "zod";
import { TRPCError as TRPCError3 } from "@trpc/server";
import { eq as eq2, and as and2 } from "drizzle-orm";

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/routers.ts
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true
      };
    })
  }),
  leaderboard: router({
    getGamemodes: publicProcedure.query(async () => {
      return await getGamemodes();
    }),
    getByGamemode: publicProcedure.input(z2.object({ gamemodeSlug: z2.string(), includeRetired: z2.boolean().default(false) })).query(async ({ input }) => {
      const gamemode = await getGamemodeBySlug(input.gamemodeSlug);
      if (!gamemode) {
        throw new TRPCError3({ code: "NOT_FOUND", message: "Gamemode not found" });
      }
      return await getLeaderboard(gamemode.id, 100, input.includeRetired ? true : false, true);
    }),
    getPlayerProfile: publicProcedure.input(z2.object({ playerId: z2.number() })).query(async ({ input }) => {
      const playerGms = await getPlayerGamemodes(input.playerId);
      const history = await getTierHistory(input.playerId);
      return { gamemodes: playerGms, history };
    }),
    getPlayerDetails: publicProcedure.input(z2.object({ playerId: z2.number() })).query(async ({ input }) => {
      const { players: players2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const db = await getDb();
      if (!db) throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR" });
      const result = await db.select().from(players2).where(eq2(players2.id, input.playerId)).limit(1);
      if (!result.length) throw new TRPCError3({ code: "NOT_FOUND" });
      const player = result[0];
      const playerGms = await getPlayerGamemodes(input.playerId);
      return {
        id: player.id,
        name: player.name,
        uuid: player.uuid,
        isRetired: player.isRetired,
        gamemodes: playerGms,
        position: 1,
        gamemodeDisplay: playerGms[0]?.gamemode.name || "Leaderboard"
      };
    })
  }),
  admin: router({
    login: publicProcedure.input(z2.object({ username: z2.string(), password: z2.string() })).mutation(async ({ input, ctx }) => {
      if (input.username === "FakeMace" && input.password === "1804@BlVeC@o#3h1") {
        return { success: true, message: "Login successful" };
      }
      throw new TRPCError3({ code: "UNAUTHORIZED", message: "Invalid credentials" });
    }),
    fetchMinecraftUuid: publicProcedure.input(z2.object({ username: z2.string() })).query(async ({ input }) => {
      try {
        const response = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(input.username)}`);
        if (!response.ok) {
          throw new TRPCError3({ code: "NOT_FOUND", message: "Player not found on Minecraft" });
        }
        const data = await response.json();
        return { uuid: data.id, name: data.name };
      } catch (error) {
        throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch UUID from Minecraft API" });
      }
    }),
    addPlayer: protectedProcedure.input(z2.object({
      name: z2.string(),
      uuid: z2.string().optional(),
      gamemodes: z2.array(z2.object({
        gamemodeId: z2.number(),
        tier: z2.string()
      }))
    })).mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError3({ code: "FORBIDDEN" });
      const { players: players2, playerGamemodes: playerGamemodes2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const db = await getDb();
      if (!db) throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR" });
      const existing = await db.select().from(players2).where(eq2(players2.name, input.name)).limit(1);
      let playerId;
      if (existing.length > 0) {
        playerId = existing[0].id;
        await db.delete(playerGamemodes2).where(eq2(playerGamemodes2.playerId, playerId));
      } else {
        const playerResult = await db.insert(players2).values({
          name: input.name,
          uuid: input.uuid || void 0,
          isRetired: 0,
          isPublished: 1
        });
        if (typeof playerResult === "object" && playerResult !== null) {
          playerId = playerResult.insertId || playerResult[0]?.id || 0;
        } else {
          throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "Failed to get player ID" });
        }
        if (!playerId) {
          throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "Invalid player ID" });
        }
      }
      for (const gm of input.gamemodes) {
        await db.insert(playerGamemodes2).values({
          playerId,
          gamemodeId: gm.gamemodeId,
          tier: gm.tier,
          position: 0,
          isRetired: 0
        });
      }
      return { success: true, playerId };
    }),
    updatePlayerTier: protectedProcedure.input(z2.object({
      playerId: z2.number(),
      gamemodeId: z2.number(),
      newTier: z2.string()
    })).mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError3({ code: "FORBIDDEN" });
      const { playerGamemodes: playerGamemodes2, tierHistory: tierHistory2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const db = await getDb();
      if (!db) throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR" });
      const current = await db.select().from(playerGamemodes2).where(
        and2(
          eq2(playerGamemodes2.playerId, input.playerId),
          eq2(playerGamemodes2.gamemodeId, input.gamemodeId)
        )
      ).limit(1);
      if (current.length === 0) {
        await db.insert(playerGamemodes2).values({
          playerId: input.playerId,
          gamemodeId: input.gamemodeId,
          tier: input.newTier,
          position: 0,
          isRetired: 0
        });
      } else {
        await db.update(playerGamemodes2).set({ tier: input.newTier, updatedAt: /* @__PURE__ */ new Date() }).where(
          and2(
            eq2(playerGamemodes2.playerId, input.playerId),
            eq2(playerGamemodes2.gamemodeId, input.gamemodeId)
          )
        );
      }
      await db.insert(tierHistory2).values({
        playerId: input.playerId,
        gamemodeId: input.gamemodeId,
        previousTier: current[0]?.tier,
        newTier: input.newTier,
        changedBy: ctx.user.id
      });
      return { success: true };
    }),
    markRetired: protectedProcedure.input(z2.object({
      playerId: z2.number(),
      gamemodeId: z2.number(),
      isRetired: z2.boolean()
    })).mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError3({ code: "FORBIDDEN" });
      const { playerGamemodes: playerGamemodes2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const db = await getDb();
      if (!db) throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(playerGamemodes2).set({ isRetired: input.isRetired ? 1 : 0, updatedAt: /* @__PURE__ */ new Date() }).where(
        and2(
          eq2(playerGamemodes2.playerId, input.playerId),
          eq2(playerGamemodes2.gamemodeId, input.gamemodeId)
        )
      );
      return { success: true };
    }),
    removePlayer: protectedProcedure.input(z2.object({ playerId: z2.number() })).mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError3({ code: "FORBIDDEN" });
      const { players: players2, playerGamemodes: playerGamemodes2, tierHistory: tierHistory2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const db = await getDb();
      if (!db) throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(tierHistory2).where(eq2(tierHistory2.playerId, input.playerId));
      await db.delete(playerGamemodes2).where(eq2(playerGamemodes2.playerId, input.playerId));
      await db.delete(players2).where(eq2(players2.id, input.playerId));
      return { success: true };
    }),
    removeTier: protectedProcedure.input(z2.object({
      playerId: z2.number(),
      gamemodeId: z2.number()
    })).mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError3({ code: "FORBIDDEN" });
      const { playerGamemodes: playerGamemodes2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const db = await getDb();
      if (!db) throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(playerGamemodes2).where(
        and2(
          eq2(playerGamemodes2.playerId, input.playerId),
          eq2(playerGamemodes2.gamemodeId, input.gamemodeId)
        )
      );
      return { success: true };
    }),
    banPlayer: protectedProcedure.input(z2.object({
      playerId: z2.number(),
      reason: z2.string().optional()
    })).mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError3({ code: "FORBIDDEN" });
      const { playerGamemodes: playerGamemodes2, blacklist: blacklist2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const db = await getDb();
      if (!db) throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(playerGamemodes2).where(eq2(playerGamemodes2.playerId, input.playerId));
      await db.insert(blacklist2).values({
        playerId: input.playerId,
        reason: input.reason,
        bannedBy: ctx.user.id
      }).onDuplicateKeyUpdate({
        set: {
          reason: input.reason,
          bannedBy: ctx.user.id
        }
      });
      return { success: true };
    }),
    publishPlayer: protectedProcedure.input(z2.object({ playerId: z2.number() })).mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError3({ code: "FORBIDDEN" });
      const { players: players2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const db = await getDb();
      if (!db) throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(players2).set({ isPublished: 1 }).where(eq2(players2.id, input.playerId));
      return { success: true };
    }),
    getAdminLeaderboard: protectedProcedure.input(z2.object({ gamemodeSlug: z2.string() })).query(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError3({ code: "FORBIDDEN" });
      const gamemode = await getGamemodeBySlug(input.gamemodeSlug);
      if (!gamemode) throw new TRPCError3({ code: "NOT_FOUND" });
      return await getLeaderboard(gamemode.id, 100, false, false);
    })
  })
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/vite.ts
import express from "express";
import fs2 from "fs";
import { nanoid } from "nanoid";
import path2 from "path";
import { createServer as createViteServer } from "vite";

// vite.config.ts
import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";
var PROJECT_ROOT = import.meta.dirname;
var LOG_DIR = path.join(PROJECT_ROOT, ".manus-logs");
var MAX_LOG_SIZE_BYTES = 1 * 1024 * 1024;
var TRIM_TARGET_BYTES = Math.floor(MAX_LOG_SIZE_BYTES * 0.6);
function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}
function trimLogFile(logPath, maxSize) {
  try {
    if (!fs.existsSync(logPath) || fs.statSync(logPath).size <= maxSize) return;
    const lines = fs.readFileSync(logPath, "utf-8").split("\n");
    const keptLines = [];
    let keptBytes = 0;
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineBytes = Buffer.byteLength(`${lines[i]}
`, "utf-8");
      if (keptBytes + lineBytes > TRIM_TARGET_BYTES) break;
      keptLines.unshift(lines[i]);
      keptBytes += lineBytes;
    }
    fs.writeFileSync(logPath, keptLines.join("\n"), "utf-8");
  } catch {
  }
}
function writeToLogFile(source, entries) {
  if (!entries.length) return;
  ensureLogDir();
  const logPath = path.join(LOG_DIR, `${source}.log`);
  const lines = entries.map((entry) => `[${(/* @__PURE__ */ new Date()).toISOString()}] ${JSON.stringify(entry)}`);
  fs.appendFileSync(logPath, `${lines.join("\n")}
`, "utf-8");
  trimLogFile(logPath, MAX_LOG_SIZE_BYTES);
}
function vitePluginManusDebugCollector() {
  return {
    name: "manus-debug-collector",
    transformIndexHtml(html) {
      if (process.env.NODE_ENV === "production") return html;
      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: { src: "/__manus__/debug-collector.js", defer: true },
            injectTo: "head"
          }
        ]
      };
    },
    configureServer(server) {
      server.middlewares.use("/__manus__/logs", (req, res, next) => {
        if (req.method !== "POST") return next();
        const handlePayload = (payload) => {
          if (payload.consoleLogs?.length) writeToLogFile("browserConsole", payload.consoleLogs);
          if (payload.networkRequests?.length) writeToLogFile("networkRequests", payload.networkRequests);
          if (payload.sessionEvents?.length) writeToLogFile("sessionReplay", payload.sessionEvents);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        };
        let body = "";
        req.on("data", (chunk) => body += chunk.toString());
        req.on("end", () => {
          try {
            const payload = JSON.parse(body);
            handlePayload(payload);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
        });
      });
    }
  };
}
var vite_config_default = defineConfig({
  base: "/SeTiers/",
  // IMPORTANT: GitHub Pages subpath
  plugins: [
    react(),
    tailwindcss(),
    jsxLocPlugin(),
    vitePluginManusRuntime(),
    vitePluginManusDebugCollector()
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1"
    ],
    fs: { strict: true, deny: ["**/.*"] }
  }
});

// server/_core/vite.ts
async function setupVite(app, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    server: serverOptions,
    appType: "custom"
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );
      let template = await fs2.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app) {
  const distPath = process.env.NODE_ENV === "development" ? path2.resolve(import.meta.dirname, "../..", "dist", "public") : path2.resolve(import.meta.dirname, "public");
  if (!fs2.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app.use(express.static(distPath));
  app.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/_core/index.ts
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}
async function findAvailablePort(startPort = 3e3) {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}
async function startServer() {
  const app = express2();
  const server = createServer(app);
  app.use(express2.json({ limit: "50mb" }));
  app.use(express2.urlencoded({ limit: "50mb", extended: true }));
  registerOAuthRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
startServer().catch(console.error);
