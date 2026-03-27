import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";

interface SearchPlayersProps {
  onPlayerSelect: (playerId: number, playerName: string) => void;
}

export function SearchPlayers({ onPlayerSelect }: SearchPlayersProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  const searchQuery = trpc.leaderboard.searchPlayers.useQuery(
    { query },
    { enabled: query.length > 0 }
  );

  useEffect(() => {
    if (searchQuery.data) {
      setResults(searchQuery.data);
    }
  }, [searchQuery.data]);

  const handleSelect = (playerId: number, playerName: string) => {
    onPlayerSelect(playerId, playerName);
    setQuery("");
    setResults([]);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search players..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="pl-10 pr-10"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setResults([]);
              setIsOpen(false);
            }}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {isOpen && query.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          {searchQuery.isLoading ? (
            <div className="p-4 text-center text-muted-foreground">
              Searching...
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              No players found
            </div>
          ) : (
            <div className="divide-y divide-border">
              {results.map((result) => (
                <button
                  key={`${result.player.id}-${result.gamemode.id}`}
                  onClick={() => handleSelect(result.player.id, result.player.name)}
                  className="w-full px-4 py-3 text-left hover:bg-muted transition-colors flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium text-foreground">
                      {result.player.name}
                      {result.playerGamemode.isRetired ? (
                        <span className="ml-2 text-xs bg-muted text-muted-foreground px-2 py-1 rounded">
                          (R)
                        </span>
                      ) : null}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {result.gamemode.name} • {result.playerGamemode.tier}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
