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
      // Check if user is already in queue
      const { data: existingQueue } = await supabaseAdmin
        .from('matchmaking_queue')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (existingQueue) {
        // Already in queue, check for match
        const { data: otherPlayers } = await supabaseAdmin
          .from('matchmaking_queue')
          .select('*')
          .neq('user_id', user.id)
          .order('created_at', { ascending: true })
          .limit(1);

        if (otherPlayers && otherPlayers.length > 0) {
          const opponent = otherPlayers[0];
          
          // Create match
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

          // Remove both players from queue
          await supabaseAdmin
            .from('matchmaking_queue')
            .delete()
            .in('user_id', [user.id, opponent.user_id]);

          console.log(`Match created: ${match.id}`);
          return new Response(JSON.stringify({ status: 'matched', matchId: match.id }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ status: 'waiting' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Add to queue
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

      // Check if there's another player waiting
      const { data: otherPlayers } = await supabaseAdmin
        .from('matchmaking_queue')
        .select('*')
        .neq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1);

      if (otherPlayers && otherPlayers.length > 0) {
        const opponent = otherPlayers[0];
        
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

        // Remove both players from queue
        await supabaseAdmin
          .from('matchmaking_queue')
          .delete()
          .in('user_id', [user.id, opponent.user_id]);

        console.log(`Match created: ${match.id}`);
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
      // Check if user was matched while waiting
      const { data: match } = await supabaseAdmin
        .from('matches')
        .select('*')
        .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
        .neq('phase', 'game-over')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (match) {
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
