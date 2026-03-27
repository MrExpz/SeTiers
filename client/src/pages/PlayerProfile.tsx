import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function PlayerProfile() {
  const [match, params] = useRoute("/player/:id");

  if (!match) return null;

  const playerId = parseInt(params?.id || "0");
  const profileQuery = trpc.players.getProfile.useQuery(
    { playerId },
    { enabled: playerId > 0 }
  );

  const profile = profileQuery.data;

  if (profileQuery.isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading profile...</p>
      </div>
    );
  }

  if (!profile || !profile.gamemodes || profile.gamemodes.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container py-6">
          <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <p className="text-muted-foreground mt-4">Player not found</p>
        </div>
      </div>
    );
  }

  const playerName = profile.gamemodes[0]?.gamemode?.id
    ? "Player"
    : "Unknown";

  const getTierDisplay = (tier: string, isRetired: number) => {
    if (isRetired) {
      return `R${tier}`;
    }
    return tier;
  };

  const getTierClass = (tier: string) => {
    return `tier-${tier.toLowerCase()}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-6">
        <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Leaderboard
        </Button>

        <div className="mt-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            {playerName}
          </h1>

          {/* Gamemodes Grid */}
          <div className="mt-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Gamemodes
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {profile.gamemodes.map((entry) => (
                <div
                  key={entry.playerGamemode.id}
                  className="border border-border rounded-lg p-4 bg-card hover:bg-accent/30 transition-colors"
                >
                  <h3 className="font-semibold text-foreground mb-2">
                    {entry.gamemode.name}
                  </h3>
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center justify-center px-2 py-1 rounded text-sm font-semibold ${getTierClass(entry.playerGamemode.tier)}`}
                    >
                      {getTierDisplay(
                        entry.playerGamemode.tier,
                        entry.playerGamemode.isRetired
                      )}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      Position: {entry.playerGamemode.position}
                    </span>
                  </div>
                  {entry.playerGamemode.isRetired && (
                    <div className="mt-2 text-xs bg-muted text-muted-foreground px-2 py-1 rounded inline-block">
                      Retired
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Tier History */}
          {profile.history && profile.history.length > 0 && (
            <div className="mt-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                Tier History
              </h2>
              <div className="space-y-2">
                {profile.history.map((entry) => (
                  <div
                    key={entry.id}
                    className="border border-border rounded p-3 bg-card text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-muted-foreground">
                          {entry.previousTier || "New"} →{" "}
                        </span>
                        <span className={`inline-flex items-center justify-center px-2 py-1 rounded text-sm font-semibold ${getTierClass(entry.newTier)}`}>
                          {entry.newTier}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {entry.reason && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {entry.reason}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
