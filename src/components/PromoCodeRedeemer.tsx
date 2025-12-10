import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Ticket, Gift, Coins } from "lucide-react";
import { getCardById } from "@/lib/gameEngine";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface PromoCodeRedeemerProps {
  onSuccess?: () => void;
}

export function PromoCodeRedeemer({ onSuccess }: PromoCodeRedeemerProps) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);

  const handleRedeem = async () => {
    if (!code.trim()) {
      toast.error("Please enter a promo code");
      return;
    }

    setRedeeming(true);
    try {
      const { data, error } = await supabase.rpc("redeem_promo_code", {
        p_code: code.trim(),
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; reward_type?: string; reward_value?: number };

      if (!result.success) {
        toast.error(result.error || "Failed to redeem code");
        return;
      }

      if (result.reward_type === "coins") {
        toast.success(`Redeemed ${result.reward_value} coins!`, {
          icon: <Coins className="h-5 w-5 text-yellow-500" />,
        });
      } else if (result.reward_type === "card") {
        const card = getCardById(result.reward_value!);
        toast.success(`Redeemed card: ${card?.title || `Card #${result.reward_value}`}!`, {
          icon: <Gift className="h-5 w-5 text-primary" />,
        });
      }

      setCode("");
      setOpen(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error redeeming code:", error);
      toast.error("Failed to redeem code");
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Ticket className="h-4 w-4" />
          Redeem Code
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5" />
            Redeem Promo Code
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Enter promo code..."
              className="text-center text-lg tracking-widest uppercase"
              maxLength={20}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRedeem();
              }}
            />
          </div>
          <Button
            onClick={handleRedeem}
            className="w-full"
            disabled={!code.trim() || redeeming}
          >
            {redeeming ? "Redeeming..." : "Redeem"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
