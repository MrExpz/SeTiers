import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { SearchPlayers } from "@/components/SearchPlayers";
import { PlayerDetailModal } from "@/components/PlayerDetailModal";

const TIERS = ["HT1", "LT1", "HT2", "LT2", "HT3", "LT3", "HT4", "LT4", "HT5", "LT5"];

const TIER_COLORS: Record<string, string> = {
  HT1: "#ef4444",
  LT1: "#f97316",
  HT2: "#eab308",
  LT2: "#06b6d4",
  HT3: "#8b5cf6",
  LT3: "#ec4899",
  HT4: "#10b981",
  LT4: "#6366f1",
  HT5: "#14b8a6",
  LT5: "#6b7280",
};

export default function Leaderboard() {
  const [currentTab, setCurrentTab] = useState<"leaderboard" | "gamemode">("leaderboard");
  const [currentGamemode, setCurrentGamemode] = useState("vanilla");
  const [selectedPlayer, setSelectedPlayer] = useState<{ id: number; name: string } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const gamemodesQuery = trpc.leaderboard.getGamemodes.useQuery();
  const leaderboardQuery = trpc.leaderboard.getByGamemode.useQuery(
    { gamemodeSlug: 'vanilla', includeRetired: false },
    { enabled: currentTab === 'leaderboard' }
  );
  const gamemodeQuery = trpc.leaderboard.getByGamemode.useQuery(
    { gamemodeSlug: currentGamemode, includeRetired: false },
    { enabled: currentTab === "gamemode" && !!currentGamemode }
  );

  const gamemodes = (gamemodesQuery.data || []).filter(gm => gm.slug !== 'overall');
  const leaderboard = (leaderboardQuery.data || []) as any[];
  const gamemodeData = (gamemodeQuery.data || []) as any[];

  const handlePlayerClick = (playerId: number, playerName: string) => {
    setSelectedPlayer({ id: playerId, name: playerName });
    setIsModalOpen(true);
  };

  // Leaderboard Tab - Ranked 1-100
  const renderLeaderboardTab = () => (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-foreground mb-4">Leaderboard</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-2 text-left font-semibold text-muted-foreground w-12">#</th>
              <th className="px-4 py-2 text-left font-semibold text-muted-foreground">Player</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((entry: any, index: number) => (
              <tr
                key={`${entry.player.id}-${entry.playerGamemode.id}`}
                className="border-b border-border hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => handlePlayerClick(entry.player.id, entry.player.name)}
              >
                <td className="px-4 py-2 font-semibold text-muted-foreground">{index + 1}</td>
                <td className="px-4 py-2 text-foreground">{entry.player.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Gamemode Tab - Spreadsheet with Tier Columns
  const renderGamemodeTab = () => {
    // Group players by tier
    const playersByTier: Record<string, any[]> = {};
    TIERS.forEach(tier => {
      playersByTier[tier] = gamemodeData.filter(
        (entry: any) => entry.playerGamemode.tier === tier
      );
    });

    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-foreground mb-4">
          {gamemodes.find(gm => gm.slug === currentGamemode)?.name}
        </h2>
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            {/* Tier Headers */}
            <div className="flex gap-2 mb-4">
              {TIERS.map(tier => (
                <div
                  key={tier}
                  className="flex-1 min-w-[150px] px-3 py-2 rounded text-center font-bold text-white text-sm"
                  style={{ backgroundColor: TIER_COLORS[tier] }}
                >
                  {tier}
                </div>
              ))}
            </div>

            {/* Players in Each Tier */}
            <div className="flex gap-2">
              {TIERS.map(tier => (
                <div
                  key={`${tier}-column`}
                  className="flex-1 min-w-[150px] border border-border rounded-lg p-3 bg-card/50 min-h-[400px]"
                >
                  <div className="space-y-2">
                    {playersByTier[tier].map((entry: any) => (
                      <div
                        key={entry.player.id}
                        onClick={() => handlePlayerClick(entry.player.id, entry.player.name)}
                        className={`p-2 rounded bg-background border border-border hover:border-foreground transition-colors cursor-pointer text-sm ${
                          entry.playerGamemode.isRetired ? "opacity-50" : ""
                        }`}
                      >
                        <div className="font-medium text-foreground truncate">
                          {entry.player.name}
                        </div>
                        {entry.playerGamemode.isRetired && (
                          <div className="text-xs text-muted-foreground">(R)</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border sticky top-0 z-40 bg-card/95 backdrop-blur">
        <div className="container py-4">
          <h1 className="text-3xl font-bold text-foreground mb-4">SE Tiers</h1>

          {/* Search Bar */}
          <div className="mb-4 max-w-md">
            <SearchPlayers
              onPlayerSelect={(playerId, playerName) => {
                handlePlayerClick(playerId, playerName);
              }}
            />
          </div>

          {/* Main Tabs */}
          <div className="flex gap-1 border-b border-border">
            <button
              onClick={() => setCurrentTab("leaderboard")}
              className={`px-4 py-2 font-medium transition-colors ${
                currentTab === "leaderboard"
                  ? "text-foreground border-b-2 border-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Leaderboard
            </button>
            {gamemodes.map(gm => (
              <button
                key={gm.id}
                onClick={() => {
                  setCurrentTab("gamemode");
                  setCurrentGamemode(gm.slug);
                }}
                className={`px-4 py-2 font-medium transition-colors ${
                  currentTab === "gamemode" && currentGamemode === gm.slug
                    ? "text-foreground border-b-2 border-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {gm.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container py-6">
        {currentTab === "leaderboard" ? renderLeaderboardTab() : renderGamemodeTab()}
      </div>

      {/* Player Detail Modal */}
      {selectedPlayer && (
        <PlayerDetailModal
          playerId={selectedPlayer.id}
          playerName={selectedPlayer.name}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedPlayer(null);
          }}
          onUpdate={() => {
            leaderboardQuery.refetch();
            gamemodeQuery.refetch();
          }}
        />
      )}
    </div>
  );
}
