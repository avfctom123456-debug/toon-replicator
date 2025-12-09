import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLeaderboard, usePlayerStats } from "@/hooks/usePlayerStats";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trophy, Medal, Award, TrendingUp, Swords, Bot } from "lucide-react";

const Leaderboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { leaderboard, loading: leaderboardLoading } = useLeaderboard(100);
  const { stats: myStats, loading: statsLoading } = usePlayerStats();

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-400" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-300" />;
    if (rank === 3) return <Award className="w-5 h-5 text-amber-600" />;
    return <span className="w-5 text-center text-muted-foreground font-mono">#{rank}</span>;
  };

  const getWinRate = (wins: number, losses: number, draws: number) => {
    const total = wins + losses + draws;
    if (total === 0) return "0%";
    return `${Math.round((wins / total) * 100)}%`;
  };

  const myRank = leaderboard.findIndex((e) => e.user_id === user.id) + 1;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[hsl(220,60%,12%)] to-[hsl(220,50%,8%)]">
      {/* Header */}
      <div className="bg-[hsl(220,50%,15%)] border-b border-[hsl(220,40%,25%)] px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/home")}
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Trophy className="w-6 h-6 text-yellow-400" />
            <h1 className="text-xl font-bold text-white">Leaderboard</h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* My Stats Card */}
        {myStats && (
          <div className="bg-[hsl(220,50%,18%)] rounded-xl border border-[hsl(220,40%,30%)] p-4">
            <h2 className="text-sm font-semibold text-[hsl(200,30%,70%)] mb-3">Your Stats</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{myRank > 0 ? `#${myRank}` : "-"}</div>
                <div className="text-xs text-muted-foreground">Rank</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-400">{myStats.elo_rating}</div>
                <div className="text-xs text-muted-foreground">ELO Rating</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">
                  {myStats.pvp_wins}-{myStats.pvp_losses}
                </div>
                <div className="text-xs text-muted-foreground">PVP W/L</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-400">{myStats.best_win_streak}</div>
                <div className="text-xs text-muted-foreground">Best Streak</div>
              </div>
            </div>
          </div>
        )}

        {/* Leaderboard Table */}
        <div className="bg-[hsl(220,50%,18%)] rounded-xl border border-[hsl(220,40%,30%)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[hsl(220,40%,25%)]">
            <h2 className="font-semibold text-white">Top Players</h2>
          </div>

          {leaderboardLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading leaderboard...</div>
          ) : leaderboard.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No players yet. Be the first to play!
            </div>
          ) : (
            <div className="divide-y divide-[hsl(220,40%,22%)]">
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-semibold text-muted-foreground bg-[hsl(220,50%,15%)]">
                <div className="col-span-1">Rank</div>
                <div className="col-span-4">Player</div>
                <div className="col-span-2 text-center">ELO</div>
                <div className="col-span-2 text-center hidden sm:block">
                  <Swords className="w-3 h-3 inline mr-1" />
                  PVP
                </div>
                <div className="col-span-1 text-center hidden sm:block">
                  <Bot className="w-3 h-3 inline" />
                </div>
                <div className="col-span-2 text-center">Win %</div>
              </div>

              {/* Rows */}
              {leaderboard.map((entry) => {
                const isMe = entry.user_id === user.id;
                return (
                  <div
                    key={entry.id}
                    className={`grid grid-cols-12 gap-2 px-4 py-3 items-center ${
                      isMe ? "bg-primary/10" : "hover:bg-white/5"
                    }`}
                  >
                    <div className="col-span-1 flex items-center">{getRankIcon(entry.rank)}</div>
                    <div className="col-span-4">
                      <span className={`font-medium ${isMe ? "text-primary" : "text-white"}`}>
                        {entry.username}
                      </span>
                      {isMe && <span className="text-xs text-primary ml-2">(You)</span>}
                    </div>
                    <div className="col-span-2 text-center">
                      <span className="font-bold text-yellow-400">{entry.elo_rating}</span>
                    </div>
                    <div className="col-span-2 text-center hidden sm:block">
                      <span className="text-green-400">{entry.pvp_wins}</span>
                      <span className="text-muted-foreground mx-1">-</span>
                      <span className="text-red-400">{entry.pvp_losses}</span>
                    </div>
                    <div className="col-span-1 text-center hidden sm:block text-blue-400">
                      {entry.cpu_wins}
                    </div>
                    <div className="col-span-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <TrendingUp className="w-3 h-3 text-green-400" />
                        <span className="text-white">
                          {getWinRate(entry.pvp_wins, entry.pvp_losses, entry.pvp_draws)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
