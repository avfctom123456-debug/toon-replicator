import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Eye, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useCardOverrides } from '@/hooks/useCardOverrides';
import { getCardById, GameCard, PlacedCard } from '@/lib/gameEngine';
import { cn } from '@/lib/utils';

interface MatchData {
  id: string;
  player1_id: string;
  player2_id: string;
  player1_deck: number[];
  player2_deck: number[];
  phase: string;
  current_turn: string | null;
  winner_id: string | null;
  game_state: {
    player?: {
      board: (PlacedCard | null)[];
      totalPoints: number;
      colorCounts: Record<string, number>;
    };
    opponent?: {
      board: (PlacedCard | null)[];
      totalPoints: number;
      colorCounts: Record<string, number>;
    };
    mainColors?: string[];
    phase?: string;
  };
}

interface PlayerProfile {
  user_id: string;
  username: string;
}

const SpectatorCard = ({ 
  slot, 
  revealed,
  getOverride,
}: { 
  slot: PlacedCard | null; 
  revealed: boolean;
  getOverride: (cardId: number) => any;
}) => {
  if (!slot) {
    return (
      <div className="w-16 h-16 rounded-full bg-muted/30 border border-border/30" />
    );
  }

  const override = getOverride(slot.card.id);
  const imageUrl = override?.custom_image_url || `/cards/${slot.card.id}.png`;

  if (!revealed) {
    return (
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-900 to-blue-700 border-2 border-blue-500/50 flex items-center justify-center">
        <span className="text-2xl">?</span>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "w-16 h-16 rounded-full border-2 overflow-hidden relative",
        slot.cancelled ? "opacity-50 border-red-500/50" : "border-yellow-500/50"
      )}
    >
      <img 
        src={imageUrl}
        alt={slot.card.title}
        className="w-full h-full object-cover"
        onError={(e) => {
          e.currentTarget.src = '/placeholder.svg';
        }}
      />
      {!slot.cancelled && (
        <div className="absolute bottom-0 right-0 bg-black/80 px-1.5 text-xs font-bold rounded-tl">
          {slot.modifiedPoints}
        </div>
      )}
      {slot.cancelled && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <span className="text-red-500 text-lg font-bold">X</span>
        </div>
      )}
    </div>
  );
};

