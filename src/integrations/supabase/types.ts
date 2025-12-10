export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          category: string
          coin_reward: number
          created_at: string
          description: string
          icon: string | null
          id: string
          is_active: boolean
          name: string
          requirement_type: string
          requirement_value: number
          updated_at: string
        }
        Insert: {
          category: string
          coin_reward?: number
          created_at?: string
          description: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          requirement_type: string
          requirement_value: number
          updated_at?: string
        }
        Update: {
          category?: string
          coin_reward?: number
          created_at?: string
          description?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          requirement_type?: string
          requirement_value?: number
          updated_at?: string
        }
        Relationships: []
      }
      auction_bids: {
        Row: {
          auction_id: string
          bid_amount: number
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          auction_id: string
          bid_amount: number
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          auction_id?: string
          bid_amount?: number
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auction_bids_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
        ]
      }
      auctions: {
        Row: {
          card_id: number
          created_at: string
          current_bid: number
          ends_at: string
          highest_bidder_id: string | null
          id: string
          min_increment: number
          starting_bid: number
          status: string
          updated_at: string
          user_card_id: string | null
          user_id: string
        }
        Insert: {
          card_id: number
          created_at?: string
          current_bid?: number
          ends_at: string
          highest_bidder_id?: string | null
          id?: string
          min_increment?: number
          starting_bid?: number
          status?: string
          updated_at?: string
          user_card_id?: string | null
          user_id: string
        }
        Update: {
          card_id?: number
          created_at?: string
          current_bid?: number
          ends_at?: string
          highest_bidder_id?: string | null
          id?: string
          min_increment?: number
          starting_bid?: number
          status?: string
          updated_at?: string
          user_card_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auctions_user_card_id_fkey"
            columns: ["user_card_id"]
            isOneToOne: false
            referencedRelation: "user_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      card_overrides: {
        Row: {
          card_id: number
          created_at: string
          custom_base_points: number | null
          custom_description: string | null
          custom_image_url: string | null
          custom_title: string | null
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          card_id: number
          created_at?: string
          custom_base_points?: number | null
          custom_description?: string | null
          custom_image_url?: string | null
          custom_title?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          card_id?: number
          created_at?: string
          custom_base_points?: number | null
          custom_description?: string | null
          custom_image_url?: string | null
          custom_title?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      card_wins: {
        Row: {
          card_id: number
          created_at: string
          id: string
          updated_at: string
          user_id: string
          wins: number
        }
        Insert: {
          card_id: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
          wins?: number
        }
        Update: {
          card_id?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
          wins?: number
        }
        Relationships: []
      }
      challenge_invites: {
        Row: {
          challenged_id: string
          challenger_deck: number[]
          challenger_id: string
          created_at: string
          expires_at: string
          id: string
          is_ranked: boolean
          match_id: string | null
          status: string
        }
        Insert: {
          challenged_id: string
          challenger_deck?: number[]
          challenger_id: string
          created_at?: string
          expires_at?: string
          id?: string
          is_ranked?: boolean
          match_id?: string | null
          status?: string
        }
        Update: {
          challenged_id?: string
          challenger_deck?: number[]
          challenger_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          is_ranked?: boolean
          match_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_invites_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_bans: {
        Row: {
          banned_by: string
          created_at: string
          expires_at: string | null
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          banned_by: string
          created_at?: string
          expires_at?: string | null
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          banned_by?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          channel: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          is_deleted: boolean
          message: string
          user_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_deleted?: boolean
          message: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_deleted?: boolean
          message?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_login_rewards: {
        Row: {
          created_at: string
          day_number: number
          id: string
          reward_type: string
          reward_value: number
        }
        Insert: {
          created_at?: string
          day_number: number
          id?: string
          reward_type: string
          reward_value: number
        }
        Update: {
          created_at?: string
          day_number?: number
          id?: string
          reward_type?: string
          reward_value?: number
        }
        Relationships: []
      }
      decks: {
        Row: {
          card_ids: number[]
          created_at: string
          id: string
          slot: string
          updated_at: string
          user_id: string
        }
        Insert: {
          card_ids?: number[]
          created_at?: string
          id?: string
          slot: string
          updated_at?: string
          user_id: string
        }
        Update: {
          card_ids?: number[]
          created_at?: string
          id?: string
          slot?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      friends: {
        Row: {
          created_at: string
          friend_id: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      matches: {
        Row: {
          created_at: string
          current_turn: string | null
          game_state: Json
          id: string
          phase: string
          player1_deck: number[]
          player1_id: string
          player1_last_seen: string
          player1_ready: boolean
          player2_deck: number[]
          player2_id: string
          player2_last_seen: string
          player2_ready: boolean
          updated_at: string
          win_method: string | null
          winner_id: string | null
        }
        Insert: {
          created_at?: string
          current_turn?: string | null
          game_state?: Json
          id?: string
          phase?: string
          player1_deck?: number[]
          player1_id: string
          player1_last_seen?: string
          player1_ready?: boolean
          player2_deck?: number[]
          player2_id: string
          player2_last_seen?: string
          player2_ready?: boolean
          updated_at?: string
          win_method?: string | null
          winner_id?: string | null
        }
        Update: {
          created_at?: string
          current_turn?: string | null
          game_state?: Json
          id?: string
          phase?: string
          player1_deck?: number[]
          player1_id?: string
          player1_last_seen?: string
          player1_ready?: boolean
          player2_deck?: number[]
          player2_id?: string
          player2_last_seen?: string
          player2_ready?: boolean
          updated_at?: string
          win_method?: string | null
          winner_id?: string | null
        }
        Relationships: []
      }
      matchmaking_queue: {
        Row: {
          created_at: string
          deck_card_ids: number[]
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deck_card_ids?: number[]
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deck_card_ids?: number[]
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          message: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          message: string
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      pack_cards: {
        Row: {
          card_id: number
          created_at: string
          id: string
          pack_id: string
          rarity_weight: number
        }
        Insert: {
          card_id: number
          created_at?: string
          id?: string
          pack_id: string
          rarity_weight?: number
        }
        Update: {
          card_id?: number
          created_at?: string
          id?: string
          pack_id?: string
          rarity_weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "pack_cards_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      packs: {
        Row: {
          cards_per_pack: number
          cost: number
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          cards_per_pack?: number
          cost?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          cards_per_pack?: number
          cost?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      player_stats: {
        Row: {
          best_win_streak: number
          color_wins: number
          cpu_wins: number
          created_at: string
          daily_coins_earned: number
          elo_rating: number
          highest_score: number
          id: string
          last_coin_reset: string
          last_match_at: string | null
          packs_opened: number
          perfect_wins: number
          pvp_draws: number
          pvp_losses: number
          pvp_wins: number
          total_adjacency_plays: number
          total_card_buffs: number
          total_card_cancels: number
          total_card_plays: number
          total_coins_earned: number
          updated_at: string
          user_id: string
          win_streak: number
        }
        Insert: {
          best_win_streak?: number
          color_wins?: number
          cpu_wins?: number
          created_at?: string
          daily_coins_earned?: number
          elo_rating?: number
          highest_score?: number
          id?: string
          last_coin_reset?: string
          last_match_at?: string | null
          packs_opened?: number
          perfect_wins?: number
          pvp_draws?: number
          pvp_losses?: number
          pvp_wins?: number
          total_adjacency_plays?: number
          total_card_buffs?: number
          total_card_cancels?: number
          total_card_plays?: number
          total_coins_earned?: number
          updated_at?: string
          user_id: string
          win_streak?: number
        }
        Update: {
          best_win_streak?: number
          color_wins?: number
          cpu_wins?: number
          created_at?: string
          daily_coins_earned?: number
          elo_rating?: number
          highest_score?: number
          id?: string
          last_coin_reset?: string
          last_match_at?: string | null
          packs_opened?: number
          perfect_wins?: number
          pvp_draws?: number
          pvp_losses?: number
          pvp_wins?: number
          total_adjacency_plays?: number
          total_card_buffs?: number
          total_card_cancels?: number
          total_card_plays?: number
          total_coins_earned?: number
          updated_at?: string
          user_id?: string
          win_streak?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          coins: number
          created_at: string
          id: string
          starter_deck_claimed: string | null
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          coins?: number
          created_at?: string
          id?: string
          starter_deck_claimed?: string | null
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          coins?: number
          created_at?: string
          id?: string
          starter_deck_claimed?: string | null
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      promo_code_redemptions: {
        Row: {
          id: string
          promo_code_id: string
          redeemed_at: string
          user_id: string
        }
        Insert: {
          id?: string
          promo_code_id: string
          redeemed_at?: string
          user_id: string
        }
        Update: {
          id?: string
          promo_code_id?: string
          redeemed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_code_redemptions_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_codes: {
        Row: {
          code: string
          created_at: string
          current_uses: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          reward_type: string
          reward_value: number
        }
        Insert: {
          code: string
          created_at?: string
          current_uses?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          reward_type: string
          reward_value: number
        }
        Update: {
          code?: string
          created_at?: string
          current_uses?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          reward_type?: string
          reward_value?: number
        }
        Relationships: []
      }
      season_player_stats: {
        Row: {
          created_at: string
          final_elo: number
          final_rank: number
          id: string
          pvp_draws: number
          pvp_losses: number
          pvp_wins: number
          reward_coins: number
          reward_tier: string
          season_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          final_elo: number
          final_rank: number
          id?: string
          pvp_draws?: number
          pvp_losses?: number
          pvp_wins?: number
          reward_coins?: number
          reward_tier: string
          season_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          final_elo?: number
          final_rank?: number
          id?: string
          pvp_draws?: number
          pvp_losses?: number
          pvp_wins?: number
          reward_coins?: number
          reward_tier?: string
          season_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_player_stats_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          is_active: boolean
          name: string
          season_number: number
          start_date: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          name: string
          season_number: number
          start_date?: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          name?: string
          season_number?: number
          start_date?: string
        }
        Relationships: []
      }
      tournament_matches: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          match_id: string | null
          match_number: number
          player1_id: string | null
          player1_score: number | null
          player2_id: string | null
          player2_score: number | null
          round: number
          scheduled_at: string | null
          status: string
          tournament_id: string
          winner_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          match_id?: string | null
          match_number: number
          player1_id?: string | null
          player1_score?: number | null
          player2_id?: string | null
          player2_score?: number | null
          round: number
          scheduled_at?: string | null
          status?: string
          tournament_id: string
          winner_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          match_id?: string | null
          match_number?: number
          player1_id?: string | null
          player1_score?: number | null
          player2_id?: string | null
          player2_score?: number | null
          round?: number
          scheduled_at?: string | null
          status?: string
          tournament_id?: string
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_matches_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_participants: {
        Row: {
          deck_card_ids: number[]
          eliminated: boolean
          eliminated_at: string | null
          id: string
          joined_at: string
          placement: number | null
          prize_won: number | null
          seed: number | null
          tournament_id: string
          user_id: string
        }
        Insert: {
          deck_card_ids?: number[]
          eliminated?: boolean
          eliminated_at?: string | null
          id?: string
          joined_at?: string
          placement?: number | null
          prize_won?: number | null
          seed?: number | null
          tournament_id: string
          user_id: string
        }
        Update: {
          deck_card_ids?: number[]
          eliminated?: boolean
          eliminated_at?: string | null
          id?: string
          joined_at?: string
          placement?: number | null
          prize_won?: number | null
          seed?: number | null
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_participants_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          bracket_type: string
          created_at: string
          created_by: string
          current_participants: number
          current_round: number
          description: string | null
          entry_fee: number
          id: string
          max_participants: number
          name: string
          prize_pool: number
          starts_at: string
          status: string
          updated_at: string
          winner_id: string | null
        }
        Insert: {
          bracket_type?: string
          created_at?: string
          created_by: string
          current_participants?: number
          current_round?: number
          description?: string | null
          entry_fee?: number
          id?: string
          max_participants?: number
          name: string
          prize_pool?: number
          starts_at: string
          status?: string
          updated_at?: string
          winner_id?: string | null
        }
        Update: {
          bracket_type?: string
          created_at?: string
          created_by?: string
          current_participants?: number
          current_round?: number
          description?: string | null
          entry_fee?: number
          id?: string
          max_participants?: number
          name?: string
          prize_pool?: number
          starts_at?: string
          status?: string
          updated_at?: string
          winner_id?: string | null
        }
        Relationships: []
      }
      trades: {
        Row: {
          completed_by: string | null
          created_at: string
          id: string
          offer_card_ids: number[]
          offer_coins: number
          offer_user_card_ids: string[] | null
          status: string
          updated_at: string
          user_id: string
          want_card_ids: number[]
          want_coins: number
        }
        Insert: {
          completed_by?: string | null
          created_at?: string
          id?: string
          offer_card_ids?: number[]
          offer_coins?: number
          offer_user_card_ids?: string[] | null
          status?: string
          updated_at?: string
          user_id: string
          want_card_ids?: number[]
          want_coins?: number
        }
        Update: {
          completed_by?: string | null
          created_at?: string
          id?: string
          offer_card_ids?: number[]
          offer_coins?: number
          offer_user_card_ids?: string[] | null
          status?: string
          updated_at?: string
          user_id?: string
          want_card_ids?: number[]
          want_coins?: number
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_id: string
          completed: boolean
          completed_at: string | null
          created_at: string
          id: string
          progress: number
          reward_claimed: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          progress?: number
          reward_claimed?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          progress?: number
          reward_claimed?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      user_cards: {
        Row: {
          acquired_at: string
          card_id: number
          copy_number: number | null
          id: string
          quantity: number
          user_id: string
        }
        Insert: {
          acquired_at?: string
          card_id: number
          copy_number?: number | null
          id?: string
          quantity?: number
          user_id: string
        }
        Update: {
          acquired_at?: string
          card_id?: number
          copy_number?: number | null
          id?: string
          quantity?: number
          user_id?: string
        }
        Relationships: []
      }
      user_login_streaks: {
        Row: {
          created_at: string
          current_streak: number
          id: string
          last_claim_date: string | null
          total_claims: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_streak?: number
          id?: string
          last_claim_date?: string | null
          total_claims?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_streak?: number
          id?: string
          last_claim_date?: string | null
          total_claims?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wishlists: {
        Row: {
          card_id: number
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          card_id: number
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          card_id?: number
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_coins_earned: {
        Args: { p_coins: number; p_user_id: string }
        Returns: undefined
      }
      calculate_elo_change: {
        Args: { k_factor?: number; loser_elo: number; winner_elo: number }
        Returns: number
      }
      claim_achievement_reward: {
        Args: { p_achievement_id: string }
        Returns: Json
      }
      claim_daily_reward: { Args: never; Returns: Json }
      complete_tournament: { Args: { p_tournament_id: string }; Returns: Json }
      complete_trade: {
        Args: { p_acceptor_user_card_ids: string[]; p_trade_id: string }
        Returns: Json
      }
      end_auction: { Args: { p_auction_id: string }; Returns: Json }
      end_season_and_distribute_rewards: { Args: never; Returns: string }
      get_next_copy_number: { Args: { p_card_id: number }; Returns: number }
      get_reward_for_rank: {
        Args: { p_rank: number }
        Returns: {
          coins: number
          tier: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_card_wins: {
        Args: { p_card_ids: number[]; p_user_id: string }
        Returns: undefined
      }
      increment_color_wins: { Args: { p_user_id: string }; Returns: undefined }
      increment_packs_opened: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      increment_perfect_wins: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      join_tournament: {
        Args: { p_deck_card_ids: number[]; p_tournament_id: string }
        Returns: Json
      }
      leave_tournament: { Args: { p_tournament_id: string }; Returns: Json }
      place_bid: {
        Args: { p_auction_id: string; p_bid_amount: number }
        Returns: Json
      }
      redeem_promo_code: { Args: { p_code: string }; Returns: Json }
      start_tournament: { Args: { p_tournament_id: string }; Returns: Json }
      update_achievement_progress: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      update_cpu_win: { Args: { p_user_id: string }; Returns: undefined }
      update_highest_score: {
        Args: { p_score: number; p_user_id: string }
        Returns: undefined
      }
      update_pvp_stats: {
        Args: { p_is_draw?: boolean; p_loser_id: string; p_winner_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user" | "moderator"
      reward_tier:
        | "champion"
        | "diamond"
        | "gold"
        | "silver"
        | "bronze"
        | "participant"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user", "moderator"],
      reward_tier: [
        "champion",
        "diamond",
        "gold",
        "silver",
        "bronze",
        "participant",
      ],
    },
  },
} as const
