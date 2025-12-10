import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

export function useWishlist() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: wishlist = [], isLoading } = useQuery({
    queryKey: ['wishlist', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('wishlists')
        .select('card_id')
        .eq('user_id', user.id);
      if (error) throw error;
      return data.map(w => w.card_id);
    },
    enabled: !!user,
  });

  const addToWishlist = useMutation({
    mutationFn: async (cardId: number) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('wishlists')
        .insert({ user_id: user.id, card_id: cardId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
      toast({ title: 'Added to wishlist', description: "You'll be notified when this card appears in trades or auctions" });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to add to wishlist', variant: 'destructive' });
    },
  });

  const removeFromWishlist = useMutation({
    mutationFn: async (cardId: number) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('wishlists')
        .delete()
        .eq('user_id', user.id)
        .eq('card_id', cardId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
      toast({ title: 'Removed from wishlist' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to remove from wishlist', variant: 'destructive' });
    },
  });

  const isWishlisted = (cardId: number) => wishlist.includes(cardId);

  const toggleWishlist = (cardId: number) => {
    if (isWishlisted(cardId)) {
      removeFromWishlist.mutate(cardId);
    } else {
      addToWishlist.mutate(cardId);
    }
  };

  return {
    wishlist,
    isLoading,
    isWishlisted,
    toggleWishlist,
    addToWishlist: addToWishlist.mutate,
    removeFromWishlist: removeFromWishlist.mutate,
  };
}
