import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import { getLeaderboard, getPlayerByName, getGamemodeBySlug, getPlayerGamemodes } from "./db";

describe("Leaderboard Functions", () => {
  let db: any;

  beforeAll(async () => {
    db = await getDb();
  });

  it("should get gamemodes by slug", async () => {
    const gamemode = await getGamemodeBySlug("overall");
    expect(gamemode).toBeDefined();
    expect(gamemode?.slug).toBe("overall");
    expect(gamemode?.name).toBe("Overall");
  });

  it("should get leaderboard for a gamemode", async () => {
    const gamemode = await getGamemodeBySlug("overall");
    if (!gamemode) throw new Error("Gamemode not found");

    const leaderboard = await getLeaderboard(gamemode.id, 10, false);
    expect(Array.isArray(leaderboard)).toBe(true);
    expect(leaderboard.length).toBeLessThanOrEqual(10);

    // Verify structure
    if (leaderboard.length > 0) {
      expect(leaderboard[0]).toHaveProperty("player");
      expect(leaderboard[0]).toHaveProperty("playerGamemode");
      expect(leaderboard[0].player).toHaveProperty("name");
      expect(leaderboard[0].playerGamemode).toHaveProperty("tier");
    }
  });

  it("should get player by name", async () => {
    const player = await getPlayerByName("Notch");
    expect(player).toBeDefined();
    expect(player?.name).toBe("Notch");
  });

  it("should return undefined for non-existent player", async () => {
    const player = await getPlayerByName("NonExistentPlayer12345");
    expect(player).toBeUndefined();
  });

  it("should get player gamemodes", async () => {
    const player = await getPlayerByName("Notch");
    if (!player) throw new Error("Player not found");

    const gamemodes = await getPlayerGamemodes(player.id);
    expect(Array.isArray(gamemodes)).toBe(true);
    expect(gamemodes.length).toBeGreaterThan(0);

    // Verify structure
    if (gamemodes.length > 0) {
      expect(gamemodes[0]).toHaveProperty("gamemode");
      expect(gamemodes[0]).toHaveProperty("playerGamemode");
      expect(gamemodes[0].gamemode).toHaveProperty("name");
      expect(gamemodes[0].playerGamemode).toHaveProperty("tier");
    }
  });

  it("should include retired players when requested", async () => {
    const gamemode = await getGamemodeBySlug("overall");
    if (!gamemode) throw new Error("Gamemode not found");

    const leaderboardWithRetired = await getLeaderboard(gamemode.id, 100, true);
    const leaderboardWithoutRetired = await getLeaderboard(gamemode.id, 100, false);

    expect(leaderboardWithRetired.length).toBeGreaterThanOrEqual(leaderboardWithoutRetired.length);
  });

  it("should validate tier format", async () => {
    const validTiers = ["HT1", "HT2", "HT3", "HT4", "HT5", "LT1", "LT2", "LT3", "LT4", "LT5"];
    const gamemode = await getGamemodeBySlug("overall");
    if (!gamemode) throw new Error("Gamemode not found");

    const leaderboard = await getLeaderboard(gamemode.id, 100, false);
    for (const entry of leaderboard) {
      expect(validTiers).toContain(entry.playerGamemode.tier);
    }
  });
});
