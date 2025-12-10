import { useParams, Link } from 'react-router-dom';
import { Trophy, Users, Coins, Clock, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTournamentDetails } from '@/hooks/useTournaments';
import { TournamentBracket } from '@/components/tournament/TournamentBracket';
import { format } from 'date-fns';

const statusColors: Record<string, string> = {
  upcoming: 'bg-blue-500/20 text-blue-400',
  active: 'bg-green-500/20 text-green-400',
  completed: 'bg-gray-500/20 text-gray-400',
  cancelled: 'bg-red-500/20 text-red-400',
};

const TournamentView = () => {
  const { id } = useParams<{ id: string }>();
  const { tournament, participants, matches } = useTournamentDetails(id || '');

  if (!tournament) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Tournament not found</p>
          <Link to="/tournaments">
            <Button variant="link">Back to Tournaments</Button>
          </Link>
        </div>
      </div>
    );
  }

  const totalRounds = matches.length > 0 ? Math.max(...matches.map(m => m.round)) : 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <Link to="/tournaments" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to Tournaments
        </Link>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Tournament Info */}
          <Card className="lg:col-span-1 bg-card/50 border-border/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-6 h-6 text-yellow-500" />
                  {tournament.name}
                </CardTitle>
                <Badge className={statusColors[tournament.status]}>
                  {tournament.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {tournament.description && (
                <p className="text-muted-foreground">{tournament.description}</p>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Users className="w-4 h-4" /> Players
                  </span>
                  <span>{tournament.current_participants}/{tournament.max_participants}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Coins className="w-4 h-4 text-yellow-500" /> Entry Fee
                  </span>
                  <span>{tournament.entry_fee} coins</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-yellow-500" /> Prize Pool
                  </span>
                  <span className="font-bold text-yellow-500">{tournament.prize_pool} coins</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Starts
                  </span>
                  <span>{format(new Date(tournament.starts_at), 'MMM d, h:mm a')}</span>
                </div>
                {totalRounds > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Round</span>
                    <span>{tournament.current_round}/{totalRounds}</span>
                  </div>
                )}
              </div>

              {/* Participants List */}
              <div className="pt-4 border-t border-border/50">
                <h3 className="font-semibold mb-3">Participants</h3>
                {participants.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No participants yet</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {participants.map((p, i) => (
                      <div 
                        key={p.id} 
                        className={`flex items-center justify-between p-2 rounded-lg ${
                          p.eliminated ? 'bg-red-500/10 opacity-50' : 'bg-muted/30'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-4">
                            {p.seed || i + 1}
                          </span>
                          <span className={p.eliminated ? 'line-through' : ''}>
                            {p.username}
                          </span>
                        </div>
                        {p.placement && (
                          <Badge variant="secondary">#{p.placement}</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Bracket */}
          <Card className="lg:col-span-2 bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle>Bracket</CardTitle>
            </CardHeader>
            <CardContent>
              {matches.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Trophy className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>Bracket will be generated when the tournament starts</p>
                </div>
              ) : (
                <TournamentBracket matches={matches} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TournamentView;
