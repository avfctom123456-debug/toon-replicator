import { Link } from 'react-router-dom';
import { Eye } from 'lucide-react';
import { TournamentMatch } from '@/hooks/useTournaments';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TournamentBracketProps {
  matches: TournamentMatch[];
}

const MatchCard = ({ match }: { match: TournamentMatch }) => {
  const isCompleted = match.status === 'completed';
  const isInProgress = match.status === 'in_progress' && match.match_id;
  const player1Won = isCompleted && match.winner_id === match.player1_id;
  const player2Won = isCompleted && match.winner_id === match.player2_id;

  return (
    <div className={cn(
      "bg-muted/30 border rounded-lg p-2 min-w-[160px]",
      isInProgress ? "border-yellow-500/50 bg-yellow-500/5" : "border-border/50"
    )}>
      <div 
        className={cn(
          "flex items-center justify-between p-2 rounded mb-1 transition-colors",
          player1Won && "bg-green-500/20 border border-green-500/30",
          isCompleted && !player1Won && "opacity-50"
        )}
      >
        <span className="text-sm truncate">
          {match.player1_username || (match.player1_id ? 'TBD' : 'BYE')}
        </span>
        {isCompleted && <span className="text-xs ml-2">{match.player1_score}</span>}
      </div>
      <div 
        className={cn(
          "flex items-center justify-between p-2 rounded transition-colors",
          player2Won && "bg-green-500/20 border border-green-500/30",
          isCompleted && !player2Won && "opacity-50"
        )}
      >
        <span className="text-sm truncate">
          {match.player2_username || (match.player2_id ? 'TBD' : 'BYE')}
        </span>
        {isCompleted && <span className="text-xs ml-2">{match.player2_score}</span>}
      </div>
      
      <div className="flex items-center justify-between mt-1">
        <span className="text-xs text-muted-foreground">
          Match {match.match_number}
        </span>
        {isInProgress && match.match_id && (
          <Link to={`/spectate/${match.match_id}`}>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-yellow-500 hover:text-yellow-400">
              <Eye className="w-3 h-3 mr-1" />
              Watch
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
};

export const TournamentBracket = ({ matches }: TournamentBracketProps) => {
  const rounds = matches.reduce((acc, match) => {
    if (!acc[match.round]) acc[match.round] = [];
    acc[match.round].push(match);
    return acc;
  }, {} as Record<number, TournamentMatch[]>);

  const roundNames = (total: number, current: number) => {
    const remaining = total - current + 1;
    if (remaining === 1) return 'Finals';
    if (remaining === 2) return 'Semifinals';
    if (remaining === 3) return 'Quarterfinals';
    return `Round ${current}`;
  };

  const totalRounds = Object.keys(rounds).length;

  return (
    <div className="flex gap-8 overflow-x-auto pb-4">
      {Object.entries(rounds).map(([roundNum, roundMatches]) => (
        <div key={roundNum} className="flex-shrink-0">
          <h4 className="text-sm font-medium text-muted-foreground mb-4 text-center">
            {roundNames(totalRounds, Number(roundNum))}
          </h4>
          <div className="flex flex-col gap-4 justify-around h-full">
            {roundMatches.map(match => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
