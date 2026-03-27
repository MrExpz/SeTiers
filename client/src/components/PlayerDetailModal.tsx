import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, ExternalLink } from "lucide-react";

interface PlayerDetailModalProps {
  playerId: number;
  playerName: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

const TIER_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  HT1: { bg: "#ef4444", text: "white", icon: "❤️" },
  LT1: { bg: "#f97316", text: "white", icon: "🗡️" },
  HT2: { bg: "#eab308", text: "black", icon: "⚔️" },
  LT2: { bg: "#06b6d4", text: "white", icon: "⏱️" },
  HT3: { bg: "#8b5cf6", text: "white", icon: "🔨" },
  LT3: { bg: "#ec4899", text: "white", icon: "🎯" },
  HT4: { bg: "#10b981", text: "white", icon: "✨" },
  LT4: { bg: "#6366f1", text: "white", icon: "💜" },
  HT5: { bg: "#14b8a6", text: "white", icon: "🏆" },
  LT5: { bg: "#6b7280", text: "white", icon: "⭐" },
};

export function PlayerDetailModal({
  playerId,
  playerName,
  isOpen,
  onClose,
  onUpdate,
}: PlayerDetailModalProps) {
  const { user } = useAuth();
  const [editingTier, setEditingTier] = useState<{ gamemodeId: number; tier: string } | null>(null);
  const [newTier, setNewTier] = useState("");

  const profileQuery = trpc.leaderboard.getPlayerProfile.useQuery(
    { playerId },
    { enabled: isOpen && playerId > 0 }
  );

  const playerQuery = trpc.leaderboard.getPlayerDetails.useQuery(
    { playerId },
    { enabled: isOpen && playerId > 0 }
  );

  const updateTierMutation = trpc.admin.updatePlayerTier.useMutation({
    onSuccess: () => {
      profileQuery.refetch();
      playerQuery.refetch();
      setEditingTier(null);
      onUpdate?.();
    },
  });

  const markRetiredMutation = trpc.admin.markRetired.useMutation({
    onSuccess: () => {
      profileQuery.refetch();
      playerQuery.refetch();
      onUpdate?.();
    },
  });

  const removePlayerMutation = trpc.admin.removePlayer.useMutation({
    onSuccess: () => {
      onClose();
      onUpdate?.();
    },
  });

  const removeTierMutation = trpc.admin.removeTier.useMutation({
    onSuccess: () => {
      profileQuery.refetch();
      playerQuery.refetch();
      onUpdate?.();
    },
  });

  const banPlayerMutation = trpc.admin.banPlayer.useMutation({
    onSuccess: () => {
      onClose();
      onUpdate?.();
    },
  });

  if (!isOpen) return null;

  const playerData = playerQuery.data;
  const profileData = profileQuery.data;
  const skinUrl = playerData?.uuid
    ? `https://crafatar.com/avatars/${playerData.uuid}?size=256&overlay`
    : `https://crafatar.com/avatars/8667ba71b358a38582d4e3a244184f6b?size=256&overlay`;

  const namemc = playerData?.uuid
    ? `https://namemc.com/profile/${playerData.uuid}`
    : `https://namemc.com/search?q=${playerName}`;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-700 rounded-lg max-w-md w-full shadow-2xl overflow-hidden">
        {/* Header with Close Button */}
        <div className="relative h-32 bg-gradient-to-r from-blue-900/30 to-purple-900/30 border-b border-slate-700 flex items-center justify-center">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 pb-6">
          {/* Avatar */}
          <div className="flex justify-center -mt-16 mb-4">
            <div className="w-32 h-32 rounded-full border-4 border-slate-800 bg-slate-900 overflow-hidden shadow-lg">
              <img
                src={skinUrl}
                alt={playerName}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "https://crafatar.com/avatars/8667ba71b358a38582d4e3a244184f6b?size=256&overlay";
                }}
              />
            </div>
          </div>

          {/* Player Name */}
          <div className="text-center mb-4">
            <h2 className="text-2xl font-bold text-white mb-2">{playerName}</h2>
            <a
              href={namemc}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-sm transition-colors"
            >
              <span>NameMC</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          {/* Position */}
          {playerData?.position && (
            <div className="mb-4 p-3 rounded bg-slate-800/50 border border-slate-700">
              <div className="text-sm text-slate-400 mb-1">POSITION</div>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center font-bold text-white">
                  {playerData.position}
                </div>
                <div className="text-white font-semibold">
                  {playerData.gamemodeDisplay || "Leaderboard"}
                </div>
              </div>
            </div>
          )}

          {/* Tiers */}
          {profileData && profileData.gamemodes && profileData.gamemodes.length > 0 && (
            <div className="mb-4">
              <div className="text-sm text-slate-400 mb-2">TIERS</div>
              <div className="flex flex-wrap gap-2">
                {profileData.gamemodes.map((gm: any) => {
                  const tierInfo = TIER_COLORS[gm.tier] || TIER_COLORS.LT5;
                  return (
                    <div
                      key={gm.id}
                      className="flex flex-col items-center gap-1 p-2 rounded"
                      style={{ backgroundColor: `${tierInfo.bg}20` }}
                    >
                      <div className="text-lg">{tierInfo.icon}</div>
                      <div
                        className="text-xs font-bold px-2 py-1 rounded"
                        style={{
                          backgroundColor: tierInfo.bg,
                          color: tierInfo.text,
                        }}
                      >
                        {gm.tier}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Admin Actions */}
          {user?.role === "admin" && (
            <div className="space-y-3 mt-6 pt-4 border-t border-slate-700">
              {editingTier ? (
                <div className="space-y-2">
                  <div className="text-sm text-slate-400">
                    Update tier for {editingTier.gamemodeId}
                  </div>
                  <select
                    value={newTier}
                    onChange={(e) => setNewTier(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-white text-sm"
                  >
                    <option value="">Select tier</option>
                    {Object.keys(TIER_COLORS).map((tier) => (
                      <option key={tier} value={tier}>
                        {tier}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        updateTierMutation.mutate({
                          playerId,
                          gamemodeId: editingTier.gamemodeId,
                          newTier,
                        });
                      }}
                      disabled={updateTierMutation.isPending || !newTier}
                      className="flex-1"
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingTier(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => removePlayerMutation.mutate({ playerId })}
                    disabled={removePlayerMutation.isPending}
                    className="w-full"
                  >
                    Remove Player
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => banPlayerMutation.mutate({ playerId })}
                    disabled={banPlayerMutation.isPending}
                    className="w-full"
                  >
                    Ban Player
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
