import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { usePlayerStats, useLeaderboard } from "@/hooks/usePlayerStats";
import { useUserCards } from "@/hooks/useUserCards";
import { useSeasons, useSeasonStats, getTierForRank, REWARD_TIERS } from "@/hooks/useSeasons";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import cardsData from "@/data/cards.json";
import { 
  ArrowLeft, Trophy, Swords, Bot, Target, Flame, 
  Package, Coins, Crown, Library, TrendingUp, Award,
  Calendar, Clock, BarChart3, Layers, Star
} from "lucide-react";

interface CardWin {
  card_id: number;
  wins: number;
}

const PlayerProfile = () => {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId?: string }>();
  const { user, loading: authLoading } = useAuth();
  const { profile } = useProfile();
  const { stats, loading: statsLoading } = usePlayerStats();
  const { userCards } = useUserCards();
  const { leaderboard } = useLeaderboard(100);
  const { pastSeasons } = useSeasons();
  
  const [cardWins, setCardWins] = useState<CardWin[]>([]);
  const [loadingCardWins, setLoadingCardWins] = useState(true);
  
  // Determine if viewing own profile or another user's
  const isOwnProfile = !userId || userId === user?.id;
  const viewingUserId = userId || user?.id;

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const fetchCardWins = async () => {
      if (!viewingUserId) return;
      
      const { data } = await supabase
        .from("card_wins")
        .select("card_id, wins")
        .eq("user_id", viewingUserId)
        .order("wins", { ascending: false })
        .limit(10);
      
      setCardWins(data || []);
      setLoadingCardWins(false);
    };

    fetchCardWins();
  }, [viewingUserId]);

  if (authLoading || statsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  // Calculate stats
  const totalCards = userCards?.length || 0;
  const uniqueCards = new Set(userCards?.map(c => c.card_id)).size;
  const totalCardsInGame = (cardsData as any[]).length;
  const collectionProgress = Math.round((uniqueCards / totalCardsInGame) * 100);
  
  const myRank = leaderboard.findIndex(e => e.user_id === viewingUserId) + 1;
  const myTier = myRank > 0 ? getTierForRank(myRank) : null;
  
  const totalMatches = (stats?.pvp_wins || 0) + (stats?.pvp_losses || 0) + (stats?.pvp_draws || 0);
  const winRate = totalMatches > 0 ? Math.round(((stats?.pvp_wins || 0) / totalMatches) * 100) : 0;
  
  const getCardById = (id: number) => (cardsData as any[]).find(c => c.id === id);

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
            <BarChart3 className="w-6 h-6 text-cyan-400" />
            <h1 className="text-xl font-bold text-white">Player Profile</h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {/* Player Card */}
        <div className="bg-gradient-to-br from-[hsl(220,50%,20%)] to-[hsl(220,50%,15%)] rounded-xl border border-[hsl(220,40%,30%)] p-6">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-cyan-500 flex items-center justify-center text-3xl font-bold text-white">
              {profile?.username?.charAt(0).toUpperCase() || "?"}
            </div>
            
            {/* Info */}
            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-2xl font-bold text-white">{profile?.username || "Player"}</h2>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-2">
                {myTier && (
                  <span className={`text-sm px-3 py-1 rounded-full ${myTier.bgColor} ${myTier.color} font-semibold`}>
                    {myTier.name}
                  </span>
                )}
                {myRank > 0 && (
                  <span className="text-muted-foreground text-sm flex items-center gap-1">
                    <Trophy className="w-4 h-4 text-yellow-400" />
                    Rank #{myRank}
                  </span>
                )}
              </div>
            </div>
            
            {/* Coins */}
            {isOwnProfile && (
              <div className="flex items-center gap-2 bg-yellow-500/20 px-4 py-2 rounded-full">
                <Coins className="w-5 h-5 text-yellow-400" />
                <span className="font-bold text-yellow-400 text-lg">{profile?.coins || 0}</span>
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            icon={<Trophy className="w-5 h-5 text-yellow-400" />}
            label="ELO Rating"
            value={stats?.elo_rating || 1000}
            color="text-yellow-400"
          />
          <StatCard
            icon={<TrendingUp className="w-5 h-5 text-green-400" />}
            label="Win Rate"
            value={`${winRate}%`}
            color="text-green-400"
          />
          <StatCard
            icon={<Flame className="w-5 h-5 text-orange-400" />}
            label="Best Streak"
            value={stats?.best_win_streak || 0}
            color="text-orange-400"
          />
          <StatCard
            icon={<Star className="w-5 h-5 text-purple-400" />}
            label="Highest Score"
            value={stats?.highest_score || 0}
            color="text-purple-400"
          />
        </div>

        {/* Match Statistics */}
        <div className="bg-[hsl(220,50%,18%)] rounded-xl border border-[hsl(220,40%,30%)] p-4">
          <h3 className="text-sm font-semibold text-[hsl(200,30%,70%)] mb-4 flex items-center gap-2">
            <Swords className="w-4 h-4" />
            Match Statistics
          </h3>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div className="text-center p-3 bg-[hsl(220,50%,15%)] rounded-lg">
              <div className="text-2xl font-bold text-green-400">{stats?.pvp_wins || 0}</div>
              <div className="text-xs text-muted-foreground">PVP Wins</div>
            </div>
            <div className="text-center p-3 bg-[hsl(220,50%,15%)] rounded-lg">
              <div className="text-2xl font-bold text-red-400">{stats?.pvp_losses || 0}</div>
              <div className="text-xs text-muted-foreground">PVP Losses</div>
            </div>
            <div className="text-center p-3 bg-[hsl(220,50%,15%)] rounded-lg">
              <div className="text-2xl font-bold text-yellow-400">{stats?.pvp_draws || 0}</div>
              <div className="text-xs text-muted-foreground">Draws</div>
            </div>
            <div className="text-center p-3 bg-[hsl(220,50%,15%)] rounded-lg">
              <div className="text-2xl font-bold text-blue-400">{stats?.cpu_wins || 0}</div>
              <div className="text-xs text-muted-foreground">CPU Wins</div>
            </div>
          </div>

          {/* Additional Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-2 bg-[hsl(220,50%,12%)] rounded-lg">
              <div className="text-lg font-bold text-cyan-400">{stats?.color_wins || 0}</div>
              <div className="text-[10px] text-muted-foreground">Color Bonus Wins</div>
            </div>
            <div className="text-center p-2 bg-[hsl(220,50%,12%)] rounded-lg">
              <div className="text-lg font-bold text-pink-400">{stats?.perfect_wins || 0}</div>
              <div className="text-[10px] text-muted-foreground">Perfect Wins</div>
            </div>
            <div className="text-center p-2 bg-[hsl(220,50%,12%)] rounded-lg">
              <div className="text-lg font-bold text-white">{stats?.win_streak || 0}</div>
              <div className="text-[10px] text-muted-foreground">Current Streak</div>
            </div>
          </div>
        </div>

        {/* Collection Progress */}
        <div className="bg-[hsl(220,50%,18%)] rounded-xl border border-[hsl(220,40%,30%)] p-4">
          <h3 className="text-sm font-semibold text-[hsl(200,30%,70%)] mb-4 flex items-center gap-2">
            <Library className="w-4 h-4" />
            Collection Progress
          </h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Cards Collected</span>
              <span className="text-white font-bold">{uniqueCards} / {totalCardsInGame}</span>
            </div>
            <Progress value={collectionProgress} className="h-3" />
            <p className="text-xs text-muted-foreground text-center">
              {collectionProgress}% Complete • {totalCards} Total Cards Owned
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="text-center p-3 bg-[hsl(220,50%,15%)] rounded-lg">
              <Package className="w-5 h-5 mx-auto mb-1 text-purple-400" />
              <div className="text-lg font-bold text-white">{stats?.packs_opened || 0}</div>
              <div className="text-[10px] text-muted-foreground">Packs Opened</div>
            </div>
            <div className="text-center p-3 bg-[hsl(220,50%,15%)] rounded-lg">
              <Coins className="w-5 h-5 mx-auto mb-1 text-yellow-400" />
              <div className="text-lg font-bold text-white">{stats?.total_coins_earned || 0}</div>
              <div className="text-[10px] text-muted-foreground">Coins Earned</div>
            </div>
          </div>
        </div>

        {/* Top Performing Cards */}
        {cardWins.length > 0 && (
          <div className="bg-[hsl(220,50%,18%)] rounded-xl border border-[hsl(220,40%,30%)] p-4">
            <h3 className="text-sm font-semibold text-[hsl(200,30%,70%)] mb-4 flex items-center gap-2">
              <Award className="w-4 h-4" />
              Top Performing Cards
            </h3>
            
            <div className="space-y-2">
              {cardWins.slice(0, 5).map((cw, idx) => {
                const card = getCardById(cw.card_id);
                if (!card) return null;
                return (
                  <div 
                    key={cw.card_id} 
                    className="flex items-center gap-3 p-2 bg-[hsl(220,50%,15%)] rounded-lg"
                  >
                    <span className={`w-6 text-center font-bold ${
                      idx === 0 ? "text-yellow-400" : 
                      idx === 1 ? "text-gray-300" : 
                      idx === 2 ? "text-orange-400" : "text-muted-foreground"
                    }`}>
                      #{idx + 1}
                    </span>
                    <img 
                      src={card.image} 
                      alt={card.title}
                      className="w-10 h-10 rounded-full object-cover border-2 border-[hsl(220,40%,30%)]"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-white text-sm">{card.title}</div>
                      <div className="text-[10px] text-muted-foreground">{card.color}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-400">{cw.wins}</div>
                      <div className="text-[10px] text-muted-foreground">wins</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Season History */}
        {pastSeasons.length > 0 && (
          <div className="bg-[hsl(220,50%,18%)] rounded-xl border border-[hsl(220,40%,30%)] p-4">
            <h3 className="text-sm font-semibold text-[hsl(200,30%,70%)] mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Season History
            </h3>
            
            <div className="text-center text-muted-foreground text-sm">
              <p>{pastSeasons.length} past season{pastSeasons.length !== 1 ? "s" : ""} completed</p>
              <Button 
                variant="link" 
                className="text-primary mt-1"
                onClick={() => navigate("/leaderboard")}
              >
                View Full Leaderboard →
              </Button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button 
            variant="menu" 
            className="flex-1"
            onClick={() => navigate("/collection")}
          >
            <Library className="w-4 h-4 mr-2" />
            View Collection
          </Button>
          <Button 
            variant="menu" 
            className="flex-1"
            onClick={() => navigate("/leaderboard")}
          >
            <Trophy className="w-4 h-4 mr-2" />
            View Leaderboard
          </Button>
        </div>
      </div>
    </div>
  );
};

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}

const StatCard = ({ icon, label, value, color }: StatCardProps) => (
  <div className="bg-[hsl(220,50%,18%)] rounded-xl border border-[hsl(220,40%,30%)] p-3 text-center">
    <div className="flex justify-center mb-1">{icon}</div>
    <div className={`text-xl font-bold ${color}`}>{value}</div>
    <div className="text-[10px] text-muted-foreground">{label}</div>
  </div>
);

export default PlayerProfile;