const SpectatorBoard = ({
  board,
  playerName,
  totalPoints,
  colorCounts,
  mainColors,
  isRevealed,
  getOverride,
}: {
  board: (PlacedCard | null)[];
  playerName: string;
  totalPoints: number;
  colorCounts: Record<string, number>;
  mainColors: string[];
  isRevealed: boolean;
  getOverride: (cardId: number) => any;
}) => {
  const colorStyles: Record<string, string> = {
    RED: 'bg-red-500',
    BLUE: 'bg-blue-500',
    GREEN: 'bg-green-500',
    YELLOW: 'bg-yellow-500',
    PURPLE: 'bg-purple-500',
    ORANGE: 'bg-orange-500',
    PINK: 'bg-pink-500',
    SILVER: 'bg-gray-400',
    BLACK: 'bg-gray-900',
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="text-center">
        <h3 className="font-bold">{playerName}</h3>
        <div className="flex items-center justify-center gap-2 mt-1">
          <span className="text-lg font-bold text-yellow-500">{totalPoints} pts</span>
        </div>
        <div className="flex gap-1 justify-center mt-1">
          {Object.entries(colorCounts).map(([color, count]) => (
            <div key={color} className="flex items-center gap-0.5">
              <div className={cn("w-3 h-3 rounded-full", colorStyles[color] || 'bg-gray-500')} />
              <span className={cn(
                "text-xs",
                mainColors.includes(color) && "text-yellow-400 font-bold"
              )}>
                {count}
              </span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Round 1 slots */}
      <div className="flex gap-2">
        {board.slice(0, 4).map((slot, i) => (
          <SpectatorCard 
            key={i} 
            slot={slot} 
            revealed={isRevealed} 
            getOverride={getOverride}
          />
        ))}
      </div>
      
      {/* Round 2 slots */}
      <div className="flex gap-2 ml-8">
        {board.slice(4, 7).map((slot, i) => (
          <SpectatorCard 
            key={i + 4} 
            slot={slot} 
            revealed={isRevealed} 
            getOverride={getOverride}
          />
        ))}
      </div>
    </div>
  );
};

export const SpectatorView = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const { getOverride } = useCardOverrides();
  const [match, setMatch] = useState<MatchData | null>(null);
  const [player1, setPlayer1] = useState<PlayerProfile | null>(null);
  const [player2, setPlayer2] = useState<PlayerProfile | null>(null);
  const [spectatorCount, setSpectatorCount] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // Fetch match data
  useEffect(() => {
    if (!matchId) return;

    const fetchMatch = async () => {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .single();

      if (error) {
        console.error('Error fetching match:', error);
        setError('Match not found');
        return;
      }

      setMatch(data as unknown as MatchData);

      // Fetch player profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username')
        .in('user_id', [data.player1_id, data.player2_id]);

      if (profiles) {
        setPlayer1(profiles.find(p => p.user_id === data.player1_id) || null);
        setPlayer2(profiles.find(p => p.user_id === data.player2_id) || null);
      }
    };

    fetchMatch();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`spectate-${matchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${matchId}`,
        },
        (payload) => {
          console.log('Match updated:', payload);
          setMatch(payload.new as unknown as MatchData);
        }
      )
      .subscribe();

    // Track spectators using presence
    const presenceChannel = supabase.channel(`spectators-${matchId}`);
    
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const count = Object.keys(state).reduce((acc, key) => acc + state[key].length, 0);
        setSpectatorCount(count);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(presenceChannel);
    };
  }, [matchId]);

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">{error}</p>
          <Link to="/tournaments">
            <Button variant="link">Back to Tournaments</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Loading match...</p>
        </div>
      </div>
    );
  }

  const gameState = match.game_state;
  const isRevealPhase = match.phase.includes('reveal') || match.phase === 'game-over';
  const isGameOver = match.phase === 'game-over' || match.winner_id;

  const getPhaseLabel = (phase: string) => {
    switch (phase) {
      case 'waiting': return 'Waiting for players...';
      case 'round1-place': return 'Round 1 - Placing cards';
      case 'round1-reveal': return 'Round 1 - Revealing';
      case 'round2-place': return 'Round 2 - Placing cards';
      case 'round2-reveal': return 'Round 2 - Revealing';
      case 'game-over': return 'Game Over';
      default: return phase;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/80">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <Link to="/tournaments" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
            Back to Tournaments
          </Link>
          
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              Spectating
            </Badge>
            <Badge variant="secondary" className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {spectatorCount} watching
            </Badge>
          </div>
        </div>

        <Card className="bg-card/50 border-border/50 overflow-hidden">
          <CardHeader className="text-center border-b border-border/50">
            <CardTitle className="text-2xl">
              {player1?.username || 'Player 1'} vs {player2?.username || 'Player 2'}
            </CardTitle>
            <Badge className={cn(
              "w-fit mx-auto",
              isGameOver ? "bg-green-500/20 text-green-400" : "bg-blue-500/20 text-blue-400"
            )}>
              {getPhaseLabel(match.phase)}
            </Badge>
          </CardHeader>
          
          <CardContent className="p-8">
            {gameState?.player && gameState?.opponent ? (
              <div className="flex justify-center items-start gap-16">
                <SpectatorBoard
                  board={gameState.player.board || Array(7).fill(null)}
                  playerName={player1?.username || 'Player 1'}
                  totalPoints={gameState.player.totalPoints || 0}
                  colorCounts={gameState.player.colorCounts || {}}
                  mainColors={gameState.mainColors || []}
                  isRevealed={isRevealPhase}
                  getOverride={getOverride}
                />
                
                <div className="flex flex-col items-center justify-center gap-4">
                  <div className="text-4xl font-bold">VS</div>
                  {isGameOver && match.winner_id && (
                    <Badge className="bg-yellow-500/20 text-yellow-400 text-lg px-4 py-2">
                      {match.winner_id === match.player1_id 
                        ? player1?.username 
                        : player2?.username} Wins!
                    </Badge>
                  )}
                </div>
                
                <SpectatorBoard
                  board={gameState.opponent.board || Array(7).fill(null)}
                  playerName={player2?.username || 'Player 2'}
                  totalPoints={gameState.opponent.totalPoints || 0}
                  colorCounts={gameState.opponent.colorCounts || {}}
                  mainColors={gameState.mainColors || []}
                  isRevealed={isRevealPhase}
                  getOverride={getOverride}
                />
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Eye className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>Waiting for game to start...</p>
                <p className="text-sm mt-2">The match will appear here once both players have placed their cards.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SpectatorView;
