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
      area_responsibles: {
        Row: {
          area: string
          created_at: string
          created_by: string | null
          id: string
          support_user_id: string
        }
        Insert: {
          area: string
          created_at?: string
          created_by?: string | null
          id?: string
          support_user_id: string
        }
        Update: {
          area?: string
          created_at?: string
          created_by?: string | null
          id?: string
          support_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "area_responsibles_support_user_id_fkey"
            columns: ["support_user_id"]
            isOneToOne: false
            referencedRelation: "support_users"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          actor_role: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          actor_role?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          actor_role?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      bm_activity_log: {
        Row: {
          accounts_available: number | null
          activity_date: string
          activity_notes: string
          availability: string
          bm_id: string | null
          created_at: string
          created_by: string | null
          id: string
          updated_at: string
        }
        Insert: {
          accounts_available?: number | null
          activity_date?: string
          activity_notes: string
          availability?: string
          bm_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          accounts_available?: number | null
          activity_date?: string
          activity_notes?: string
          availability?: string
          bm_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bm_activity_log_bm_id_fkey"
            columns: ["bm_id"]
            isOneToOne: false
            referencedRelation: "meta_business_managers"
            referencedColumns: ["id"]
          },
        ]
      }
      bm_backup_assignments: {
        Row: {
          backup_id: string
          bm_id: string
          created_at: string
          id: string
        }
        Insert: {
          backup_id: string
          bm_id: string
          created_at?: string
          id?: string
        }
        Update: {
          backup_id?: string
          bm_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bm_backup_assignments_backup_id_fkey"
            columns: ["backup_id"]
            isOneToOne: false
            referencedRelation: "bm_backups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bm_backup_assignments_bm_id_fkey"
            columns: ["bm_id"]
            isOneToOne: false
            referencedRelation: "meta_business_managers"
            referencedColumns: ["id"]
          },
        ]
      }
      bm_backups: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          kind: string | null
          last_verified_at: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          kind?: string | null
          last_verified_at?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          kind?: string | null
          last_verified_at?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      bm_detected_users: {
        Row: {
          bm_id: string
          id: string
          meta_user_id: string
          scanned_at: string
          user_email: string | null
          user_kind: string | null
          user_name: string | null
          user_role: string | null
        }
        Insert: {
          bm_id: string
          id?: string
          meta_user_id: string
          scanned_at?: string
          user_email?: string | null
          user_kind?: string | null
          user_name?: string | null
          user_role?: string | null
        }
        Update: {
          bm_id?: string
          id?: string
          meta_user_id?: string
          scanned_at?: string
          user_email?: string | null
          user_kind?: string | null
          user_name?: string | null
          user_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bm_detected_users_bm_id_fkey"
            columns: ["bm_id"]
            isOneToOne: false
            referencedRelation: "meta_business_managers"
            referencedColumns: ["id"]
          },
        ]
      }
      bm_notes: {
        Row: {
          author_id: string | null
          author_name: string | null
          bm_id: string | null
          content: string
          created_at: string
          id: string
        }
        Insert: {
          author_id?: string | null
          author_name?: string | null
          bm_id?: string | null
          content: string
          created_at?: string
          id?: string
        }
        Update: {
          author_id?: string | null
          author_name?: string | null
          bm_id?: string | null
          content?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bm_notes_bm_id_fkey"
            columns: ["bm_id"]
            isOneToOne: false
            referencedRelation: "meta_business_managers"
            referencedColumns: ["id"]
          },
        ]
      }
      bm_profiles: {
        Row: {
          bm_id: string
          created_at: string
          created_by: string | null
          id: string
          is_whitelisted: boolean
          meta_user_id: string | null
          meta_user_kind: string | null
          notes: string | null
          profile_name: string
          profile_role: string | null
          updated_at: string
        }
        Insert: {
          bm_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_whitelisted?: boolean
          meta_user_id?: string | null
          meta_user_kind?: string | null
          notes?: string | null
          profile_name: string
          profile_role?: string | null
          updated_at?: string
        }
        Update: {
          bm_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_whitelisted?: boolean
          meta_user_id?: string | null
          meta_user_kind?: string | null
          notes?: string | null
          profile_name?: string
          profile_role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bm_profiles_bm_id_fkey"
            columns: ["bm_id"]
            isOneToOne: false
            referencedRelation: "meta_business_managers"
            referencedColumns: ["id"]
          },
        ]
      }
      client_notification_reads: {
        Row: {
          auth_user_id: string
          event_id: string
          id: string
          read_at: string
        }
        Insert: {
          auth_user_id: string
          event_id: string
          id?: string
          read_at?: string
        }
        Update: {
          auth_user_id?: string
          event_id?: string
          id?: string
          read_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_notification_reads_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "meta_critical_events"
            referencedColumns: ["id"]
          },
        ]
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
          custom_tiers: Json | null
          email: string
          fixed_value: number | null
          id: string
          meta_app_id: string | null
          name: string
          notify_whatsapp: boolean
          number: string | null
          observations: string | null
          partner_id: string | null
          password: string
          payment_type: string
          percentage_value: number | null
          phone: string | null
          plan_credit: number
          plan_credit_start_date: string | null
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
          custom_tiers?: Json | null
          email: string
          fixed_value?: number | null
          id?: string
          meta_app_id?: string | null
          name: string
          notify_whatsapp?: boolean
          number?: string | null
          observations?: string | null
          partner_id?: string | null
          password: string
          payment_type?: string
          percentage_value?: number | null
          phone?: string | null
          plan_credit?: number
          plan_credit_start_date?: string | null
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
          custom_tiers?: Json | null
          email?: string
          fixed_value?: number | null
          id?: string
          meta_app_id?: string | null
          name?: string
          notify_whatsapp?: boolean
          number?: string | null
          observations?: string | null
          partner_id?: string | null
          password?: string
          payment_type?: string
          percentage_value?: number | null
          phone?: string | null
          plan_credit?: number
          plan_credit_start_date?: string | null
          updated_at?: string
          used_accounts?: number | null
          whatsapp_group_link?: string | null
          whatsapp_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_meta_app_id_fkey"
            columns: ["meta_app_id"]
            isOneToOne: false
            referencedRelation: "meta_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_sync_log: {
        Row: {
          created_at: string
          duration_ms: number | null
          error_count: number
          error_message: string | null
          id: string
          inserted_count: number
          skipped_count: number
          source: string
          triggered_by: string | null
          triggered_by_email: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error_count?: number
          error_message?: string | null
          id?: string
          inserted_count?: number
          skipped_count?: number
          source?: string
          triggered_by?: string | null
          triggered_by_email?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error_count?: number
          error_message?: string | null
          id?: string
          inserted_count?: number
          skipped_count?: number
          source?: string
          triggered_by?: string | null
          triggered_by_email?: string | null
        }
        Relationships: []
      }
      commission_tiers: {
        Row: {
          created_at: string
          id: string
          min_spend: number
          pct: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          min_spend: number
          pct: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          min_spend?: number
          pct?: number
          updated_at?: string
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
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      internal_tasks: {
        Row: {
          assigned_to: string | null
          category: string
          client_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: string
          scope: string
          status: string
          structure_type: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          scope?: string
          status?: string
          structure_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          scope?: string
          status?: string
          structure_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      meta_ad_account_assignments: {
        Row: {
          active: boolean | null
          ad_account_id: string
          assigned_at: string
          client_id: string
          effective_from: string
          effective_to: string | null
          id: string
        }
        Insert: {
          active?: boolean | null
          ad_account_id: string
          assigned_at?: string
          client_id: string
          effective_from?: string
          effective_to?: string | null
          id?: string
        }
        Update: {
          active?: boolean | null
          ad_account_id?: string
          assigned_at?: string
          client_id?: string
          effective_from?: string
          effective_to?: string | null
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
          meta_app_id: string | null
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
          meta_app_id?: string | null
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
          meta_app_id?: string | null
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
          {
            foreignKeyName: "meta_ad_accounts_meta_app_id_fkey"
            columns: ["meta_app_id"]
            isOneToOne: false
            referencedRelation: "meta_apps"
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
      meta_apps: {
        Row: {
          app_id: string
          app_secret: string | null
          created_at: string
          id: string
          is_default: boolean
          label: string
          last_used_at: string | null
          notes: string | null
          status: string
          system_user_token: string | null
          updated_at: string
          user_access_token: string | null
        }
        Insert: {
          app_id: string
          app_secret?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          label: string
          last_used_at?: string | null
          notes?: string | null
          status?: string
          system_user_token?: string | null
          updated_at?: string
          user_access_token?: string | null
        }
        Update: {
          app_id?: string
          app_secret?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          last_used_at?: string | null
          notes?: string | null
          status?: string
          system_user_token?: string | null
          updated_at?: string
          user_access_token?: string | null
        }
        Relationships: []
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
          meta_app_id: string | null
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
          meta_app_id?: string | null
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
          meta_app_id?: string | null
          meta_bm_id?: string
          name?: string
          page_count?: number | null
          pixel_count?: number | null
          primary_page?: string | null
          status?: string | null
          updated_at?: string
          verification_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_business_managers_meta_app_id_fkey"
            columns: ["meta_app_id"]
            isOneToOne: false
            referencedRelation: "meta_apps"
            referencedColumns: ["id"]
          },
        ]
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
      meta_page_assignments: {
        Row: {
          active: boolean
          assigned_at: string
          client_id: string
          id: string
          page_id: string
        }
        Insert: {
          active?: boolean
          assigned_at?: string
          client_id: string
          id?: string
          page_id: string
        }
        Update: {
          active?: boolean
          assigned_at?: string
          client_id?: string
          id?: string
          page_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_page_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_page_assignments_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "meta_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_pages: {
        Row: {
          bm_id: string | null
          category: string | null
          created_at: string
          created_time: string | null
          fan_count: number | null
          followers_count: number | null
          id: string
          is_published: boolean | null
          is_restricted: boolean | null
          last_synced_at: string | null
          meta_app_id: string | null
          meta_page_id: string
          name: string
          picture_url: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          bm_id?: string | null
          category?: string | null
          created_at?: string
          created_time?: string | null
          fan_count?: number | null
          followers_count?: number | null
          id?: string
          is_published?: boolean | null
          is_restricted?: boolean | null
          last_synced_at?: string | null
          meta_app_id?: string | null
          meta_page_id: string
          name: string
          picture_url?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          bm_id?: string | null
          category?: string | null
          created_at?: string
          created_time?: string | null
          fan_count?: number | null
          followers_count?: number | null
          id?: string
          is_published?: boolean | null
          is_restricted?: boolean | null
          last_synced_at?: string | null
          meta_app_id?: string | null
          meta_page_id?: string
          name?: string
          picture_url?: string | null
          status?: string | null
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
          {
            foreignKeyName: "meta_pages_meta_app_id_fkey"
            columns: ["meta_app_id"]
            isOneToOne: false
            referencedRelation: "meta_apps"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_sync_jobs: {
        Row: {
          created_at: string
          errors: Json
          finished_at: string | null
          id: string
          kind: string
          message: string | null
          progress_current: number
          progress_total: number
          started_at: string | null
          status: string
          synced_count: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          errors?: Json
          finished_at?: string | null
          id?: string
          kind: string
          message?: string | null
          progress_current?: number
          progress_total?: number
          started_at?: string | null
          status?: string
          synced_count?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          errors?: Json
          finished_at?: string | null
          id?: string
          kind?: string
          message?: string | null
          progress_current?: number
          progress_total?: number
          started_at?: string | null
          status?: string
          synced_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      meta_user_whitelist: {
        Row: {
          backup_id: string | null
          created_at: string
          created_by: string | null
          display_name: string
          id: string
          meta_user_id: string
          meta_user_kind: string | null
          notes: string | null
          updated_at: string
        }
        Insert: {
          backup_id?: string | null
          created_at?: string
          created_by?: string | null
          display_name: string
          id?: string
          meta_user_id: string
          meta_user_kind?: string | null
          notes?: string | null
          updated_at?: string
        }
        Update: {
          backup_id?: string | null
          created_at?: string
          created_by?: string | null
          display_name?: string
          id?: string
          meta_user_id?: string
          meta_user_kind?: string | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_user_whitelist_backup_id_fkey"
            columns: ["backup_id"]
            isOneToOne: false
            referencedRelation: "bm_backups"
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
      order_deliveries: {
        Row: {
          created_at: string
          delivered_at: string
          delivered_by: string | null
          delivery_mode: string
          id: string
          order_id: string
          order_item_id: string | null
          payload: Json
          product_id: string
          stock_id: string | null
        }
        Insert: {
          created_at?: string
          delivered_at?: string
          delivered_by?: string | null
          delivery_mode?: string
          id?: string
          order_id: string
          order_item_id?: string | null
          payload?: Json
          product_id: string
          stock_id?: string | null
        }
        Update: {
          created_at?: string
          delivered_at?: string
          delivered_by?: string | null
          delivery_mode?: string
          id?: string
          order_id?: string
          order_item_id?: string | null
          payload?: Json
          product_id?: string
          stock_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_deliveries_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_deliveries_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_deliveries_stock_id_fkey"
            columns: ["stock_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          cost_snapshot: number
          created_at: string
          id: string
          order_id: string
          product_id: string
          product_name_snapshot: string | null
          quantity: number
          unit_price: number
        }
        Insert: {
          cost_snapshot?: number
          created_at?: string
          id?: string
          order_id: string
          product_id: string
          product_name_snapshot?: string | null
          quantity?: number
          unit_price?: number
        }
        Update: {
          cost_snapshot?: number
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string
          product_name_snapshot?: string | null
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          client_id: string
          created_at: string
          delivered_at: string | null
          delivery_mode: string
          id: string
          notes: string | null
          paid_at: string | null
          status: string
          total: number
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          delivered_at?: string | null
          delivery_mode?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          status?: string
          total?: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          delivered_at?: string | null
          delivery_mode?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          status?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_commissions: {
        Row: {
          amount: number
          base_amount: number
          client_id: string
          created_at: string
          id: string
          note: string | null
          paid_at: string | null
          partner_id: string
          pct_applied: number
          source_commission_id: string | null
          status: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          base_amount?: number
          client_id: string
          created_at?: string
          id?: string
          note?: string | null
          paid_at?: string | null
          partner_id: string
          pct_applied?: number
          source_commission_id?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          base_amount?: number
          client_id?: string
          created_at?: string
          id?: string
          note?: string | null
          paid_at?: string | null
          partner_id?: string
          pct_applied?: number
          source_commission_id?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_commissions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_commissions_source_commission_id_fkey"
            columns: ["source_commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          auth_user_id: string | null
          commission_pct: number
          created_at: string
          email: string
          id: string
          name: string
          notes: string | null
          pix_key: string | null
          status: string
          updated_at: string
          whatsapp_phone: string | null
        }
        Insert: {
          auth_user_id?: string | null
          commission_pct?: number
          created_at?: string
          email: string
          id?: string
          name: string
          notes?: string | null
          pix_key?: string | null
          status?: string
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Update: {
          auth_user_id?: string | null
          commission_pct?: number
          created_at?: string
          email?: string
          id?: string
          name?: string
          notes?: string | null
          pix_key?: string | null
          status?: string
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          br_code: string | null
          charge_id: string | null
          correlation_id: string | null
          created_at: string
          expires_at: string | null
          id: string
          order_id: string
          paid_at: string | null
          provider: string
          qr_code: string | null
          raw_webhook: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          br_code?: string | null
          charge_id?: string | null
          correlation_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          order_id: string
          paid_at?: string | null
          provider?: string
          qr_code?: string | null
          raw_webhook?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          br_code?: string | null
          charge_id?: string | null
          correlation_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          order_id?: string
          paid_at?: string | null
          provider?: string
          qr_code?: string | null
          raw_webhook?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_stock: {
        Row: {
          created_at: string
          delivered_at: string | null
          id: string
          notes: string | null
          order_id: string | null
          payload: Json
          product_id: string
          reserved_until: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          payload?: Json
          product_id: string
          reserved_until?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          payload?: Json
          product_id?: string
          reserved_until?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          category: string
          cost_price: number
          country: string | null
          created_at: string
          description: string | null
          discount_price: number | null
          id: string
          image_url: string | null
          is_featured: boolean
          is_new: boolean
          name: string
          sale_price: number
          slug: string
          sort_order: number
          subcategory: string | null
          tags: string[] | null
          updated_at: string
          warranty_terms: string | null
        }
        Insert: {
          active?: boolean
          category: string
          cost_price?: number
          country?: string | null
          created_at?: string
          description?: string | null
          discount_price?: number | null
          id?: string
          image_url?: string | null
          is_featured?: boolean
          is_new?: boolean
          name: string
          sale_price?: number
          slug: string
          sort_order?: number
          subcategory?: string | null
          tags?: string[] | null
          updated_at?: string
          warranty_terms?: string | null
        }
        Update: {
          active?: boolean
          category?: string
          cost_price?: number
          country?: string | null
          created_at?: string
          description?: string | null
          discount_price?: number | null
          id?: string
          image_url?: string | null
          is_featured?: boolean
          is_new?: boolean
          name?: string
          sale_price?: number
          slug?: string
          sort_order?: number
          subcategory?: string | null
          tags?: string[] | null
          updated_at?: string
          warranty_terms?: string | null
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          created_at: string
          id: string
          name: string
          note: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          note?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          note?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      support_requests: {
        Row: {
          assigned_to: string | null
          bm_meta_id: string | null
          client_id: string
          created_at: string
          description: string | null
          id: string
          page_names: string[] | null
          quantity: number
          request_type: string
          resolved_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          bm_meta_id?: string | null
          client_id: string
          created_at?: string
          description?: string | null
          id?: string
          page_names?: string[] | null
          quantity?: number
          request_type: string
          resolved_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          bm_meta_id?: string | null
          client_id?: string
          created_at?: string
          description?: string | null
          id?: string
          page_names?: string[] | null
          quantity?: number
          request_type?: string
          resolved_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      support_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
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
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          category: string
          client_id: string | null
          created_at: string
          custo_produto: number | null
          date: string
          description: string
          id: string
          quantidade: number
          subcategory: string | null
          supplier_id: string | null
          type: string
          valor_venda: number | null
        }
        Insert: {
          amount: number
          category?: string
          client_id?: string | null
          created_at?: string
          custo_produto?: number | null
          date: string
          description: string
          id?: string
          quantidade?: number
          subcategory?: string | null
          supplier_id?: string | null
          type?: string
          valor_venda?: number | null
        }
        Update: {
          amount?: number
          category?: string
          client_id?: string | null
          created_at?: string
          custo_produto?: number | null
          date?: string
          description?: string
          id?: string
          quantidade?: number
          subcategory?: string | null
          supplier_id?: string | null
          type?: string
          valor_venda?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
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
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      reserve_stock: {
        Args: { _order_id: string; _product_id: string; _qty: number }
        Returns: {
          created_at: string
          delivered_at: string | null
          id: string
          notes: string | null
          order_id: string | null
          payload: Json
          product_id: string
          reserved_until: string | null
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "product_stock"
          isOneToOne: false
          isSetofReturn: true
        }
      }
    }
    Enums: {
      app_role: "admin" | "support" | "client" | "partner"
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
      app_role: ["admin", "support", "client", "partner"],
    },
  },
} as const
