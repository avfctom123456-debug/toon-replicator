import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Progress } from "@/components/ui/progress";
import { Coins, TrendingUp } from "lucide-react";

const DAILY_CAP = 2000;

interface DailyStats {
  daily_coins_earned: number;
  last_coin_reset: string;
}

export function DailyEarningsProgress() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from("player_stats")
        .select("daily_coins_earned, last_coin_reset")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!error && data) {
        // Check if reset needed (new day)
        const lastReset = new Date(data.last_coin_reset);
        const today = new Date();
        const isNewDay = lastReset.toDateString() !== today.toDateString();
        
        setStats({
          daily_coins_earned: isNewDay ? 0 : data.daily_coins_earned,
          last_coin_reset: data.last_coin_reset,
        });
      } else {
        // No stats yet
        setStats({ daily_coins_earned: 0, last_coin_reset: new Date().toISOString() });
      }
      setLoading(false);
    };

    fetchStats();
  }, [user]);

  if (loading || !stats) {
    return null;
  }

  const earned = stats.daily_coins_earned;
  const remaining = Math.max(0, DAILY_CAP - earned);
  const progressPercent = (earned / DAILY_CAP) * 100;
  const isCapped = earned >= DAILY_CAP;

  return (
    <div className="bg-card rounded-lg p-4 border border-border">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Daily PVP Earnings</span>
        </div>
        <div className="flex items-center gap-1">
          <Coins className="h-4 w-4 text-yellow-500" />
          <span className={`text-sm font-bold ${isCapped ? "text-orange-400" : "text-yellow-500"}`}>
            {earned.toLocaleString()} / {DAILY_CAP.toLocaleString()}
          </span>
        </div>
      </div>
      
      <Progress value={progressPercent} className="h-2 mb-2" />
      
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          {isCapped ? (
            <span className="text-orange-400">Daily cap reached!</span>
          ) : (
            <>Win: +200 | Loss: +100</>
          )}
        </span>
        <span>
          {remaining > 0 ? `${remaining.toLocaleString()} remaining` : "Resets at midnight"}
        </span>
      </div>
    </div>
  );
}
