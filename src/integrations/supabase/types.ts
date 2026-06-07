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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      copy_settings: {
        Row: {
          active: boolean
          created_at: string
          id: string
          leader_id: string
          max_coins_per_trade: number
          realized_loss: number
          stop_loss_pct: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          leader_id: string
          max_coins_per_trade?: number
          realized_loss?: number
          stop_loss_pct?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          leader_id?: string
          max_coins_per_trade?: number
          realized_loss?: number
          stop_loss_pct?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      direct_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          recipient_id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          recipient_id: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          recipient_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: string
          updated_at: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      holdings: {
        Row: {
          avg_buy_price: number
          created_at: string
          currency: string
          id: string
          quantity: number
          symbol: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_buy_price?: number
          created_at?: string
          currency?: string
          id?: string
          quantity?: number
          symbol: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_buy_price?: number
          created_at?: string
          currency?: string
          id?: string
          quantity?: number
          symbol?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      price_alerts: {
        Row: {
          created_at: string
          direction: string
          id: string
          market: string
          notify_email: boolean
          reference_price: number | null
          symbol: string
          target_price: number
          triggered: boolean
          triggered_at: string | null
          triggered_price: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          direction: string
          id?: string
          market?: string
          notify_email?: boolean
          reference_price?: number | null
          symbol: string
          target_price: number
          triggered?: boolean
          triggered_at?: string | null
          triggered_price?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          direction?: string
          id?: string
          market?: string
          notify_email?: boolean
          reference_price?: number | null
          symbol?: string
          target_price?: number
          triggered?: boolean
          triggered_at?: string | null
          triggered_price?: number | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          coins: number
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          last_reward_date: string | null
          net_profit: number
          referral_code: string | null
          referred_by: string | null
          updated_at: string
          username: string | null
          username_changes: number
        }
        Insert: {
          coins?: number
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          last_reward_date?: string | null
          net_profit?: number
          referral_code?: string | null
          referred_by?: string | null
          updated_at?: string
          username?: string | null
          username_changes?: number
        }
        Update: {
          coins?: number
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          last_reward_date?: string | null
          net_profit?: number
          referral_code?: string | null
          referred_by?: string | null
          updated_at?: string
          username?: string | null
          username_changes?: number
        }
        Relationships: []
      }
      tournament_entries: {
        Row: {
          fee_paid: number
          id: string
          joined_at: string
          tournament_id: string
          user_id: string
        }
        Insert: {
          fee_paid?: number
          id?: string
          joined_at?: string
          tournament_id: string
          user_id: string
        }
        Update: {
          fee_paid?: number
          id?: string
          joined_at?: string
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_entries_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_winners: {
        Row: {
          awarded_at: string
          id: string
          prize: number
          rank: number
          tournament_id: string
          user_id: string
          username: string | null
        }
        Insert: {
          awarded_at?: string
          id?: string
          prize: number
          rank: number
          tournament_id: string
          user_id: string
          username?: string | null
        }
        Update: {
          awarded_at?: string
          id?: string
          prize?: number
          rank?: number
          tournament_id?: string
          user_id?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_winners_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          awarded: boolean
          created_at: string
          created_by: string | null
          ends_at: string
          entry_fee: number
          id: string
          kind: Database["public"]["Enums"]["tournament_kind"]
          market: Database["public"]["Enums"]["tournament_market"]
          name: string
          prize_pool: number
          starts_at: string
        }
        Insert: {
          awarded?: boolean
          created_at?: string
          created_by?: string | null
          ends_at: string
          entry_fee?: number
          id?: string
          kind?: Database["public"]["Enums"]["tournament_kind"]
          market?: Database["public"]["Enums"]["tournament_market"]
          name: string
          prize_pool?: number
          starts_at: string
        }
        Update: {
          awarded?: boolean
          created_at?: string
          created_by?: string | null
          ends_at?: string
          entry_fee?: number
          id?: string
          kind?: Database["public"]["Enums"]["tournament_kind"]
          market?: Database["public"]["Enums"]["tournament_market"]
          name?: string
          prize_pool?: number
          starts_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          coins_delta: number
          copied_from_user: string | null
          created_at: string
          id: string
          pnl: number
          price: number
          quantity: number
          source_trade_id: string | null
          symbol: string
          type: string
          user_id: string
        }
        Insert: {
          coins_delta: number
          copied_from_user?: string | null
          created_at?: string
          id?: string
          pnl?: number
          price: number
          quantity: number
          source_trade_id?: string | null
          symbol: string
          type: string
          user_id: string
        }
        Update: {
          coins_delta?: number
          copied_from_user?: string | null
          created_at?: string
          id?: string
          pnl?: number
          price?: number
          quantity?: number
          source_trade_id?: string | null
          symbol?: string
          type?: string
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
          role: Database["public"]["Enums"]["app_role"]
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
      waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      waitlist_emails: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      weekly_entries: {
        Row: {
          created_at: string
          fee_paid: number
          id: string
          user_id: string
          week_start: string
        }
        Insert: {
          created_at?: string
          fee_paid?: number
          id?: string
          user_id: string
          week_start: string
        }
        Update: {
          created_at?: string
          fee_paid?: number
          id?: string
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
      weekly_winners: {
        Row: {
          coins_earned: number
          created_at: string
          id: string
          user_id: string
          username: string
          week_start: string
        }
        Insert: {
          coins_earned?: number
          created_at?: string
          id?: string
          user_id: string
          username: string
          week_start: string
        }
        Update: {
          coins_earned?: number
          created_at?: string
          id?: string
          user_id?: string
          username?: string
          week_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_friend_request: {
        Args: { p_requester: string }
        Returns: {
          message: string
          success: boolean
        }[]
      }
      award_last_week_winner: {
        Args: never
        Returns: {
          awarded: boolean
          coins_earned: number
          username: string
        }[]
      }
      award_pending_tournaments: { Args: never; Returns: number }
      award_tournament: {
        Args: { p_id: string }
        Returns: {
          awarded: boolean
          message: string
        }[]
      }
      change_username: {
        Args: { p_new: string }
        Returns: {
          message: string
          remaining: number
          success: boolean
          username: string
        }[]
      }
      claim_daily_reward: {
        Args: never
        Returns: {
          claimed: boolean
          coins: number
          message: string
          streak: number
        }[]
      }
      compute_league: { Args: { p_net_profit: number }; Returns: string }
      copy_trade_internal: {
        Args: { p_price: number; p_source: string; p_user: string }
        Returns: {
          coins: number
          message: string
          success: boolean
        }[]
      }
      create_price_alert: {
        Args: {
          p_direction: string
          p_market: string
          p_notify_email: boolean
          p_reference: number
          p_symbol: string
          p_target: number
        }
        Returns: {
          id: string
          message: string
          success: boolean
        }[]
      }
      create_tournament: {
        Args: {
          p_ends_at: string
          p_entry_fee: number
          p_kind?: Database["public"]["Enums"]["tournament_kind"]
          p_market: Database["public"]["Enums"]["tournament_market"]
          p_name: string
          p_prize_pool: number
          p_starts_at: string
        }
        Returns: {
          id: string
          message: string
          success: boolean
        }[]
      }
      delete_price_alert: {
        Args: { p_id: string }
        Returns: {
          success: boolean
        }[]
      }
      ensure_recurring_tournaments: { Args: never; Returns: undefined }
      enter_weekly_challenge: {
        Args: never
        Returns: {
          coins: number
          message: string
          success: boolean
          week_start: string
        }[]
      }
      execute_trade: {
        Args: {
          p_currency: string
          p_price: number
          p_quantity: number
          p_symbol: string
          p_type: string
        }
        Returns: {
          coins: number
          message: string
          success: boolean
        }[]
      }
      get_copy_feed: {
        Args: { p_limit?: number }
        Returns: {
          already_copied: boolean
          created_at: string
          leader_id: string
          pnl: number
          price: number
          quantity: number
          symbol: string
          trade_id: string
          type: string
          username: string
        }[]
      }
      get_friends_leaderboard: {
        Args: { p_kind?: string }
        Returns: {
          coins: number
          net_profit: number
          rank: number
          user_id: string
          username: string
        }[]
      }
      get_friendships: {
        Args: never
        Returns: {
          coins: number
          is_incoming: boolean
          net_profit: number
          other_id: string
          status: string
          username: string
        }[]
      }
      get_latest_weekly_winner: {
        Args: never
        Returns: {
          coins_earned: number
          username: string
          week_start: string
        }[]
      }
      get_leaderboard: {
        Args: { p_kind?: string; p_limit?: number }
        Returns: {
          coins: number
          net_profit: number
          rank: number
          user_id: string
          username: string
        }[]
      }
      get_my_copy_leaders: {
        Args: never
        Returns: {
          active: boolean
          coins: number
          leader_id: string
          max_coins_per_trade: number
          net_profit: number
          realized_loss: number
          stop_loss_pct: number
          username: string
        }[]
      }
      get_my_weekly_entry: {
        Args: never
        Returns: {
          entered: boolean
          entrants: number
          week_start: string
        }[]
      }
      get_tournament_leaderboard: {
        Args: { p_id: string; p_limit?: number }
        Returns: {
          coins_earned: number
          rank: number
          trades: number
          user_id: string
          username: string
        }[]
      }
      get_tournaments: {
        Args: never
        Returns: {
          awarded: boolean
          ends_at: string
          entrants: number
          entry_fee: number
          id: string
          joined: boolean
          kind: Database["public"]["Enums"]["tournament_kind"]
          market: Database["public"]["Enums"]["tournament_market"]
          name: string
          prize_pool: number
          starts_at: string
          status: string
        }[]
      }
      get_user_public: {
        Args: { p_user: string }
        Returns: {
          coins: number
          created_at: string
          id: string
          net_profit: number
          username: string
        }[]
      }
      get_user_recent_trades: {
        Args: { p_limit?: number; p_user: string }
        Returns: {
          created_at: string
          price: number
          quantity: number
          symbol: string
          type: string
        }[]
      }
      get_user_stats: {
        Args: { p_user?: string }
        Returns: {
          coins: number
          holdings_count: number
          joined_at: string
          league: string
          losses: number
          net_profit: number
          portfolio_value: number
          total_buys: number
          total_sells: number
          total_trades: number
          username: string
          win_rate: number
          wins: number
        }[]
      }
      get_weekly_leaderboard: {
        Args: { p_limit?: number }
        Returns: {
          coins_earned: number
          rank: number
          trades: number
          user_id: string
          username: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      join_tournament: {
        Args: { p_id: string }
        Returns: {
          coins: number
          message: string
          success: boolean
        }[]
      }
      mark_notifications_read: {
        Args: { p_ids?: string[] }
        Returns: {
          updated: number
        }[]
      }
      redeem_referral: {
        Args: { p_code: string }
        Returns: {
          message: string
          success: boolean
        }[]
      }
      search_users: {
        Args: { p_limit?: number; p_q: string }
        Returns: {
          coins: number
          id: string
          net_profit: number
          username: string
        }[]
      }
      send_friend_request: {
        Args: { p_addressee: string }
        Returns: {
          message: string
          success: boolean
        }[]
      }
      set_copy_settings: {
        Args: {
          p_active: boolean
          p_leader: string
          p_max: number
          p_stop_pct: number
        }
        Returns: {
          message: string
          success: boolean
        }[]
      }
      toggle_follow: {
        Args: { p_target: string }
        Returns: {
          following: boolean
          message: string
          success: boolean
        }[]
      }
      week_monday: { Args: { d: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      tournament_kind: "daily" | "weekly" | "custom"
      tournament_market: "stock" | "forex" | "both"
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
      app_role: ["admin", "moderator", "user"],
      tournament_kind: ["daily", "weekly", "custom"],
      tournament_market: ["stock", "forex", "both"],
    },
  },
} as const
