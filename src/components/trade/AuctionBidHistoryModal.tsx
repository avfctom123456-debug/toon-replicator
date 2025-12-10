import { useState } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuctionBids, Auction } from "@/hooks/useAuctions";
import { getCardById } from "@/lib/gameEngine";
import { MiniCard } from "@/components/MiniCard";
import { Coins, Clock, History, User, TrendingUp } from "lucide-react";

interface AuctionBidHistoryModalProps {
  auction: Auction;
  trigger?: React.ReactNode;
}

export function AuctionBidHistoryModal({ auction, trigger }: AuctionBidHistoryModalProps) {
  const [open, setOpen] = useState(false);
  const { bids, loading } = useAuctionBids(open ? auction.id : null);
  
  const card = getCardById(auction.card_id);

  const formatTimestamp = (timestamp: string) => {
    return format(new Date(timestamp), "MMM d, h:mm:ss a");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="gap-1">
            <History className="h-4 w-4" />
            History
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Bid History
          </DialogTitle>
        </DialogHeader>

        {/* Card Info */}
        {card && (
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <MiniCard card={card} size="md" copyNumber={auction.copy_number} />
            <div>
              <h3 className="font-bold text-foreground">
                {card.title}
                {auction.copy_number && (
                  <span className={`ml-1 text-sm ${
                    auction.copy_number <= 10 ? "text-yellow-500" :
                    auction.copy_number <= 50 ? "text-gray-400" : "text-muted-foreground"
                  }`}>
                    #{auction.copy_number}
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <User className="h-3 w-3" />
                Seller: {auction.seller_username}
              </div>
              <div className="flex items-center gap-1 text-sm text-yellow-500 mt-1">
                <TrendingUp className="h-4 w-4" />
                Current: {auction.current_bid || auction.starting_bid}
                <Coins className="h-4 w-4" />
              </div>
            </div>
          </div>
        )}

        {/* Bid History */}
        <div className="mt-2">
          <h4 className="text-sm font-semibold text-muted-foreground mb-2">
            {bids.length} Bid{bids.length !== 1 ? "s" : ""}
          </h4>
          
          {loading ? (
            <div className="text-center text-muted-foreground py-4">Loading...</div>
          ) : bids.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 bg-muted/30 rounded-lg">
              No bids yet
            </div>
          ) : (
            <ScrollArea className="h-[250px]">
              <div className="space-y-2 pr-4">
                {bids.map((bid, index) => (
                  <div 
                    key={bid.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      index === 0 
                        ? "bg-yellow-500/10 border border-yellow-500/30" 
                        : "bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        index === 0 ? "bg-yellow-500 text-black" : "bg-muted text-muted-foreground"
                      }`}>
                        {index === 0 ? "👑" : index + 1}
                      </div>
                      <div>
                        <div className="font-medium text-foreground text-sm">
                          {bid.username}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatTimestamp(bid.created_at)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 font-bold text-yellow-500">
                      {bid.bid_amount}
                      <Coins className="h-4 w-4" />
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}