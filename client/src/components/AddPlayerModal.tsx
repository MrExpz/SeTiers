import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { X, Loader2 } from "lucide-react";

interface AddPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const TIERS = ["HT1", "LT1", "HT2", "LT2", "HT3", "LT3", "HT4", "LT4", "HT5", "LT5"];

export function AddPlayerModal({ isOpen, onClose, onSuccess }: AddPlayerModalProps) {
  const [playerName, setPlayerName] = useState("");
  const [selectedGamemodes, setSelectedGamemodes] = useState<Record<number, string>>({});
  const [isFetchingUUID, setIsFetchingUUID] = useState(false);
  const [playerUUID, setPlayerUUID] = useState<string | null>(null);

  const gamemodesQuery = trpc.leaderboard.getGamemodes.useQuery();
  const addPlayerMutation = trpc.admin.addPlayer.useMutation({
    onSuccess: () => {
      toast.success("Player added successfully!");
      setPlayerName("");
      setSelectedGamemodes({});
      setPlayerUUID(null);
      onSuccess();
      onClose();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to add player");
    },
  });

  const gamemodes = (gamemodesQuery.data || []).filter(gm => gm.slug !== 'overall');

  const fetchUUID = async () => {
    if (!playerName.trim()) {
      toast.error("Please enter a player name");
      return;
    }

    setIsFetchingUUID(true);
    try {
      const response = await fetch(`https://api.mojang.com/users/profiles/minecraft/${playerName}`);
      if (!response.ok) {
        toast.error("Player not found on Minecraft. Please check the username.");
        setPlayerUUID(null);
        setIsFetchingUUID(false);
        return;
      }
      const data = await response.json();
      setPlayerUUID(data.id);
      toast.success("Player found! UUID: " + data.id);
    } catch (error) {
      toast.error("Failed to fetch player UUID. Please try again.");
      setPlayerUUID(null);
    } finally {
      setIsFetchingUUID(false);
    }
  };

  const handleAddPlayer = () => {
    if (!playerName.trim()) {
      toast.error("Please enter a player name");
      return;
    }

    if (Object.keys(selectedGamemodes).length === 0) {
      toast.error("Please select at least one gamemode");
      return;
    }

    if (!playerUUID) {
      toast.error("Please fetch the player UUID first");
      return;
    }

    const gamemodesList = Object.entries(selectedGamemodes).map(([gamemodeId, tier]) => ({
      gamemodeId: parseInt(gamemodeId),
      tier,
    }));

    addPlayerMutation.mutate({
      name: playerName,
      uuid: playerUUID,
      gamemodes: gamemodesList,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-foreground">Add Player</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Player Name Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-foreground mb-2">
            Minecraft Username
          </label>
          <div className="flex gap-2">
            <Input
              placeholder="Enter Minecraft username"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              disabled={isFetchingUUID}
            />
            <Button
              onClick={fetchUUID}
              disabled={isFetchingUUID || !playerName.trim()}
              size="sm"
              className="whitespace-nowrap"
            >
              {isFetchingUUID ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Fetching...
                </>
              ) : (
                "Fetch UUID"
              )}
            </Button>
          </div>
          {playerUUID && (
            <p className="text-xs text-green-400 mt-2">
              ✓ UUID: {playerUUID}
            </p>
          )}
        </div>

        {/* Gamemodes Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-foreground mb-2">
            Select Gamemodes & Tiers
          </label>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {gamemodes.map((gamemode) => (
              <div key={gamemode.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`gm-${gamemode.id}`}
                  checked={!!selectedGamemodes[gamemode.id]}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedGamemodes({
                        ...selectedGamemodes,
                        [gamemode.id]: "HT1",
                      });
                    } else {
                      const newGamemodes = { ...selectedGamemodes };
                      delete newGamemodes[gamemode.id];
                      setSelectedGamemodes(newGamemodes);
                    }
                  }}
                  className="w-4 h-4"
                />
                <label htmlFor={`gm-${gamemode.id}`} className="flex-1 text-sm">
                  {gamemode.name}
                </label>
                {selectedGamemodes[gamemode.id] && (
                  <select
                    value={selectedGamemodes[gamemode.id]}
                    onChange={(e) =>
                      setSelectedGamemodes({
                        ...selectedGamemodes,
                        [gamemode.id]: e.target.value,
                      })
                    }
                    className="px-2 py-1 rounded bg-background border border-border text-foreground text-xs"
                  >
                    {TIERS.map((tier) => (
                      <option key={tier} value={tier}>
                        {tier}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAddPlayer}
            disabled={addPlayerMutation.isPending || !playerUUID}
            className="flex-1"
          >
            {addPlayerMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Adding...
              </>
            ) : (
              "Add Player"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
