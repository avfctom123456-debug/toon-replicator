import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create admin client for matchmaking operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, deckCardIds, matchId } = await req.json();
    console.log(`Matchmaking action: ${action} for user: ${user.id}`);

    if (action === 'join_queue') {
      // Only consider matches updated in the last 10 minutes as "active"
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      
      // FIRST: Check if user is already in an active match (prevents duplicate matches)
      const { data: existingMatch } = await supabaseAdmin
        .from('matches')
        .select('*')
        .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
        .in('phase', ['loading', 'waiting', 'round1-place', 'round2-place'])
        .gte('updated_at', tenMinutesAgo)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (existingMatch) {
        console.log(`User ${user.id} already in active match ${existingMatch.id}`);
        // Remove from queue if in queue
        await supabaseAdmin
          .from('matchmaking_queue')
          .delete()
          .eq('user_id', user.id);
          
        return new Response(JSON.stringify({ status: 'matched', matchId: existingMatch.id }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Clean up any stale matches this user is in (mark as game-over)
      await supabaseAdmin
        .from('matches')
        .update({ phase: 'game-over', win_method: 'abandoned' })
        .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
        .neq('phase', 'game-over')
        .lt('updated_at', tenMinutesAgo);

      // Check if user is already in queue
      const { data: existingQueue } = await supabaseAdmin
        .from('matchmaking_queue')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (existingQueue) {
        // Already in queue - just check for opponents, don't create match yet
        // The FIRST player to join should wait, SECOND player creates the match
        const { data: otherPlayers } = await supabaseAdmin
          .from('matchmaking_queue')
          .select('*')
          .neq('user_id', user.id)
          .order('created_at', { ascending: true })
          .limit(1);

        if (otherPlayers && otherPlayers.length > 0) {
          const opponent = otherPlayers[0];
          
          // Double-check neither player is already in a match (race condition prevention)
          const { data: opponentMatch } = await supabaseAdmin
            .from('matches')
            .select('id')
            .or(`player1_id.eq.${opponent.user_id},player2_id.eq.${opponent.user_id}`)
            .in('phase', ['loading', 'waiting', 'round1-place', 'round2-place'])
            .gte('updated_at', tenMinutesAgo)
            .limit(1)
            .single();

          if (opponentMatch) {
            // Opponent is already in a match, remove them from queue
            await supabaseAdmin
              .from('matchmaking_queue')
              .delete()
              .eq('user_id', opponent.user_id);
            
            return new Response(JSON.stringify({ status: 'waiting' }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          // Use the later player (by queue time) as the one who creates the match
          // This prevents race conditions where both try to create
          const iAmLaterPlayer = new Date(existingQueue.created_at) > new Date(opponent.created_at);
          
          if (!iAmLaterPlayer) {
            // I joined first, let the other player create the match
            return new Response(JSON.stringify({ status: 'waiting' }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          // I'm the later player, I create the match
          // First, try to delete both from queue (atomic check)
          const { data: deletedRows, error: deleteError } = await supabaseAdmin
            .from('matchmaking_queue')
            .delete()
            .in('user_id', [user.id, opponent.user_id])
            .select();

          if (deleteError || !deletedRows || deletedRows.length < 2) {
            // Someone else already matched with one of us
            console.log('Race condition detected, queue state changed');
            // Re-check for existing match
            const { data: myMatch } = await supabaseAdmin
              .from('matches')
              .select('*')
              .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
              .in('phase', ['loading', 'waiting', 'round1-place', 'round2-place'])
              .gte('updated_at', tenMinutesAgo)
              .limit(1)
              .single();

            if (myMatch) {
              return new Response(JSON.stringify({ status: 'matched', matchId: myMatch.id }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }
            
            return new Response(JSON.stringify({ status: 'waiting' }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          
          // Create match - opponent (earlier) is player1, I am player2
          const { data: match, error: matchError } = await supabaseAdmin
            .from('matches')
            .insert({
              player1_id: opponent.user_id,
              player2_id: user.id,
              player1_deck: opponent.deck_card_ids,
              player2_deck: deckCardIds || existingQueue.deck_card_ids,
              phase: 'loading',
            })
            .select()
            .single();

          if (matchError) {
            console.error('Match creation error:', matchError);
            throw matchError;
          }

          console.log(`Match created: ${match.id} (player1: ${opponent.user_id}, player2: ${user.id})`);
          return new Response(JSON.stringify({ status: 'matched', matchId: match.id }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ status: 'waiting' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Not in queue yet - add to queue
      const { error: queueError } = await supabaseAdmin
        .from('matchmaking_queue')
        .insert({
          user_id: user.id,
          deck_card_ids: deckCardIds,
        });

      if (queueError) {
        console.error('Queue insert error:', queueError);
        throw queueError;
      }

      // Check if there's another player waiting (I'm the new/later player)
      const { data: otherPlayers } = await supabaseAdmin
        .from('matchmaking_queue')
        .select('*')
        .neq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1);

      if (otherPlayers && otherPlayers.length > 0) {
        const opponent = otherPlayers[0];
        
        // Double-check opponent isn't already in a match
        const { data: opponentMatch } = await supabaseAdmin
          .from('matches')
          .select('id')
          .or(`player1_id.eq.${opponent.user_id},player2_id.eq.${opponent.user_id}`)
          .in('phase', ['loading', 'waiting', 'round1-place', 'round2-place'])
          .gte('updated_at', tenMinutesAgo)
          .limit(1)
          .single();

        if (opponentMatch) {
          // Opponent is already in a match, remove them from queue
          await supabaseAdmin
            .from('matchmaking_queue')
            .delete()
            .eq('user_id', opponent.user_id);
          
          return new Response(JSON.stringify({ status: 'waiting' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // I'm the later player, I create the match
        const { data: deletedRows, error: deleteError } = await supabaseAdmin
          .from('matchmaking_queue')
          .delete()
          .in('user_id', [user.id, opponent.user_id])
          .select();

        if (deleteError || !deletedRows || deletedRows.length < 2) {
          console.log('Race condition detected during match creation');
          const { data: myMatch } = await supabaseAdmin
            .from('matches')
            .select('*')
            .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
            .in('phase', ['loading', 'waiting', 'round1-place', 'round2-place'])
            .gte('updated_at', tenMinutesAgo)
            .limit(1)
            .single();

          if (myMatch) {
            return new Response(JSON.stringify({ status: 'matched', matchId: myMatch.id }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          
          return new Response(JSON.stringify({ status: 'waiting' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // Create match
        const { data: match, error: matchError } = await supabaseAdmin
          .from('matches')
          .insert({
            player1_id: opponent.user_id,
            player2_id: user.id,
            player1_deck: opponent.deck_card_ids,
            player2_deck: deckCardIds,
            phase: 'loading',
          })
          .select()
          .single();

        if (matchError) {
          console.error('Match creation error:', matchError);
          throw matchError;
        }

        console.log(`Match created: ${match.id} (player1: ${opponent.user_id}, player2: ${user.id})`);
        return new Response(JSON.stringify({ status: 'matched', matchId: match.id }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ status: 'waiting' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'leave_queue') {
      await supabaseAdmin
        .from('matchmaking_queue')
        .delete()
        .eq('user_id', user.id);

      return new Response(JSON.stringify({ status: 'left' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'check_match') {
      // Only consider matches updated in the last 10 minutes as "active"
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      
      // Check if user was matched while waiting
      const { data: match } = await supabaseAdmin
        .from('matches')
        .select('*')
        .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
        .neq('phase', 'game-over')
        .gte('updated_at', tenMinutesAgo)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (match) {
        // Also remove from queue if still there
        await supabaseAdmin
          .from('matchmaking_queue')
          .delete()
          .eq('user_id', user.id);
          
        return new Response(JSON.stringify({ status: 'matched', matchId: match.id }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check if still in queue
      const { data: inQueue } = await supabaseAdmin
        .from('matchmaking_queue')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (inQueue) {
        return new Response(JSON.stringify({ status: 'waiting' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ status: 'not_in_queue' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'heartbeat' && matchId) {
      // Update last_seen for the player
      const { data: match } = await supabaseAdmin
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .single();

      if (match) {
        const updateField = match.player1_id === user.id ? 'player1_last_seen' : 'player2_last_seen';
        await supabaseAdmin
          .from('matches')
          .update({ [updateField]: new Date().toISOString() })
          .eq('id', matchId);

        // Check if opponent disconnected (>60 seconds)
        const opponentLastSeen = match.player1_id === user.id ? match.player2_last_seen : match.player1_last_seen;
        const disconnectThreshold = 60 * 1000; // 60 seconds
        const timeSinceLastSeen = Date.now() - new Date(opponentLastSeen).getTime();

        if (timeSinceLastSeen > disconnectThreshold && match.phase !== 'game-over') {
          // Opponent disconnected, declare winner
          await supabaseAdmin
            .from('matches')
            .update({
              phase: 'game-over',
              winner_id: user.id,
              win_method: 'disconnect',
            })
            .eq('id', matchId);

          return new Response(JSON.stringify({ status: 'opponent_disconnected' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Matchmaking error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
