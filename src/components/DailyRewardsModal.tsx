import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar, Gift, Coins, CheckCircle, Flame } from "lucide-react";
import { getCardById } from "@/lib/gameEngine";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface DailyReward {
  id: string;
  day_number: number;
  reward_type: "coins" | "card";
  reward_value: number;
}

interface UserStreak {
  current_streak: number;
  last_claim_date: string | null;
  total_claims: number;
}

export function DailyRewardsModal() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [rewards, setRewards] = useState<DailyReward[]>([]);
  const [streak, setStreak] = useState<UserStreak | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [canClaim, setCanClaim] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && user) {
      fetchData();
    }
  }, [open, user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch rewards
      const { data: rewardsData, error: rewardsError } = await supabase
        .from("daily_login_rewards")
        .select("*")
        .order("day_number", { ascending: true });

      if (rewardsError) throw rewardsError;
      setRewards((rewardsData || []) as DailyReward[]);

      // Fetch user streak
      const { data: streakData, error: streakError } = await supabase
        .from("user_login_streaks")
        .select("current_streak, last_claim_date, total_claims")
        .eq("user_id", user?.id)
        .maybeSingle();

      if (streakError) throw streakError;
      setStreak(streakData);

      // Check if can claim today
      const today = new Date().toISOString().split("T")[0];
      setCanClaim(!streakData?.last_claim_date || streakData.last_claim_date !== today);
    } catch (error) {
      console.error("Error fetching daily rewards data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async () => {
    setClaiming(true);
    try {
      const { data, error } = await supabase.rpc("claim_daily_reward");

      if (error) throw error;

      const result = data as { success: boolean; error?: string; reward_type?: string; reward_value?: number; streak?: number };

      if (!result.success) {
        toast.error(result.error || "Failed to claim reward");
        return;
      }

      if (result.reward_type === "coins") {
        toast.success(`Claimed ${result.reward_value} coins! 🎉`, {
          description: `Day ${result.streak} streak!`,
        });
      } else if (result.reward_type === "card") {
        const card = getCardById(result.reward_value!);
        toast.success(`Claimed ${card?.title || "a card"}! 🎉`, {
          description: `Day ${result.streak} streak!`,
        });
      }

      setCanClaim(false);
      fetchData();
    } catch (error) {
      console.error("Error claiming reward:", error);
      toast.error("Failed to claim reward");
    } finally {
      setClaiming(false);
    }
  };

  const getCurrentDay = () => {
    if (!streak) return 1;
    const today = new Date().toISOString().split("T")[0];
    if (streak.last_claim_date === today) {
      return streak.current_streak;
    }
    // If yesterday, next would be streak + 1
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];
    if (streak.last_claim_date === yesterdayStr) {
      return streak.current_streak + 1;
    }
    // Streak broken, start at 1
    return 1;
  };

  const getDisplayDay = (dayNum: number) => {
    const currentDay = getCurrentDay();
    const maxDay = rewards.length;
    if (maxDay === 0) return { claimed: false, current: false };
    
    const effectiveCurrentDay = currentDay > maxDay ? ((currentDay - 1) % maxDay) + 1 : currentDay;
    const today = new Date().toISOString().split("T")[0];
    const claimedToday = streak?.last_claim_date === today;
    
    return {
      claimed: claimedToday ? dayNum <= effectiveCurrentDay : dayNum < effectiveCurrentDay,
      current: dayNum === effectiveCurrentDay,
    };
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 relative">
          <Calendar className="h-4 w-4" />
          Daily
          {canClaim && (
            <span className="absolute -top-1 -right-1 h-3 w-3 bg-primary rounded-full animate-pulse" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" />
            Daily Login Rewards
          </DialogTitle>
        </DialogHeader>
        
        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Loading...</div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Streak Info */}
            <div className="flex items-center justify-center gap-4 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-orange-500" />
                <span className="font-bold text-lg">{streak?.current_streak || 0}</span>
                <span className="text-muted-foreground">day streak</span>
              </div>
              <div className="text-muted-foreground">•</div>
              <div className="text-muted-foreground text-sm">
                {streak?.total_claims || 0} total claims
              </div>
            </div>

            {/* Rewards Grid */}
            <div className="grid grid-cols-7 gap-2">
              {rewards.map((reward) => {
                const { claimed, current } = getDisplayDay(reward.day_number);
                const card = reward.reward_type === "card" ? getCardById(reward.reward_value) : null;
                
                return (
                  <div
                    key={reward.id}
                    className={`relative flex flex-col items-center p-2 rounded-lg border transition-all ${
                      current
                        ? "border-primary bg-primary/10 ring-2 ring-primary"
                        : claimed
                        ? "border-green-500/50 bg-green-500/10"
                        : "border-border bg-card"
                    }`}
                  >
                    <span className="text-xs font-medium text-muted-foreground">
                      Day {reward.day_number}
                    </span>
                    <div className="my-1">
                      {reward.reward_type === "coins" ? (
                        <Coins className="h-5 w-5 text-yellow-500" />
                      ) : (
                        <Gift className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <span className="text-xs font-bold">
                      {reward.reward_type === "coins" 
                        ? reward.reward_value 
                        : card?.title?.slice(0, 6) || "Card"}
                    </span>
                    {claimed && (
                      <CheckCircle className="absolute -top-1 -right-1 h-4 w-4 text-green-500 bg-background rounded-full" />
                    )}
                  </div>
                );
              })}
            </div>

            {rewards.length === 0 && (
              <p className="text-center text-muted-foreground py-4">
                No rewards configured yet
              </p>
            )}

            {/* Claim Button */}
            {rewards.length > 0 && (
              <Button
                onClick={handleClaim}
                className="w-full"
                disabled={!canClaim || claiming}
                size="lg"
              >
                {claiming ? "Claiming..." : canClaim ? "Claim Today's Reward!" : "Come Back Tomorrow!"}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
