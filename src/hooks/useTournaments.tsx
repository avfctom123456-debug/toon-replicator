import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

export interface Tournament {
  id: string;
  name: string;
  description: string | null;
  entry_fee: number;
  prize_pool: number;
  max_participants: number;
  current_participants: number;
  status: 'upcoming' | 'active' | 'completed' | 'cancelled';
  bracket_type: string;
  current_round: number;
  starts_at: string;
  created_by: string;
  winner_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TournamentParticipant {
  id: string;
  tournament_id: string;
  user_id: string;
  deck_card_ids: number[];
  seed: number | null;
  eliminated: boolean;
  eliminated_at: string | null;
  placement: number | null;
  prize_won: number;
  joined_at: string;
  username?: string;
}

export interface TournamentMatch {
  id: string;
  tournament_id: string;
  round: number;
  match_number: number;
  player1_id: string | null;
  player2_id: string | null;
  winner_id: string | null;
  player1_score: number;
  player2_score: number;
  status: 'pending' | 'ready' | 'in_progress' | 'completed';
  match_id: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  created_at: string;
  player1_username?: string;
  player2_username?: string;
}

export const useTournaments = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: tournaments = [], isLoading } = useQuery({
    queryKey: ['tournaments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .order('starts_at', { ascending: true });
      
      if (error) throw error;
      return data as Tournament[];
    },
  });

  const { data: myParticipations = [] } = useQuery({
    queryKey: ['my-tournament-participations', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('tournament_participants')
        .select('*')
        .eq('user_id', user.id);
      
      if (error) throw error;
      return data as TournamentParticipant[];
    },
    enabled: !!user,
  });

  const joinTournament = useMutation({
    mutationFn: async ({ tournamentId, deckCardIds }: { tournamentId: string; deckCardIds: number[] }) => {
      const { data, error } = await supabase.rpc('join_tournament', {
        p_tournament_id: tournamentId,
        p_deck_card_ids: deckCardIds,
      });
      
      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      queryClient.invalidateQueries({ queryKey: ['my-tournament-participations'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast({ title: 'Joined tournament!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to join', description: error.message, variant: 'destructive' });
    },
  });

  const leaveTournament = useMutation({
    mutationFn: async (tournamentId: string) => {
      const { data, error } = await supabase.rpc('leave_tournament', {
        p_tournament_id: tournamentId,
      });
      
      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      queryClient.invalidateQueries({ queryKey: ['my-tournament-participations'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast({ title: 'Left tournament' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to leave', description: error.message, variant: 'destructive' });
    },
  });

  const createTournament = useMutation({
    mutationFn: async (tournament: {
      name: string;
      description?: string;
      entry_fee: number;
      max_participants: number;
      starts_at: string;
    }) => {
      const { data, error } = await supabase
        .from('tournaments')
        .insert({
          ...tournament,
          created_by: user!.id,
          prize_pool: 0,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      toast({ title: 'Tournament created!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create tournament', description: error.message, variant: 'destructive' });
    },
  });

  const startTournament = useMutation({
    mutationFn: async (tournamentId: string) => {
      const { data, error } = await supabase.rpc('start_tournament', {
        p_tournament_id: tournamentId,
      });
      
      if (error) throw error;
      const result = data as { success: boolean; error?: string; rounds?: number };
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      queryClient.invalidateQueries({ queryKey: ['tournament-matches'] });
      toast({ title: 'Tournament started!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to start', description: error.message, variant: 'destructive' });
    },
  });

  const isJoined = (tournamentId: string) => {
    return myParticipations.some(p => p.tournament_id === tournamentId);
  };

  return {
    tournaments,
    isLoading,
    myParticipations,
    joinTournament,
    leaveTournament,
    createTournament,
    startTournament,
    isJoined,
  };
};

export const useTournamentDetails = (tournamentId: string) => {
  const queryClient = useQueryClient();

  const { data: tournament } = useQuery({
    queryKey: ['tournament', tournamentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournamentId)
        .maybeSingle();
      
      if (error) throw error;
      return data as Tournament | null;
    },
    enabled: !!tournamentId,
  });

  const { data: participants = [] } = useQuery({
    queryKey: ['tournament-participants', tournamentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tournament_participants')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('seed', { ascending: true });
      
      if (error) throw error;

      // Get usernames
      const userIds = data.map(p => p.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username')
        .in('user_id', userIds);

      return data.map(p => ({
        ...p,
        username: profiles?.find(pr => pr.user_id === p.user_id)?.username || 'Unknown',
      })) as TournamentParticipant[];
    },
    enabled: !!tournamentId,
  });

  const { data: matches = [] } = useQuery({
    queryKey: ['tournament-matches', tournamentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tournament_matches')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('round', { ascending: true })
        .order('match_number', { ascending: true });
      
      if (error) throw error;

      // Get player usernames
      const playerIds = [...new Set(data.flatMap(m => [m.player1_id, m.player2_id].filter(Boolean)))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username')
        .in('user_id', playerIds);

      return data.map(m => ({
        ...m,
        player1_username: profiles?.find(p => p.user_id === m.player1_id)?.username,
        player2_username: profiles?.find(p => p.user_id === m.player2_id)?.username,
      })) as TournamentMatch[];
    },
    enabled: !!tournamentId,
  });

  // Real-time subscriptions
  useEffect(() => {
    if (!tournamentId) return;

    const channel = supabase
      .channel(`tournament-${tournamentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournaments',
          filter: `id=eq.${tournamentId}`,
        },
        () => {
          console.log('Tournament updated');
          queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournament_matches',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        () => {
          console.log('Tournament match updated');
          queryClient.invalidateQueries({ queryKey: ['tournament-matches', tournamentId] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournament_participants',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        () => {
          console.log('Tournament participants updated');
          queryClient.invalidateQueries({ queryKey: ['tournament-participants', tournamentId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournamentId, queryClient]);

  return { tournament, participants, matches };
};
