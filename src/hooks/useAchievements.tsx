import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: 'game' | 'collection' | 'trading' | 'economy';
  requirement_type: string;
  requirement_value: number;
  coin_reward: number;
  icon: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  progress: number;
  completed: boolean;
  completed_at: string | null;
  reward_claimed: boolean;
  created_at: string;
  updated_at: string;
  achievement?: Achievement;
}

export const useAchievements = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all achievements
  const { data: achievements = [], isLoading: loadingAchievements } = useQuery({
    queryKey: ['achievements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('achievements')
        .select('*')
        .order('category', { ascending: true })
        .order('requirement_value', { ascending: true });

      if (error) throw error;
      return data as Achievement[];
    },
  });

  // Fetch user's achievement progress
  const { data: userAchievements = [], isLoading: loadingUserAchievements } = useQuery({
    queryKey: ['user-achievements', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('user_achievements')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      return data as UserAchievement[];
    },
    enabled: !!user,
  });

  // Claim achievement reward
  const claimReward = useMutation({
    mutationFn: async (achievementId: string) => {
      const { data, error } = await supabase.rpc('claim_achievement_reward', {
        p_achievement_id: achievementId,
      });

      if (error) throw error;
      const result = data as { success: boolean; error?: string; coins?: number };
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['user-achievements'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast({ title: 'Reward claimed!', description: `You received ${data.coins} coins` });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to claim', description: error.message, variant: 'destructive' });
    },
  });

  // Get user's progress for a specific achievement
  const getUserProgress = (achievementId: string) => {
    return userAchievements.find(ua => ua.achievement_id === achievementId);
  };

  // Combine achievements with user progress
  const achievementsWithProgress = achievements.map(achievement => ({
    ...achievement,
    userProgress: getUserProgress(achievement.id),
  }));

  return {
    achievements,
    userAchievements,
    achievementsWithProgress,
    loadingAchievements,
    loadingUserAchievements,
    claimReward,
    getUserProgress,
  };
};

export const useAdminAchievements = () => {
  const queryClient = useQueryClient();

  // Fetch all achievements for admin (including inactive)
  const { data: achievements = [], isLoading } = useQuery({
    queryKey: ['admin-achievements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('achievements')
        .select('*')
        .order('category', { ascending: true })
        .order('requirement_value', { ascending: true });

      if (error) throw error;
      return data as Achievement[];
    },
  });

  // Create achievement
  const createAchievement = useMutation({
    mutationFn: async (achievement: Omit<Achievement, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('achievements')
        .insert(achievement)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-achievements'] });
      queryClient.invalidateQueries({ queryKey: ['achievements'] });
      toast({ title: 'Achievement created!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create', description: error.message, variant: 'destructive' });
    },
  });

  // Update achievement
  const updateAchievement = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Achievement> & { id: string }) => {
      const { data, error } = await supabase
        .from('achievements')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-achievements'] });
      queryClient.invalidateQueries({ queryKey: ['achievements'] });
      toast({ title: 'Achievement updated!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update', description: error.message, variant: 'destructive' });
    },
  });

  // Delete achievement
  const deleteAchievement = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('achievements')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-achievements'] });
      queryClient.invalidateQueries({ queryKey: ['achievements'] });
      toast({ title: 'Achievement deleted!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete', description: error.message, variant: 'destructive' });
    },
  });

  // Toggle achievement active state
  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('achievements')
        .update({ is_active })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-achievements'] });
      queryClient.invalidateQueries({ queryKey: ['achievements'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update', description: error.message, variant: 'destructive' });
    },
  });

  return {
    achievements,
    isLoading,
    createAchievement,
    updateAchievement,
    deleteAchievement,
    toggleActive,
  };
};
