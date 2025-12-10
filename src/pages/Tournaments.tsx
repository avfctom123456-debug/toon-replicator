import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Users, Coins, Clock, ChevronRight, Plus, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTournaments, Tournament } from '@/hooks/useTournaments';
import { useUserRole } from '@/hooks/useUserRole';
import { CreateTournamentModal } from '@/components/tournament/CreateTournamentModal';
import { JoinTournamentModal } from '@/components/tournament/JoinTournamentModal';
import { format } from 'date-fns';

const statusColors: Record<string, string> = {
  upcoming: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  completed: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const TournamentCard = ({ 
  tournament, 
  isJoined, 
  onJoin, 
  onLeave,
  onStart,
  isAdmin,
}: { 
  tournament: Tournament; 
  isJoined: boolean;
  onJoin: () => void;
  onLeave: () => void;
  onStart: () => void;
  isAdmin: boolean;
}) => {
  const isFull = tournament.current_participants >= tournament.max_participants;
  const canJoin = tournament.status === 'upcoming' && !isJoined && !isFull;
  const canLeave = tournament.status === 'upcoming' && isJoined;
  const canStart = isAdmin && tournament.status === 'upcoming' && tournament.current_participants >= 2;

  return (
    <Card className="bg-card/50 border-border/50 hover:border-primary/30 transition-all">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              {tournament.name}
            </CardTitle>
            {tournament.description && (
              <p className="text-sm text-muted-foreground mt-1">{tournament.description}</p>
            )}
          </div>
          <Badge className={statusColors[tournament.status]}>
            {tournament.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="w-4 h-4" />
            <span>{tournament.current_participants}/{tournament.max_participants} players</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Coins className="w-4 h-4 text-yellow-500" />
            <span>{tournament.entry_fee} entry</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Trophy className="w-4 h-4 text-yellow-500" />
            <span>{tournament.prize_pool} prize pool</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>{format(new Date(tournament.starts_at), 'MMM d, h:mm a')}</span>
          </div>
        </div>

        <div className="flex gap-2">
          {canJoin && (
            <Button onClick={onJoin} className="flex-1">
              Join Tournament
            </Button>
          )}
          {canLeave && (
            <Button onClick={onLeave} variant="outline" className="flex-1">
              Leave
            </Button>
          )}
          {isJoined && tournament.status !== 'upcoming' && (
            <Badge variant="secondary" className="flex-1 justify-center py-2">
              Participating
            </Badge>
          )}
          {canStart && (
            <Button onClick={onStart} variant="secondary" className="gap-1">
              <Play className="w-4 h-4" /> Start
            </Button>
          )}
          <Link to={`/tournament/${tournament.id}`}>
            <Button variant="ghost" size="icon">
              <ChevronRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};

const Tournaments = () => {
  const { tournaments, isLoading, joinTournament, leaveTournament, startTournament, isJoined } = useTournaments();
  const { isAdmin } = useUserRole();
  const [showCreate, setShowCreate] = useState(false);
  const [joiningTournament, setJoiningTournament] = useState<Tournament | null>(null);

  const upcomingTournaments = tournaments.filter(t => t.status === 'upcoming');
  const activeTournaments = tournaments.filter(t => t.status === 'active');
  const pastTournaments = tournaments.filter(t => t.status === 'completed' || t.status === 'cancelled');

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Trophy className="w-8 h-8 text-yellow-500" />
              Tournaments
            </h1>
            <p className="text-muted-foreground mt-1">
              Compete for glory and prizes
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/home">
              <Button variant="outline">Back to Home</Button>
            </Link>
            {isAdmin && (
              <Button onClick={() => setShowCreate(true)} className="gap-2">
                <Plus className="w-4 h-4" /> Create Tournament
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading tournaments...</div>
        ) : (
          <div className="space-y-8">
            {activeTournaments.length > 0 && (
              <section>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  Active Tournaments
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {activeTournaments.map(t => (
                    <TournamentCard
                      key={t.id}
                      tournament={t}
                      isJoined={isJoined(t.id)}
                      onJoin={() => setJoiningTournament(t)}
                      onLeave={() => leaveTournament.mutate(t.id)}
                      onStart={() => startTournament.mutate(t.id)}
                      isAdmin={isAdmin}
                    />
                  ))}
                </div>
              </section>
            )}

            {upcomingTournaments.length > 0 && (
              <section>
                <h2 className="text-xl font-semibold mb-4">Upcoming Tournaments</h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {upcomingTournaments.map(t => (
                    <TournamentCard
                      key={t.id}
                      tournament={t}
                      isJoined={isJoined(t.id)}
                      onJoin={() => setJoiningTournament(t)}
                      onLeave={() => leaveTournament.mutate(t.id)}
                      onStart={() => startTournament.mutate(t.id)}
                      isAdmin={isAdmin}
                    />
                  ))}
                </div>
              </section>
            )}

            {pastTournaments.length > 0 && (
              <section>
                <h2 className="text-xl font-semibold mb-4 text-muted-foreground">Past Tournaments</h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {pastTournaments.map(t => (
                    <TournamentCard
                      key={t.id}
                      tournament={t}
                      isJoined={isJoined(t.id)}
                      onJoin={() => {}}
                      onLeave={() => {}}
                      onStart={() => {}}
                      isAdmin={isAdmin}
                    />
                  ))}
                </div>
              </section>
            )}

            {tournaments.length === 0 && (
              <div className="text-center py-12">
                <Trophy className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No tournaments available</p>
                {isAdmin && (
                  <Button onClick={() => setShowCreate(true)} className="mt-4">
                    Create First Tournament
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <CreateTournamentModal open={showCreate} onOpenChange={setShowCreate} />
      <JoinTournamentModal
        tournament={joiningTournament}
        onClose={() => setJoiningTournament(null)}
        onJoin={(deckCardIds) => {
          if (joiningTournament) {
            joinTournament.mutate({ tournamentId: joiningTournament.id, deckCardIds });
            setJoiningTournament(null);
          }
        }}
      />
    </div>
  );
};

export default Tournaments;
