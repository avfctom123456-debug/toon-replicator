import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type MatchmakingStatus = 'idle' | 'searching' | 'matched' | 'error';

interface Match {
  id: string;
  player1_id: string;
  player2_id: string;
  player1_deck: number[];
  player2_deck: number[];
  game_state: Record<string, unknown>;
  current_turn: string | null;
  phase: string;
  winner_id: string | null;
  win_method: string | null;
  player1_ready: boolean;
  player2_ready: boolean;
  player1_last_seen: string;
  player2_last_seen: string;
}

export function useMatchmaking() {
  const { user } = useAuth();
  const [status, setStatus] = useState<MatchmakingStatus>('idle');
  const [matchId, setMatchId] = useState<string | null>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchTime, setSearchTime] = useState(0);

  // Poll for match status while searching
  useEffect(() => {
    if (status !== 'searching') return;

    const interval = setInterval(async () => {
      setSearchTime(prev => prev + 1);
      
      const { data, error } = await supabase.functions.invoke('matchmaking', {
        body: { action: 'check_match' }
      });

      if (error) {
        console.error('Check match error:', error);
        return;
      }

      if (data.status === 'matched') {
        setMatchId(data.matchId);
        setStatus('matched');
      } else if (data.status === 'not_in_queue') {
        setStatus('idle');
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [status]);

  // Subscribe to match updates
  useEffect(() => {
    if (!matchId) return;

    const channel = supabase
      .channel(`match-${matchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${matchId}`,
        },
        (payload) => {
          console.log('Match update:', payload);
          setMatch(payload.new as Match);
        }
      )
      .subscribe();

    // Fetch initial match state
    supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single()
      .then(({ data }) => {
        if (data) setMatch(data as Match);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId]);

  // Heartbeat to keep connection alive
  useEffect(() => {
    if (!matchId || !match || match.phase === 'game-over') return;

    const interval = setInterval(async () => {
      const { data } = await supabase.functions.invoke('matchmaking', {
        body: { action: 'heartbeat', matchId }
      });

      if (data?.status === 'opponent_disconnected') {
        // Opponent disconnected - fetch updated match
        const { data: updatedMatch } = await supabase
          .from('matches')
          .select('*')
          .eq('id', matchId)
          .single();
        if (updatedMatch) setMatch(updatedMatch as Match);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [matchId, match]);

  const joinQueue = useCallback(async (deckCardIds: number[]) => {
    if (!user) {
      setError('Must be logged in');
      return;
    }

    setStatus('searching');
    setSearchTime(0);
    setError(null);

    const { data, error } = await supabase.functions.invoke('matchmaking', {
      body: { action: 'join_queue', deckCardIds }
    });

    if (error) {
      console.error('Join queue error:', error);
      setError(error.message);
      setStatus('error');
      return;
    }

    if (data.status === 'matched') {
      setMatchId(data.matchId);
      setStatus('matched');
    }
  }, [user]);

  const leaveQueue = useCallback(async () => {
    await supabase.functions.invoke('matchmaking', {
      body: { action: 'leave_queue' }
    });
    setStatus('idle');
    setSearchTime(0);
  }, []);

  const joinMatch = useCallback(async (matchIdToJoin: string) => {
    if (!user) {
      setError('Must be logged in');
      return false;
    }

    // Fetch the match to verify user is a participant
    const { data: matchData, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchIdToJoin)
      .single();

    if (matchError || !matchData) {
      console.error('Error fetching match:', matchError);
      setError('Match not found');
      return false;
    }

    // Verify user is a participant
    if (matchData.player1_id !== user.id && matchData.player2_id !== user.id) {
      setError('You are not a participant in this match');
      return false;
    }

    setMatchId(matchIdToJoin);
    setMatch(matchData as Match);
    setStatus('matched');
    return true;
  }, [user]);

  const updateGameState = useCallback(async (gameState: Record<string, unknown>) => {
    if (!matchId || !user) return;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase
      .from('matches')
      .update({ game_state: gameState as any })
      .eq('id', matchId);
  }, [matchId, user]);

  const setReady = useCallback(async () => {
    if (!matchId || !user || !match) return;

    const isPlayer1 = match.player1_id === user.id;
    const updateField = isPlayer1 ? 'player1_ready' : 'player2_ready';

    await supabase
      .from('matches')
      .update({ [updateField]: true })
      .eq('id', matchId);
  }, [matchId, user, match]);

  const resetReady = useCallback(async () => {
    if (!matchId) return;

    await supabase
      .from('matches')
      .update({ player1_ready: false, player2_ready: false })
      .eq('id', matchId);
  }, [matchId]);

  return {
    status,
    matchId,
    match,
    error,
    searchTime,
    joinQueue,
    leaveQueue,
    joinMatch,
    updateGameState,
    setReady,
    resetReady,
    isPlayer1: match?.player1_id === user?.id,
  };
}
