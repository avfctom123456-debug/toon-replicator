import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Search, Plus, Check } from "lucide-react";
import { useCardOverrides } from "@/hooks/useCardOverrides";

const IMAGE_BASE_URL = "https://dlgjmqnjzepntvfeqfcx.supabase.co/storage/v1/object/public/card-images";

interface CardWithCopy {
  id: number;
  title: string;
  userCardId: string;
  copyNumber: number | null;
  basePoints?: number;
  colors?: string[];
}

interface CardPickerModalProps {
  cards: CardWithCopy[];
  selectedIds: string[];
  onSelect: (userCardId: string) => void;
  maxCards?: number;
  trigger?: React.ReactNode;
}

export function CardPickerModal({ 
  cards, 
  selectedIds, 
  onSelect, 
  maxCards = 12,
  trigger 
}: CardPickerModalProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { getOverride } = useCardOverrides();

  const filteredCards = cards.filter(card => 
    card.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (userCardId: string) => {
    if (selectedIds.includes(userCardId)) {
      // Already selected, do nothing (removal handled elsewhere)
      return;
    }
    if (selectedIds.length >= maxCards) {
      return;
    }
    onSelect(userCardId);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Add Cards ({selectedIds.length}/{maxCards})
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0 bg-card border-border">
        <DialogHeader className="p-4 pb-2 border-b">
          <DialogTitle className="flex items-center justify-between">
            <span>Select Cards</span>
            <span className="text-sm font-normal text-muted-foreground">
              {selectedIds.length}/{maxCards} selected
            </span>
          </DialogTitle>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search cards..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </DialogHeader>
        
        <ScrollArea className="h-[60vh] p-4">
          {filteredCards.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No cards found
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {filteredCards.map((card) => {
                const isSelected = selectedIds.includes(card.userCardId);
                const imageUrl = getOverride(card.id)?.custom_image_url || `${IMAGE_BASE_URL}/${card.id}.jpg`;
                const isFull = selectedIds.length >= maxCards && !isSelected;

                return (
                  <button
                    key={card.userCardId}
                    onClick={() => handleSelect(card.userCardId)}
                    disabled={isFull}
                    className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                      isSelected 
                        ? "border-primary ring-2 ring-primary/50" 
                        : isFull
                          ? "border-muted opacity-50 cursor-not-allowed"
                          : "border-transparent hover:border-primary/50"
                    }`}
                  >
                    {/* Card Image */}
                    <div className="aspect-square bg-gradient-to-br from-gray-800 to-gray-900 relative">
                      <img 
                        src={imageUrl}
                        alt={card.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `${IMAGE_BASE_URL}/${card.id}.jpg`;
                        }}
                      />
                      
                      {/* Selection indicator */}
                      {isSelected && (
                        <div className="absolute inset-0 bg-primary/30 flex items-center justify-center">
                          <div className="bg-primary rounded-full p-1">
                            <Check className="h-4 w-4 text-primary-foreground" />
                          </div>
                        </div>
                      )}

                      {/* Copy number badge */}
                      {card.copyNumber && (
                        <div className={`absolute top-1 right-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          card.copyNumber <= 10 
                            ? "bg-yellow-500 text-yellow-950" 
                            : card.copyNumber <= 50 
                              ? "bg-gray-400 text-gray-900"
                              : "bg-black/60 text-white"
                        }`}>
                          #{card.copyNumber}
                        </div>
                      )}
                    </div>

                    {/* Card name */}
                    <div className="p-1.5 bg-background">
                      <p className="text-[10px] sm:text-xs font-medium truncate text-center">
                        {card.title}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <div className="p-4 border-t bg-muted/30">
          <Button 
            onClick={() => setOpen(false)} 
            className="w-full"
          >
            Done ({selectedIds.length} cards selected)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
