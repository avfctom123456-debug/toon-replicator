import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTournaments } from '@/hooks/useTournaments';

interface CreateTournamentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateTournamentModal = ({ open, onOpenChange }: CreateTournamentModalProps) => {
  const { createTournament } = useTournaments();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [entryFee, setEntryFee] = useState(100);
  const [maxParticipants, setMaxParticipants] = useState(8);
  const [startsAt, setStartsAt] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createTournament.mutate(
      {
        name,
        description: description || undefined,
        entry_fee: entryFee,
        max_participants: maxParticipants,
        starts_at: new Date(startsAt).toISOString(),
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setName('');
          setDescription('');
          setEntryFee(100);
          setMaxParticipants(8);
          setStartsAt('');
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Tournament</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Tournament Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Weekly Championship"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tournament details..."
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="entryFee">Entry Fee (coins)</Label>
              <Input
                id="entryFee"
                type="number"
                min={0}
                value={entryFee}
                onChange={(e) => setEntryFee(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxParticipants">Max Players</Label>
              <Input
                id="maxParticipants"
                type="number"
                min={2}
                max={64}
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="startsAt">Start Time</Label>
            <Input
              id="startsAt"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createTournament.isPending}>
              {createTournament.isPending ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
