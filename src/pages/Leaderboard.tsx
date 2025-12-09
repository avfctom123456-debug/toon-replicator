import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLeaderboard, usePlayerStats } from "@/hooks/usePlayerStats";
import { useSeasons, useSeasonStats, REWARD_TIERS, getTierForRank } from "@/hooks/useSeasons";
import { useUserRole } from "@/hooks/useUserRole";
import { useEndSeason } from "@/hooks/useSeasons";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { 
  ArrowLeft, Trophy, Medal, Award, TrendingUp, Swords, Bot, 
  Calendar, Coins, Crown, ChevronDown, ChevronUp, Gift
} from "lucide-react";

const Leaderboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { leaderboard, loading: leaderboardLoading, refetchLeaderboard } = useLeaderboard(100);
  const { stats: myStats } = usePlayerStats();
  const { currentSeason, pastSeasons, loading: seasonsLoading, refetchSeasons } = useSeasons();
  const { isAdmin } = useUserRole();
  const { endSeason, loading: endingSeasonLoading } = useEndSeason();
  
  const [showRewardTiers, setShowRewardTiers] = useState(false);
  const [selectedPastSeason, setSelectedPastSeason] = useState<string | null>(null);
  const { stats: pastSeasonStats, loading: pastStatsLoading } = useSeasonStats(selectedPastSeason);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-5 h-5 text-purple-400" />;
    if (rank === 2) return <Trophy className="w-5 h-5 text-cyan-400" />;
    if (rank === 3) return <Medal className="w-5 h-5 text-yellow-400" />;
    if (rank <= 5) return <Award className="w-5 h-5 text-cyan-400" />;
    return <span className="w-5 text-center text-muted-foreground font-mono">#{rank}</span>;
  };

  const getWinRate = (wins: number, losses: number, draws: number) => {
    const total = wins + losses + draws;
    if (total === 0) return "0%";
    return `${Math.round((wins / total) * 100)}%`;
  };

  const myRank = leaderboard.findIndex((e) => e.user_id === user.id) + 1;
  const myTier = myRank > 0 ? getTierForRank(myRank) : null;

  const handleEndSeason = async () => {
    if (!confirm("Are you sure you want to end the current season? This will distribute rewards to all ranked players and reset their stats.")) {
      return;
    }

    const result = await endSeason();
    if (result.success) {
      toast.success("Season ended! Rewards distributed and new season started.");
      refetchSeasons();
      refetchLeaderboard();
    } else {
      toast.error("Failed to end season");
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", { 
      month: "short", 
      day: "numeric", 
      year: "numeric" 
    });
  };

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
          <div className="flex items-center gap-2 flex-1">
            <Trophy className="w-6 h-6 text-yellow-400" />
            <h1 className="text-xl font-bold text-white">Leaderboard</h1>
          </div>
          {currentSeason && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-[hsl(200,50%,70%)]" />
              <span className="text-[hsl(200,50%,70%)]">{currentSeason.name}</span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {/* Season Info & Reward Tiers */}
        <div className="bg-[hsl(220,50%,18%)] rounded-xl border border-[hsl(220,40%,30%)] overflow-hidden">
          <button
            onClick={() => setShowRewardTiers(!showRewardTiers)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-purple-400" />
              <span className="font-semibold text-white">Season Rewards</span>
              {myTier && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${myTier.bgColor} ${myTier.color}`}>
                  Your Tier: {myTier.name}
                </span>
              )}
            </div>
            {showRewardTiers ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </button>

          {showRewardTiers && (
            <div className="px-4 pb-4 space-y-2">
              <p className="text-xs text-muted-foreground mb-3">
                At the end of each season, players receive coin rewards based on their final rank.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(REWARD_TIERS).map(([key, tier]) => (
                  <div
                    key={key}
                    className={`p-3 rounded-lg border ${tier.bgColor} border-opacity-30 ${
                      myTier?.name === tier.name ? "ring-2 ring-primary" : ""
                    }`}
                  >
                    <div className={`font-bold ${tier.color}`}>{tier.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Rank {tier.minRank}{tier.maxRank ? `-${tier.maxRank}` : "+"}
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <Coins className="w-3 h-3 text-yellow-400" />
                      <span className="text-sm text-yellow-400 font-bold">{tier.coins}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

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

        {/* Current Leaderboard */}
        <div className="bg-[hsl(220,50%,18%)] rounded-xl border border-[hsl(220,40%,30%)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[hsl(220,40%,25%)] flex items-center justify-between">
            <h2 className="font-semibold text-white">Current Rankings</h2>
            {isAdmin && (
              <Button
                size="sm"
                variant="destructive"
                onClick={handleEndSeason}
                disabled={endingSeasonLoading}
              >
                {endingSeasonLoading ? "Ending..." : "End Season"}
              </Button>
            )}
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
                const tier = getTierForRank(entry.rank);
                return (
                  <div
                    key={entry.id}
                    className={`grid grid-cols-12 gap-2 px-4 py-3 items-center ${
                      isMe ? "bg-primary/10" : "hover:bg-white/5"
                    }`}
                  >
                    <div className="col-span-1 flex items-center">{getRankIcon(entry.rank)}</div>
                    <div className="col-span-4">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${isMe ? "text-primary" : "text-white"}`}>
                          {entry.username}
                        </span>
                        {isMe && <span className="text-xs text-primary">(You)</span>}
                      </div>
                      <span className={`text-[10px] ${tier.color}`}>{tier.name}</span>
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

        {/* Past Seasons */}
        {pastSeasons.length > 0 && (
          <div className="bg-[hsl(220,50%,18%)] rounded-xl border border-[hsl(220,40%,30%)] overflow-hidden">
            <div className="px-4 py-3 border-b border-[hsl(220,40%,25%)]">
              <h2 className="font-semibold text-white">Past Seasons</h2>
            </div>
            <div className="p-4 space-y-2">
              {pastSeasons.map((season) => (
                <button
                  key={season.id}
                  onClick={() => setSelectedPastSeason(
                    selectedPastSeason === season.id ? null : season.id
                  )}
                  className={`w-full p-3 rounded-lg border text-left transition-colors ${
                    selectedPastSeason === season.id
                      ? "bg-primary/10 border-primary"
                      : "bg-[hsl(220,50%,15%)] border-[hsl(220,40%,25%)] hover:border-[hsl(220,40%,35%)]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-white">{season.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(season.start_date)} - {season.end_date ? formatDate(season.end_date) : "Ongoing"}
                      </div>
                    </div>
                    {selectedPastSeason === season.id ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Past Season Stats */}
            {selectedPastSeason && (
              <div className="border-t border-[hsl(220,40%,25%)]">
                {pastStatsLoading ? (
                  <div className="p-4 text-center text-muted-foreground">Loading...</div>
                ) : pastSeasonStats.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">No data for this season</div>
                ) : (
                  <div className="divide-y divide-[hsl(220,40%,22%)]">
                    {pastSeasonStats.slice(0, 20).map((stat) => {
                      const tier = getTierForRank(stat.final_rank);
                      const isMe = stat.user_id === user.id;
                      return (
                        <div
                          key={stat.id}
                          className={`grid grid-cols-12 gap-2 px-4 py-3 items-center ${
                            isMe ? "bg-primary/10" : ""
                          }`}
                        >
                          <div className="col-span-1">{getRankIcon(stat.final_rank)}</div>
                          <div className="col-span-4">
                            <span className={`font-medium ${isMe ? "text-primary" : "text-white"}`}>
                              {stat.username}
                            </span>
                            <span className={`text-[10px] ml-2 ${tier.color}`}>{tier.name}</span>
                          </div>
                          <div className="col-span-2 text-center">
                            <span className="font-bold text-yellow-400">{stat.final_elo}</span>
                          </div>
                          <div className="col-span-2 text-center">
                            <span className="text-green-400">{stat.pvp_wins}</span>
                            <span className="text-muted-foreground mx-1">-</span>
                            <span className="text-red-400">{stat.pvp_losses}</span>
                          </div>
                          <div className="col-span-3 text-right flex items-center justify-end gap-1">
                            <Coins className="w-3 h-3 text-yellow-400" />
                            <span className="text-yellow-400 font-bold">+{stat.reward_coins}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
