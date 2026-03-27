import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, index } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
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
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Gamemodes table: stores available gamemodes (Overall, Vanilla, UHC, etc.)
 */
export const gamemodes = mysqlTable("gamemodes", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 64 }).notNull().unique(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Gamemode = typeof gamemodes.$inferSelect;
export type InsertGamemode = typeof gamemodes.$inferInsert;

/**
 * Players table: stores player information
 */
export const players = mysqlTable("players", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull().unique(),
  uuid: varchar("uuid", { length: 36 }),
  isRetired: int("isRetired").default(0).notNull(),
  isPublished: int("isPublished").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Player = typeof players.$inferSelect;
export type InsertPlayer = typeof players.$inferInsert;

/**
 * Player Gamemodes table: tracks player participation and tier in each gamemode
 */
export const playerGamemodes = mysqlTable("playerGamemodes", {
  id: int("id").autoincrement().primaryKey(),
  playerId: int("playerId").notNull(),
  gamemodeId: int("gamemodeId").notNull(),
  tier: varchar("tier", { length: 16 }).notNull(), // HT1-HT5, LT1-LT5
  position: int("position").notNull().default(0), // ranking position within tier
  isRetired: int("isRetired").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PlayerGamemode = typeof playerGamemodes.$inferSelect;
export type InsertPlayerGamemode = typeof playerGamemodes.$inferInsert;

/**
 * Tier History table: tracks tier changes over time
 */
export const tierHistory = mysqlTable("tierHistory", {
  id: int("id").autoincrement().primaryKey(),
  playerId: int("playerId").notNull(),
  gamemodeId: int("gamemodeId").notNull(),
  previousTier: varchar("previousTier", { length: 16 }),
  newTier: varchar("newTier", { length: 16 }).notNull(),
  changedBy: int("changedBy"), // admin user id
  reason: text("reason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TierHistory = typeof tierHistory.$inferSelect;
export type InsertTierHistory = typeof tierHistory.$inferInsert;

/**
 * Blacklist table: tracks banned players
 */
export const blacklist = mysqlTable("blacklist", {
  id: int("id").autoincrement().primaryKey(),
  playerId: int("playerId").notNull().unique(),
  reason: text("reason"),
  bannedBy: int("bannedBy"), // admin user id
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Blacklist = typeof blacklist.$inferSelect;
export type InsertBlacklist = typeof blacklist.$inferInsert;
