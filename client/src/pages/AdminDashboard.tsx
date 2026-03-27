import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlayerDetailModal } from "@/components/PlayerDetailModal";
import { AddPlayerModal } from "@/components/AddPlayerModal";
import { useLocation } from "wouter";
import { Plus, LogOut } from "lucide-react";

const TIERS = ["HT1", "LT1", "HT2", "LT2", "HT3", "LT3", "HT4", "LT4", "HT5", "LT5"];

export default function AdminDashboard() {
  const [currentTab, setCurrentTab] = useState<"leaderboard" | "gamemode">("leaderboard");
  const [currentGamemode, setCurrentGamemode] = useState("vanilla");
  const [showRetired, setShowRetired] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<{ id: number; name: string } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddPlayerModalOpen, setIsAddPlayerModalOpen] = useState(false);
  const [, setLocation] = useLocation();

  const gamemodesQuery = trpc.leaderboard.getGamemodes.useQuery();
  const leaderboardQuery = trpc.admin.getAdminLeaderboard.useQuery(
    { gamemodeSlug: currentGamemode },
    { enabled: !!currentGamemode }
  );

  const publishPlayerMutation = trpc.admin.publishPlayer.useMutation({
    onSuccess: () => {
      leaderboardQuery.refetch();
    },
  });

  const gamemodes = (gamemodesQuery.data || []).filter(gm => gm.slug !== 'overall');
  const leaderboard = (leaderboardQuery.data || []) as any[];



  const getTierClass = (tier: string) => {
    return `tier-${tier.toLowerCase()}`;
  };

  const getTierDisplay = (tier: string, isRetired: number) => {
    if (isRetired) {
      return `R${tier}`;
    }
    return tier;
  };

  // Group players by tier for spreadsheet view
  const playersByTier: Record<string, any[]> = {};
  TIERS.forEach(tier => {
    playersByTier[tier] = leaderboard.filter(entry => entry.playerGamemode.tier === tier);
  });

  // Get max rows needed
  const maxRows = Math.max(...TIERS.map(tier => playersByTier[tier].length), 1);

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    setLocation("/admin/login");
  };

  const handlePlayerClick = (playerId: number, playerName: string) => {
    setSelectedPlayer({ id: playerId, name: playerName });
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card sticky top-0 z-40">
        <div className="container py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-foreground">SE Tiers Admin</h1>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="gap-2"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 mb-4 overflow-x-auto">
            <Button
              variant={currentTab === "leaderboard" ? "default" : "outline"}
              size="sm"
              onClick={() => setCurrentTab("leaderboard")}
            >
              Leaderboard
            </Button>
            {gamemodes.map((gm) => (
              <Button
                key={gm.id}
                variant={currentTab === "gamemode" && currentGamemode === gm.slug ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setCurrentTab("gamemode");
                  setCurrentGamemode(gm.slug);
                }}
                className="whitespace-nowrap"
              >
                {gm.name}
              </Button>
            ))}
          </div>

          {/* Add Player Button */}
          <div className="flex gap-2 mb-4">
            <Button
              size="sm"
              onClick={() => setIsAddPlayerModalOpen(true)}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Player
            </Button>
            <Button
              variant={showRetired ? "default" : "outline"}
              size="sm"
              onClick={() => setShowRetired(!showRetired)}
            >
              {showRetired ? "Hide Retired" : "Show Retired"}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container py-6">
        {currentTab === "leaderboard" ? (
          // Ranked Leaderboard View (1-100)
          <div>
            {leaderboardQuery.isLoading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading leaderboard...</p>
              </div>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden">
                {/* Header Row */}
                <div className="leaderboard-header grid grid-cols-12 gap-4">
                  <div className="col-span-1">#</div>
                  <div className="col-span-6">Player</div>
                  <div className="col-span-3">Tier</div>
                  <div className="col-span-2">Action</div>
                </div>

                {/* Player Rows - Top 100 */}
                {leaderboard.slice(0, 100).map((entry, index) => (
                  <div
                    key={entry.player.id}
                    className={`player-row grid grid-cols-12 gap-4 ${
                      entry.playerGamemode.isRetired ? "retired" : ""
                    }`}
                  >
                    <div className="col-span-1 font-semibold text-muted-foreground">
                      {index + 1}
                    </div>
                    <div className="col-span-6 flex items-center gap-2">
                      <span className="font-medium">{entry.player.name}</span>
                      {entry.playerGamemode.isRetired && (
                        <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">
                          (R)
                        </span>
                      )}
                    </div>
                    <div className="col-span-3">
                      <span className={`inline-flex items-center justify-center px-2 py-1 rounded text-sm font-semibold ${getTierClass(entry.playerGamemode.tier)}`}>
                        {getTierDisplay(entry.playerGamemode.tier, entry.playerGamemode.isRetired)}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePlayerClick(entry.player.id, entry.player.name)}
                        className="text-xs"
                      >
                        Edit
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          // Spreadsheet Tier Column View
          <div>
            {leaderboardQuery.isLoading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading {currentGamemode}...</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-border rounded-lg">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-card">
                      {TIERS.map((tier) => (
                        <th key={tier} className="p-4 text-left font-semibold text-foreground border-r border-border last:border-r-0">
                          {tier}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: maxRows }).map((_, rowIndex) => (
                      <tr key={rowIndex} className="border-b border-border last:border-b-0">
                        {TIERS.map((tier) => {
                          const player = playersByTier[tier][rowIndex];
                          return (
                            <td
                              key={`${tier}-${rowIndex}`}
                              className="p-4 border-r border-border last:border-r-0 align-top"
                            >
                              {player ? (
                                <div className="space-y-2">
                                  <div
                                    className="cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() => handlePlayerClick(player.player.id, player.player.name)}
                                  >
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="font-medium text-foreground">{player.player.name}</span>
                                      {player.playerGamemode.isRetired && (
                                        <span className="text-xs bg-muted text-muted-foreground px-1 py-0.5 rounded">
                                          (R)
                                        </span>
                                      )}
                                    </div>
                                    <span
                                      className={`inline-flex items-center justify-center px-2 py-1 rounded text-xs font-semibold ${getTierClass(player.playerGamemode.tier)}`}
                                    >
                                      {getTierDisplay(
                                        player.playerGamemode.tier,
                                        player.playerGamemode.isRetired
                                      )}
                                    </span>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handlePlayerClick(player.player.id, player.player.name)}
                                    className="text-xs w-full"
                                  >
                                    Edit
                                  </Button>
                                </div>
                              ) : (
                                <div className="text-muted-foreground text-sm">-</div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
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
          onUpdate={() => leaderboardQuery.refetch()}
        />
      )}

      {/* Add Player Modal */}
      <AddPlayerModal
        isOpen={isAddPlayerModalOpen}
        onClose={() => setIsAddPlayerModalOpen(false)}
        onSuccess={() => leaderboardQuery.refetch()}
      />
    </div>
  );
}
