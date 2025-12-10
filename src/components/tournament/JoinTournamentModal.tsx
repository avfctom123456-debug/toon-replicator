import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useDecks } from '@/hooks/useDecks';
import { Tournament } from '@/hooks/useTournaments';
import { Coins } from 'lucide-react';

interface JoinTournamentModalProps {
  tournament: Tournament | null;
  onClose: () => void;
  onJoin: (deckCardIds: number[]) => void;
}

export const JoinTournamentModal = ({ tournament, onClose, onJoin }: JoinTournamentModalProps) => {
  const { decks } = useDecks();
  const [selectedDeckSlot, setSelectedDeckSlot] = useState<string | null>(null);

  const validDecks = decks.filter(d => d.card_ids.length === 7);

  const handleJoin = () => {
    const deck = validDecks.find(d => d.slot === selectedDeckSlot);
    if (deck) {
      onJoin(deck.card_ids);
    }
  };

  if (!tournament) return null;

  return (
    <Dialog open={!!tournament} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Join {tournament.name}</DialogTitle>
          <DialogDescription>
            Select a deck to enter the tournament
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <span className="text-sm text-muted-foreground">Entry Fee</span>
            <span className="flex items-center gap-1 font-semibold">
              <Coins className="w-4 h-4 text-yellow-500" />
              {tournament.entry_fee}
            </span>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Select Deck</p>
            {validDecks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No valid decks found. You need a deck with 7 cards.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {validDecks.map(deck => (
                  <Button
                    key={deck.slot}
                    variant={selectedDeckSlot === deck.slot ? 'default' : 'outline'}
                    className="h-auto py-3"
                    onClick={() => setSelectedDeckSlot(deck.slot)}
                  >
                    <div className="text-center">
                      <div className="font-semibold">Deck {deck.slot}</div>
                      <div className="text-xs opacity-70">{deck.card_ids.length} cards</div>
                    </div>
                  </Button>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleJoin} 
              disabled={!selectedDeckSlot}
            >
              Pay {tournament.entry_fee} & Join
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
