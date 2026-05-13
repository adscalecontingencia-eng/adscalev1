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
      access_logs: {
        Row: {
          action: string
          auth_user_id: string | null
          city: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          role: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          auth_user_id?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          role?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          auth_user_id?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          role?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      client_terms_acceptances: {
        Row: {
          accepted_at: string
          auth_user_id: string | null
          client_id: string
          email: string
          id: string
          ip_address: string | null
          terms_version: string
          user_agent: string | null
        }
        Insert: {
          accepted_at?: string
          auth_user_id?: string | null
          client_id: string
          email: string
          id?: string
          ip_address?: string | null
          terms_version: string
          user_agent?: string | null
        }
        Update: {
          accepted_at?: string
          auth_user_id?: string | null
          client_id?: string
          email?: string
          id?: string
          ip_address?: string | null
          terms_version?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          ad_accounts: number | null
          auth_user_id: string | null
          blocked_accounts: number | null
          client_type: string
          company_name: string | null
          created_at: string
          email: string
          fixed_value: number | null
          id: string
          name: string
          notify_whatsapp: boolean
          number: string | null
          observations: string | null
          password: string
          payment_type: string
          percentage_value: number | null
          updated_at: string
          used_accounts: number | null
          whatsapp_group_link: string | null
          whatsapp_phone: string | null
        }
        Insert: {
          ad_accounts?: number | null
          auth_user_id?: string | null
          blocked_accounts?: number | null
          client_type?: string
          company_name?: string | null
          created_at?: string
          email: string
          fixed_value?: number | null
          id?: string
          name: string
          notify_whatsapp?: boolean
          number?: string | null
          observations?: string | null
          password: string
          payment_type?: string
          percentage_value?: number | null
          updated_at?: string
          used_accounts?: number | null
          whatsapp_group_link?: string | null
          whatsapp_phone?: string | null
        }
        Update: {
          ad_accounts?: number | null
          auth_user_id?: string | null
          blocked_accounts?: number | null
          client_type?: string
          company_name?: string | null
          created_at?: string
          email?: string
          fixed_value?: number | null
          id?: string
          name?: string
          notify_whatsapp?: boolean
          number?: string | null
          observations?: string | null
          password?: string
          payment_type?: string
          percentage_value?: number | null
          updated_at?: string
          used_accounts?: number | null
          whatsapp_group_link?: string | null
          whatsapp_phone?: string | null
        }
        Relationships: []
      }
      commissions: {
        Row: {
          ad_spend: number | null
          amount: number
          billing_week_end: string | null
          billing_week_start: string | null
          client_id: string
          created_at: string
          date: string
          id: string
          is_weekly_billing: boolean | null
          note: string | null
          percentual_aplicado: number | null
          status: string | null
          type: string
          valor_pago: number | null
          valor_pendente: number | null
        }
        Insert: {
          ad_spend?: number | null
          amount: number
          billing_week_end?: string | null
          billing_week_start?: string | null
          client_id: string
          created_at?: string
          date?: string
          id?: string
          is_weekly_billing?: boolean | null
          note?: string | null
          percentual_aplicado?: number | null
          status?: string | null
          type?: string
          valor_pago?: number | null
          valor_pendente?: number | null
        }
        Update: {
          ad_spend?: number | null
          amount?: number
          billing_week_end?: string | null
          billing_week_start?: string | null
          client_id?: string
          created_at?: string
          date?: string
          id?: string
          is_weekly_billing?: boolean | null
          note?: string | null
          percentual_aplicado?: number | null
          status?: string | null
          type?: string
          valor_pago?: number | null
          valor_pendente?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "commissions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_ad_account_assignments: {
        Row: {
          active: boolean | null
          ad_account_id: string
          assigned_at: string
          client_id: string
          id: string
        }
        Insert: {
          active?: boolean | null
          ad_account_id: string
          assigned_at?: string
          client_id: string
          id?: string
        }
        Update: {
          active?: boolean | null
          ad_account_id?: string
          assigned_at?: string
          client_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_ad_account_assignments_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "meta_ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_ad_account_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_ad_accounts: {
        Row: {
          account_created_time: string | null
          account_status: number | null
          age: number | null
          amount_spent: number | null
          balance: number | null
          billing_cycle: string | null
          bm_id: string | null
          business_country_code: string | null
          created_at: string
          currency: string | null
          disable_reason: number | null
          disable_reason_label: string | null
          funding_source: string | null
          id: string
          last_synced_at: string | null
          meta_account_id: string
          name: string
          owner_business_name: string | null
          page_count: number | null
          pixel_count: number | null
          score: number | null
          score_label: string | null
          spend_cap: number | null
          status: string | null
          timezone_name: string | null
          updated_at: string
        }
        Insert: {
          account_created_time?: string | null
          account_status?: number | null
          age?: number | null
          amount_spent?: number | null
          balance?: number | null
          billing_cycle?: string | null
          bm_id?: string | null
          business_country_code?: string | null
          created_at?: string
          currency?: string | null
          disable_reason?: number | null
          disable_reason_label?: string | null
          funding_source?: string | null
          id?: string
          last_synced_at?: string | null
          meta_account_id: string
          name: string
          owner_business_name?: string | null
          page_count?: number | null
          pixel_count?: number | null
          score?: number | null
          score_label?: string | null
          spend_cap?: number | null
          status?: string | null
          timezone_name?: string | null
          updated_at?: string
        }
        Update: {
          account_created_time?: string | null
          account_status?: number | null
          age?: number | null
          amount_spent?: number | null
          balance?: number | null
          billing_cycle?: string | null
          bm_id?: string | null
          business_country_code?: string | null
          created_at?: string
          currency?: string | null
          disable_reason?: number | null
          disable_reason_label?: string | null
          funding_source?: string | null
          id?: string
          last_synced_at?: string | null
          meta_account_id?: string
          name?: string
          owner_business_name?: string | null
          page_count?: number | null
          pixel_count?: number | null
          score?: number | null
          score_label?: string | null
          spend_cap?: number | null
          status?: string | null
          timezone_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_ad_accounts_bm_id_fkey"
            columns: ["bm_id"]
            isOneToOne: false
            referencedRelation: "meta_business_managers"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_ad_insights: {
        Row: {
          actions: Json | null
          ad_account_id: string
          clicks: number | null
          cpc: number | null
          cpm: number | null
          created_at: string
          ctr: number | null
          date: string
          id: string
          impressions: number | null
          purchases: number | null
          reach: number | null
          revenue: number | null
          spend: number | null
        }
        Insert: {
          actions?: Json | null
          ad_account_id: string
          clicks?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string
          ctr?: number | null
          date: string
          id?: string
          impressions?: number | null
          purchases?: number | null
          reach?: number | null
          revenue?: number | null
          spend?: number | null
        }
        Update: {
          actions?: Json | null
          ad_account_id?: string
          clicks?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string
          ctr?: number | null
          date?: string
          id?: string
          impressions?: number | null
          purchases?: number | null
          reach?: number | null
          revenue?: number | null
          spend?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_ad_insights_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "meta_ad_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_ads: {
        Row: {
          ad_account_id: string | null
          created_at: string
          disapproval_reason: string | null
          effective_status: string | null
          id: string
          issues_info: Json | null
          last_synced_at: string | null
          meta_ad_id: string
          name: string
          status: string | null
          updated_at: string
        }
        Insert: {
          ad_account_id?: string | null
          created_at?: string
          disapproval_reason?: string | null
          effective_status?: string | null
          id?: string
          issues_info?: Json | null
          last_synced_at?: string | null
          meta_ad_id: string
          name: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          ad_account_id?: string | null
          created_at?: string
          disapproval_reason?: string | null
          effective_status?: string | null
          id?: string
          issues_info?: Json | null
          last_synced_at?: string | null
          meta_ad_id?: string
          name?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_ads_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "meta_ad_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_blocked_accounts_log: {
        Row: {
          ad_account_id: string
          client_id: string | null
          detected_at: string
          event_type: string
          id: string
          reason: string | null
          resolved_at: string | null
        }
        Insert: {
          ad_account_id: string
          client_id?: string | null
          detected_at?: string
          event_type: string
          id?: string
          reason?: string | null
          resolved_at?: string | null
        }
        Update: {
          ad_account_id?: string
          client_id?: string | null
          detected_at?: string
          event_type?: string
          id?: string
          reason?: string | null
          resolved_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_blocked_accounts_log_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "meta_ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_blocked_accounts_log_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_business_managers: {
        Row: {
          account_count: number | null
          created_at: string
          id: string
          last_synced_at: string | null
          meta_bm_id: string
          name: string
          page_count: number | null
          pixel_count: number | null
          primary_page: string | null
          status: string | null
          updated_at: string
          verification_status: string | null
        }
        Insert: {
          account_count?: number | null
          created_at?: string
          id?: string
          last_synced_at?: string | null
          meta_bm_id: string
          name: string
          page_count?: number | null
          pixel_count?: number | null
          primary_page?: string | null
          status?: string | null
          updated_at?: string
          verification_status?: string | null
        }
        Update: {
          account_count?: number | null
          created_at?: string
          id?: string
          last_synced_at?: string | null
          meta_bm_id?: string
          name?: string
          page_count?: number | null
          pixel_count?: number | null
          primary_page?: string | null
          status?: string | null
          updated_at?: string
          verification_status?: string | null
        }
        Relationships: []
      }
      meta_critical_events: {
        Row: {
          ad_account_id: string | null
          bm_id: string | null
          client_id: string | null
          created_at: string
          details: Json | null
          detected_at: string
          dispatch_log_id: string | null
          entity_meta_id: string
          entity_name: string | null
          entity_type: string
          event_type: string
          id: string
          notified_at: string | null
          notify_status: string
          reason: string | null
          severity: string
        }
        Insert: {
          ad_account_id?: string | null
          bm_id?: string | null
          client_id?: string | null
          created_at?: string
          details?: Json | null
          detected_at?: string
          dispatch_log_id?: string | null
          entity_meta_id: string
          entity_name?: string | null
          entity_type: string
          event_type: string
          id?: string
          notified_at?: string | null
          notify_status?: string
          reason?: string | null
          severity?: string
        }
        Update: {
          ad_account_id?: string | null
          bm_id?: string | null
          client_id?: string | null
          created_at?: string
          details?: Json | null
          detected_at?: string
          dispatch_log_id?: string | null
          entity_meta_id?: string
          entity_name?: string | null
          entity_type?: string
          event_type?: string
          id?: string
          notified_at?: string | null
          notify_status?: string
          reason?: string | null
          severity?: string
        }
        Relationships: []
      }
      meta_pages: {
        Row: {
          bm_id: string | null
          category: string | null
          created_at: string
          id: string
          is_published: boolean | null
          is_restricted: boolean | null
          last_synced_at: string | null
          meta_page_id: string
          name: string
          updated_at: string
        }
        Insert: {
          bm_id?: string | null
          category?: string | null
          created_at?: string
          id?: string
          is_published?: boolean | null
          is_restricted?: boolean | null
          last_synced_at?: string | null
          meta_page_id: string
          name: string
          updated_at?: string
        }
        Update: {
          bm_id?: string | null
          category?: string | null
          created_at?: string
          id?: string
          is_published?: boolean | null
          is_restricted?: boolean | null
          last_synced_at?: string | null
          meta_page_id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_pages_bm_id_fkey"
            columns: ["bm_id"]
            isOneToOne: false
            referencedRelation: "meta_business_managers"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          asset_id: string
          asset_type: string
          channel: string
          created_at: string
          enabled: boolean
          event_type: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          asset_id?: string
          asset_type?: string
          channel: string
          created_at?: string
          enabled?: boolean
          event_type: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          asset_id?: string
          asset_type?: string
          channel?: string
          created_at?: string
          enabled?: boolean
          event_type?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_states: {
        Row: {
          created_at: string
          id: string
          notification_id: string
          state: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notification_id: string
          state: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notification_id?: string
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      support_users: {
        Row: {
          auth_user_id: string | null
          created_at: string
          email: string
          id: string
          name: string
          password: string
          permissions: string[] | null
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          email: string
          id?: string
          name: string
          password: string
          permissions?: string[] | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          password?: string
          permissions?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          category: string
          client_id: string | null
          created_at: string
          date: string
          description: string
          id: string
          subcategory: string | null
          type: string
        }
        Insert: {
          amount: number
          category?: string
          client_id?: string | null
          created_at?: string
          date: string
          description: string
          id?: string
          subcategory?: string | null
          type?: string
        }
        Update: {
          amount?: number
          category?: string
          client_id?: string | null
          created_at?: string
          date?: string
          description?: string
          id?: string
          subcategory?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_dispatch_log: {
        Row: {
          billing_id: string | null
          client_id: string | null
          created_at: string
          error: string | null
          http_status: number | null
          id: string
          payload: Json | null
          phone: string | null
          response: string | null
          status: string
        }
        Insert: {
          billing_id?: string | null
          client_id?: string | null
          created_at?: string
          error?: string | null
          http_status?: number | null
          id?: string
          payload?: Json | null
          phone?: string | null
          response?: string | null
          status: string
        }
        Update: {
          billing_id?: string | null
          client_id?: string | null
          created_at?: string
          error?: string | null
          http_status?: number | null
          id?: string
          payload?: Json | null
          phone?: string | null
          response?: string | null
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "support" | "client"
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
      app_role: ["admin", "support", "client"],
    },
  },
} as const
