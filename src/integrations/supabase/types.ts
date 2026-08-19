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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          at: string
          entity_id: string | null
          entity_type: string
          id: string
          meta: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          meta?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          meta?: Json
        }
        Relationships: []
      }
      affiliate_programs: {
        Row: {
          active: boolean
          commission_percent: number
          commission_valid_months: number
          created_at: string
          id: string
          org_id: string
          referral_code: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          commission_percent?: number
          commission_valid_months?: number
          created_at?: string
          id?: string
          org_id: string
          referral_code: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          commission_percent?: number
          commission_valid_months?: number
          created_at?: string
          id?: string
          org_id?: string
          referral_code?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_programs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_programs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_referrals: {
        Row: {
          affiliate_id: string
          commission_earned: number
          commission_paid: boolean
          created_at: string
          id: string
          paid_at: string | null
          referred_org_id: string | null
          referred_user_id: string
          subscription_id: string | null
          updated_at: string
        }
        Insert: {
          affiliate_id: string
          commission_earned?: number
          commission_paid?: boolean
          created_at?: string
          id?: string
          paid_at?: string | null
          referred_org_id?: string | null
          referred_user_id: string
          subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          affiliate_id?: string
          commission_earned?: number
          commission_paid?: boolean
          created_at?: string
          id?: string
          paid_at?: string | null
          referred_org_id?: string | null
          referred_user_id?: string
          subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_referrals_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliate_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_referrals_referred_org_id_fkey"
            columns: ["referred_org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_referrals_referred_user_id_fkey"
            columns: ["referred_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      asaas_webhook_events: {
        Row: {
          event: string
          id: string
          payload: Json
          processed_at: string
        }
        Insert: {
          event: string
          id: string
          payload: Json
          processed_at?: string
        }
        Update: {
          event?: string
          id?: string
          payload?: Json
          processed_at?: string
        }
        Relationships: []
      }
      automation_rules: {
        Row: {
          action_status: string | null
          action_type: string
          action_user_id: string | null
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          on_create: boolean
          org_id: string
          trigger_status: string | null
        }
        Insert: {
          action_status?: string | null
          action_type: string
          action_user_id?: string | null
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          on_create?: boolean
          org_id: string
          trigger_status?: string | null
        }
        Update: {
          action_status?: string | null
          action_type?: string
          action_user_id?: string | null
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          on_create?: boolean
          org_id?: string
          trigger_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      bug_reports: {
        Row: {
          created_at: string
          id: string
          message: string
          org_id: string
          page_url: string | null
          reported_by: string
          screenshot_path: string | null
          status: string
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          org_id: string
          page_url?: string | null
          reported_by: string
          screenshot_path?: string | null
          status?: string
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          org_id?: string
          page_url?: string | null
          reported_by?: string
          screenshot_path?: string | null
          status?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bug_reports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaning_log: {
        Row: {
          created_at: string
          done_at: string | null
          done_by: string | null
          id: string
          occurrence_date: string
          org_id: string
          status: string
          task_id: string
          updated_at: string
          user_id: string | null
          weekday: number
        }
        Insert: {
          created_at?: string
          done_at?: string | null
          done_by?: string | null
          id?: string
          occurrence_date: string
          org_id: string
          status: string
          task_id: string
          updated_at?: string
          user_id?: string | null
          weekday: number
        }
        Update: {
          created_at?: string
          done_at?: string | null
          done_by?: string | null
          id?: string
          occurrence_date?: string
          org_id?: string
          status?: string
          task_id?: string
          updated_at?: string
          user_id?: string | null
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "cleaning_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaning_log_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "cleaning_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaning_schedule: {
        Row: {
          created_at: string
          id: string
          label: string | null
          org_id: string
          task_id: string
          updated_at: string
          user_id: string | null
          weekday: number
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          org_id: string
          task_id: string
          updated_at?: string
          user_id?: string | null
          weekday: number
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          org_id?: string
          task_id?: string
          updated_at?: string
          user_id?: string | null
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "cleaning_schedule_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaning_schedule_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "cleaning_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaning_settings: {
        Row: {
          note: string
          org_id: string
          updated_at: string
        }
        Insert: {
          note?: string
          org_id: string
          updated_at?: string
        }
        Update: {
          note?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cleaning_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaning_tasks: {
        Row: {
          created_at: string
          id: string
          name: string
          org_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          org_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "cleaning_tasks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contacts: {
        Row: {
          client_id: string
          created_at: string
          email: string
          id: string
          name: string
          notes: string
          phone: string
          position: number
          role: string
        }
        Insert: {
          client_id: string
          created_at?: string
          email?: string
          id?: string
          name: string
          notes?: string
          phone?: string
          position?: number
          role?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          notes?: string
          phone?: string
          position?: number
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_docs: {
        Row: {
          client_id: string
          content: string
          created_at: string
          created_by: string | null
          id: string
          org_id: string
          title: string | null
          type: string
          updated_at: string
        }
        Insert: {
          client_id: string
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          org_id: string
          title?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          org_id?: string
          title?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_docs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_docs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      client_doc_roteiro_status: {
        Row: {
          adjust_note: string | null
          client_note: string | null
          client_responded_at: string | null
          client_status: string
          content_item_id: string | null
          doc_id: string
          gravado: boolean
          id: string
          org_id: string
          roteiro_title: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          adjust_note?: string | null
          client_note?: string | null
          client_responded_at?: string | null
          client_status?: string
          content_item_id?: string | null
          doc_id: string
          gravado?: boolean
          id?: string
          org_id: string
          roteiro_title: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          adjust_note?: string | null
          client_note?: string | null
          client_responded_at?: string | null
          client_status?: string
          content_item_id?: string | null
          doc_id?: string
          gravado?: boolean
          id?: string
          org_id?: string
          roteiro_title?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_doc_roteiro_status_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_doc_roteiro_status_doc_id_fkey"
            columns: ["doc_id"]
            isOneToOne: false
            referencedRelation: "client_docs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_doc_roteiro_status_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      client_drive_map: {
        Row: {
          client_id: string
          confirmed_by: string | null
          created_at: string
          deliveries_folder_id: string | null
          drive_folder_id: string
          updated_at: string
        }
        Insert: {
          client_id: string
          confirmed_by?: string | null
          created_at?: string
          deliveries_folder_id?: string | null
          drive_folder_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          confirmed_by?: string | null
          created_at?: string
          deliveries_folder_id?: string | null
          drive_folder_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_drive_map_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_feedback: {
        Row: {
          author_name: string
          created_at: string
          id: string
          item_id: string
          share_token: string | null
          text: string
        }
        Insert: {
          author_name: string
          created_at?: string
          id?: string
          item_id: string
          share_token?: string | null
          text: string
        }
        Update: {
          author_name?: string
          created_at?: string
          id?: string
          item_id?: string
          share_token?: string | null
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_feedback_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      client_instagram_credentials: {
        Row: {
          access_token: string
          client_id: string
          connected_at: string
          connected_by: string | null
          ig_username: string | null
          instagram_business_account_id: string
        }
        Insert: {
          access_token: string
          client_id: string
          connected_at?: string
          connected_by?: string | null
          ig_username?: string | null
          instagram_business_account_id: string
        }
        Update: {
          access_token?: string
          client_id?: string
          connected_at?: string
          connected_by?: string | null
          ig_username?: string | null
          instagram_business_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_instagram_credentials_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_instagram_credentials_connected_by_fkey"
            columns: ["connected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_journey_stages: {
        Row: {
          created_at: string
          description: string
          id: string
          milestone_type: string | null
          name: string
          org_id: string
          sort_order: number
          track: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          milestone_type?: string | null
          name: string
          org_id: string
          sort_order?: number
          track: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          milestone_type?: string | null
          name?: string
          org_id?: string
          sort_order?: number
          track?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_journey_stages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      client_links: {
        Row: {
          client_id: string
          created_at: string
          id: string
          label: string
          link_type: string
          position: number
          url: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          label: string
          link_type?: string
          position?: number
          url: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          label?: string
          link_type?: string
          position?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_links_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_onboarding: {
        Row: {
          checklist: Json
          client_id: string
          completed_at: string | null
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          checklist?: Json
          client_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          checklist?: Json
          client_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_onboarding_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_secrets: {
        Row: {
          client_id: string
          created_at: string
          id: string
          label: string
          position: number
          value: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          label: string
          position?: number
          value: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          label?: string
          position?: number
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_secrets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_stage_history: {
        Row: {
          client_id: string
          entered_at: string
          id: string
          org_id: string
          stage_id: string
        }
        Insert: {
          client_id: string
          entered_at?: string
          id?: string
          org_id: string
          stage_id: string
        }
        Update: {
          client_id?: string
          entered_at?: string
          id?: string
          org_id?: string
          stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_stage_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_stage_history_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_stage_history_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "client_journey_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      client_stage_updates: {
        Row: {
          client_id: string
          id: string
          message: string
          org_id: string
          sent_at: string
          sent_by: string
          stage_id: string | null
          trigger: string
        }
        Insert: {
          client_id: string
          id?: string
          message: string
          org_id: string
          sent_at?: string
          sent_by: string
          stage_id?: string | null
          trigger: string
        }
        Update: {
          client_id?: string
          id?: string
          message?: string
          org_id?: string
          sent_at?: string
          sent_by?: string
          stage_id?: string | null
          trigger?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_stage_updates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_stage_updates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_stage_updates_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_stage_updates_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "client_journey_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          active_month_id: string | null
          archived: boolean
          category: string
          color: string
          contract_value: number | null
          created_at: string
          current_stage_id: string | null
          description: string
          favorite: boolean
          fixed_responsible_id: string | null
          icon: string | null
          id: string
          name: string
          niche: string | null
          notes: string | null
          notify_stories_in_tasks: boolean
          org_id: string | null
          photo_url: string | null
          posts_per_week: number | null
          reels_per_week: number | null
          review_day: string | null
          whatsapp_group_link: string | null
        }
        Insert: {
          active_month_id?: string | null
          archived?: boolean
          category?: string
          color?: string
          contract_value?: number | null
          created_at?: string
          current_stage_id?: string | null
          description?: string
          favorite?: boolean
          fixed_responsible_id?: string | null
          icon?: string | null
          id?: string
          name: string
          niche?: string | null
          notes?: string | null
          notify_stories_in_tasks?: boolean
          org_id?: string | null
          photo_url?: string | null
          posts_per_week?: number | null
          reels_per_week?: number | null
          review_day?: string | null
          whatsapp_group_link?: string | null
        }
        Update: {
          active_month_id?: string | null
          archived?: boolean
          category?: string
          color?: string
          contract_value?: number | null
          created_at?: string
          current_stage_id?: string | null
          description?: string
          favorite?: boolean
          fixed_responsible_id?: string | null
          icon?: string | null
          id?: string
          name?: string
          niche?: string | null
          notes?: string | null
          notify_stories_in_tasks?: boolean
          org_id?: string | null
          photo_url?: string | null
          posts_per_week?: number | null
          reels_per_week?: number | null
          review_day?: string | null
          whatsapp_group_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_active_month_id_fkey"
            columns: ["active_month_id"]
            isOneToOne: false
            referencedRelation: "months"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_current_stage_id_fkey"
            columns: ["current_stage_id"]
            isOneToOne: false
            referencedRelation: "client_journey_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_fixed_responsible_id_fkey"
            columns: ["fixed_responsible_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string | null
          created_at: string
          edited_at: string | null
          id: string
          is_system: boolean
          item_id: string
          text: string
        }
        Insert: {
          author_id?: string | null
          created_at?: string
          edited_at?: string | null
          id?: string
          is_system?: boolean
          item_id: string
          text: string
        }
        Update: {
          author_id?: string | null
          created_at?: string
          edited_at?: string | null
          id?: string
          is_system?: boolean
          item_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      content_items: {
        Row: {
          activity_location: string | null
          activity_quantity: number | null
          blocked_reason: string | null
          caption: string
          checklist: Json
          copy: string
          cover_path: string | null
          cover_source: string | null
          drive_link: string
          due_date: string | null
          editor_id: string | null
          feed_order: number | null
          finished_at: string | null
          id: string
          idx: number
          ig_auto_publish: boolean
          ig_media_id: string | null
          ig_published_at: string | null
          last_status_change_at: string | null
          legacy_assignee: string | null
          month_id: string
          org_id: string
          post_format: string | null
          quality_rating: number | null
          reel_type: string | null
          rework_count: number
          scheduled_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["content_status"]
          title: string
          type: Database["public"]["Enums"]["content_type"]
          updated_at: string
        }
        Insert: {
          activity_location?: string | null
          activity_quantity?: number | null
          blocked_reason?: string | null
          caption?: string
          checklist?: Json
          copy?: string
          cover_path?: string | null
          cover_source?: string | null
          drive_link?: string
          due_date?: string | null
          editor_id?: string | null
          feed_order?: number | null
          finished_at?: string | null
          id?: string
          idx: number
          ig_auto_publish?: boolean
          ig_media_id?: string | null
          ig_published_at?: string | null
          last_status_change_at?: string | null
          legacy_assignee?: string | null
          month_id: string
          org_id: string
          post_format?: string | null
          quality_rating?: number | null
          reel_type?: string | null
          rework_count?: number
          scheduled_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          type: Database["public"]["Enums"]["content_type"]
          updated_at?: string
        }
        Update: {
          activity_location?: string | null
          activity_quantity?: number | null
          blocked_reason?: string | null
          caption?: string
          checklist?: Json
          copy?: string
          cover_path?: string | null
          cover_source?: string | null
          drive_link?: string
          due_date?: string | null
          editor_id?: string | null
          feed_order?: number | null
          finished_at?: string | null
          id?: string
          idx?: number
          ig_auto_publish?: boolean
          ig_media_id?: string | null
          ig_published_at?: string | null
          last_status_change_at?: string | null
          legacy_assignee?: string | null
          month_id?: string
          org_id?: string
          post_format?: string | null
          quality_rating?: number | null
          reel_type?: string | null
          rework_count?: number
          scheduled_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          type?: Database["public"]["Enums"]["content_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_items_editor_id_fkey"
            columns: ["editor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_month_id_fkey"
            columns: ["month_id"]
            isOneToOne: false
            referencedRelation: "months"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      deadline_notifications_log: {
        Row: {
          created_at: string
          id: string
          item_id: string
          kind: string
          sent_on: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          kind: string
          sent_on: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          kind?: string
          sent_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "deadline_notifications_log_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      email_role_assignments: {
        Row: {
          email: string
          name: string
          org_id: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          email: string
          name: string
          org_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          email?: string
          name?: string
          org_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "email_role_assignments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_share_tokens: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          month_id: string | null
          revoked_at: string | null
          token: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          month_id?: string | null
          revoked_at?: string | null
          token: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          month_id?: string | null
          revoked_at?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_share_tokens_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_share_tokens_month_id_fkey"
            columns: ["month_id"]
            isOneToOne: false
            referencedRelation: "months"
            referencedColumns: ["id"]
          },
        ]
      }
      finalizations: {
        Row: {
          finalized_at: string
          id: string
          item_id: string | null
          user_id: string
        }
        Insert: {
          finalized_at?: string
          id?: string
          item_id?: string | null
          user_id: string
        }
        Update: {
          finalized_at?: string
          id?: string
          item_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finalizations_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finalizations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      item_assignees: {
        Row: {
          created_at: string
          item_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          item_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_assignees_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_assignees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      item_files: {
        Row: {
          added_by: string | null
          created_at: string
          drive_file_id: string
          icon_url: string | null
          id: string
          item_id: string
          kind: string
          mime_type: string | null
          name: string
          size_bytes: number | null
          sort_order: number
          thumbnail_url: string | null
          updated_at: string
          web_view_url: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          drive_file_id: string
          icon_url?: string | null
          id?: string
          item_id: string
          kind?: string
          mime_type?: string | null
          name: string
          size_bytes?: number | null
          sort_order?: number
          thumbnail_url?: string | null
          updated_at?: string
          web_view_url: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          drive_file_id?: string
          icon_url?: string | null
          id?: string
          item_id?: string
          kind?: string
          mime_type?: string | null
          name?: string
          size_bytes?: number | null
          sort_order?: number
          thumbnail_url?: string | null
          updated_at?: string
          web_view_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_files_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_files_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      member_goals: {
        Row: {
          created_at: string
          id: string
          month_key: string
          posts_goal: number
          reels_goal: number
          stories_goal: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          month_key: string
          posts_goal?: number
          reels_goal?: number
          stories_goal?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          month_key?: string
          posts_goal?: number
          reels_goal?: number
          stories_goal?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mentions: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          item_id: string | null
          mentioned_user_id: string
          read_at: string | null
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          item_id?: string | null
          mentioned_user_id: string
          read_at?: string | null
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          item_id?: string | null
          mentioned_user_id?: string
          read_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mentions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      months: {
        Row: {
          client_approved_at: string | null
          client_id: string
          created_at: string
          feed_order_direction: string
          feed_order_mode: string
          id: string
          key: string
          org_id: string
        }
        Insert: {
          client_approved_at?: string | null
          client_id: string
          created_at?: string
          feed_order_direction?: string
          feed_order_mode?: string
          id?: string
          key: string
          org_id: string
        }
        Update: {
          client_approved_at?: string | null
          client_id?: string
          created_at?: string
          feed_order_direction?: string
          feed_order_mode?: string
          id?: string
          key?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "months_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "months_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          daily_digest: boolean
          deadline_alerts: boolean
          digest_hour: number
          push_assigned: boolean
          push_bug_report: boolean
          push_client_feedback: boolean
          push_comment: boolean
          push_mention: boolean
          push_status: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_digest?: boolean
          deadline_alerts?: boolean
          digest_hour?: number
          push_assigned?: boolean
          push_bug_report?: boolean
          push_client_feedback?: boolean
          push_comment?: boolean
          push_mention?: boolean
          push_status?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_digest?: boolean
          deadline_alerts?: boolean
          digest_hour?: number
          push_assigned?: boolean
          push_bug_report?: boolean
          push_client_feedback?: boolean
          push_comment?: boolean
          push_mention?: boolean
          push_status?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          client_id: string | null
          created_at: string
          id: string
          item_id: string | null
          message: string
          push_sent_at: string | null
          read: boolean
          type: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          id?: string
          item_id?: string | null
          message: string
          push_sent_at?: string | null
          read?: boolean
          type: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          id?: string
          item_id?: string | null
          message?: string
          push_sent_at?: string | null
          read?: boolean
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_checklist_defaults: {
        Row: {
          created_at: string
          id: string
          label: string
          org_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          org_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          org_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_checklist_defaults_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      org_google_credentials: {
        Row: {
          connected_at: string
          connected_by: string | null
          drive_email: string | null
          org_id: string
          refresh_token: string
        }
        Insert: {
          connected_at?: string
          connected_by?: string | null
          drive_email?: string | null
          org_id: string
          refresh_token: string
        }
        Update: {
          connected_at?: string
          connected_by?: string | null
          drive_email?: string | null
          org_id?: string
          refresh_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_google_credentials_connected_by_fkey"
            columns: ["connected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_google_credentials_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      orgs: {
        Row: {
          asaas_customer_id: string | null
          asaas_subscription_id: string | null
          avg_hours_by_type: Json
          color_primary: string | null
          color_primary_light: string | null
          color_sidebar: string | null
          created_at: string
          disabled_features: string[]
          favicon_path: string | null
          feed_preview_image_path: string | null
          hourly_cost: number | null
          id: string
          logo_path: string | null
          members_can_set_editor_format: boolean
          name: string
          plan_id: string
          promotion_code_id: string | null
          setor_permissions: string[]
          slug: string
          subscription_status: string
          tagline: string | null
          tax_id: string | null
          trial_ends_at: string | null
          whatsapp: string | null
        }
        Insert: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          avg_hours_by_type?: Json
          color_primary?: string | null
          color_primary_light?: string | null
          color_sidebar?: string | null
          created_at?: string
          disabled_features?: string[]
          favicon_path?: string | null
          feed_preview_image_path?: string | null
          hourly_cost?: number | null
          id?: string
          logo_path?: string | null
          members_can_set_editor_format?: boolean
          name: string
          plan_id?: string
          promotion_code_id?: string | null
          setor_permissions?: string[]
          slug: string
          subscription_status?: string
          tagline?: string | null
          tax_id?: string | null
          trial_ends_at?: string | null
          whatsapp?: string | null
        }
        Update: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          avg_hours_by_type?: Json
          color_primary?: string | null
          color_primary_light?: string | null
          color_sidebar?: string | null
          created_at?: string
          disabled_features?: string[]
          favicon_path?: string | null
          feed_preview_image_path?: string | null
          hourly_cost?: number | null
          id?: string
          logo_path?: string | null
          members_can_set_editor_format?: boolean
          name?: string
          plan_id?: string
          promotion_code_id?: string | null
          setor_permissions?: string[]
          slug?: string
          subscription_status?: string
          tagline?: string | null
          tax_id?: string | null
          trial_ends_at?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orgs_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orgs_promotion_code_id_fkey"
            columns: ["promotion_code_id"]
            isOneToOne: false
            referencedRelation: "promotion_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          features: Json
          id: string
          max_clients: number | null
          max_collaborators: number | null
          name: string
          price_cents: number | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          features?: Json
          id: string
          max_clients?: number | null
          max_collaborators?: number | null
          name: string
          price_cents?: number | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          features?: Json
          id?: string
          max_clients?: number | null
          max_collaborators?: number | null
          name?: string
          price_cents?: number | null
          sort_order?: number
        }
        Relationships: []
      }
      platform_updates: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          link_label: string | null
          link_path: string | null
          published_at: string
          title: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          link_label?: string | null
          link_path?: string | null
          published_at?: string
          title: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          link_label?: string | null
          link_path?: string | null
          published_at?: string
          title?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          avatar_url: string | null
          color: string
          created_at: string
          email: string
          exclude_from_ranking: boolean
          icon: string | null
          id: string
          name: string
          onboarded_at: string | null
          org_id: string | null
          tour_completed_at: string | null
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          color?: string
          created_at?: string
          email: string
          exclude_from_ranking?: boolean
          icon?: string | null
          id: string
          name: string
          onboarded_at?: string | null
          org_id?: string | null
          tour_completed_at?: string | null
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          color?: string
          created_at?: string
          email?: string
          exclude_from_ranking?: boolean
          icon?: string | null
          id?: string
          name?: string
          onboarded_at?: string | null
          org_id?: string | null
          tour_completed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      promotion_codes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string
          description: string | null
          discount_percent: number
          id: string
          max_uses: number | null
          name: string
          org_id: string
          slug: string
          updated_at: string
          used_count: number
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by: string
          description?: string | null
          discount_percent: number
          id?: string
          max_uses?: number | null
          name: string
          org_id: string
          slug: string
          updated_at?: string
          used_count?: number
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string
          description?: string | null
          discount_percent?: number
          id?: string
          max_uses?: number | null
          name?: string
          org_id?: string
          slug?: string
          updated_at?: string
          used_count?: number
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promotion_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_codes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_events: {
        Row: {
          affiliate_referral_id: string | null
          amount_cents: number | null
          created_at: string
          discount_percent: number | null
          id: string
          org_id: string
          plan_id: string
          promotion_code_id: string | null
        }
        Insert: {
          affiliate_referral_id?: string | null
          amount_cents?: number | null
          created_at?: string
          discount_percent?: number | null
          id?: string
          org_id: string
          plan_id: string
          promotion_code_id?: string | null
        }
        Update: {
          affiliate_referral_id?: string | null
          amount_cents?: number | null
          created_at?: string
          discount_percent?: number | null
          id?: string
          org_id?: string
          plan_id?: string
          promotion_code_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_events_affiliate_referral_id_fkey"
            columns: ["affiliate_referral_id"]
            isOneToOne: false
            referencedRelation: "affiliate_referrals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_events_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_events_promotion_code_id_fkey"
            columns: ["promotion_code_id"]
            isOneToOne: false
            referencedRelation: "promotion_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_templates: {
        Row: {
          active: boolean
          cadence: string
          client_id: string
          created_at: string
          day_of_month: number | null
          day_of_week: number | null
          default_assignees: string[]
          id: string
          last_generated_at: string | null
          title: string
          type: string
        }
        Insert: {
          active?: boolean
          cadence: string
          client_id: string
          created_at?: string
          day_of_month?: number | null
          day_of_week?: number | null
          default_assignees?: string[]
          id?: string
          last_generated_at?: string | null
          title: string
          type: string
        }
        Update: {
          active?: boolean
          cadence?: string
          client_id?: string
          created_at?: string
          day_of_month?: number | null
          day_of_week?: number | null
          default_assignees?: string[]
          id?: string
          last_generated_at?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_templates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_page_blocks: {
        Row: {
          content: Json
          created_at: string
          draft_content: Json | null
          id: string
          is_visible: boolean
          sort_order: number
          type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content?: Json
          created_at?: string
          draft_content?: Json | null
          id?: string
          is_visible?: boolean
          sort_order?: number
          type: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: Json
          created_at?: string
          draft_content?: Json | null
          id?: string
          is_visible?: boolean
          sort_order?: number
          type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      demo_requests: {
        Row: {
          created_at: string
          email: string
          id: string
          ip: string | null
          name: string
          phone: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip?: string | null
          name: string
          phone: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ip?: string | null
          name?: string
          phone?: string
        }
        Relationships: []
      }
      reference_library_items: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string | null
          id: string
          links: Json
          notes: string | null
          org_id: string
          tags: string[]
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          links?: Json
          notes?: string | null
          org_id: string
          tags?: string[]
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          links?: Json
          notes?: string | null
          org_id?: string
          tags?: string[]
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reference_library_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reference_library_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      signup_attempts: {
        Row: {
          created_at: string
          id: string
          ip: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip: string
        }
        Update: {
          created_at?: string
          id?: string
          ip?: string
        }
        Relationships: []
      }
      status_transitions: {
        Row: {
          actor_id: string | null
          assignee_ids: string[] | null
          at: string
          changed_by: string | null
          created_at: string
          duration_ms: number | null
          from_status: string | null
          id: string
          item_id: string
          to_status: string
        }
        Insert: {
          actor_id?: string | null
          assignee_ids?: string[] | null
          at?: string
          changed_by?: string | null
          created_at?: string
          duration_ms?: number | null
          from_status?: string | null
          id?: string
          item_id: string
          to_status: string
        }
        Update: {
          actor_id?: string | null
          assignee_ids?: string[] | null
          at?: string
          changed_by?: string | null
          created_at?: string
          duration_ms?: number | null
          from_status?: string | null
          id?: string
          item_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_transitions_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_transitions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      stories_schedule: {
        Row: {
          client_id: string | null
          created_at: string
          day: string
          done_at: string | null
          done_by: string | null
          id: string
          label: string | null
          org_id: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          day: string
          done_at?: string | null
          done_by?: string | null
          id?: string
          label?: string | null
          org_id: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          day?: string
          done_at?: string | null
          done_by?: string | null
          id?: string
          label?: string | null
          org_id?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stories_schedule_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stories_schedule_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
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
      user_calendar_tokens: {
        Row: {
          access_token: string | null
          access_token_expires_at: string | null
          created_at: string
          google_email: string
          refresh_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          access_token_expires_at?: string | null
          created_at?: string
          google_email: string
          refresh_token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          access_token_expires_at?: string | null
          created_at?: string
          google_email?: string
          refresh_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      member_pay: {
        Row: {
          monthly_salary: number | null
          org_id: string
          updated_at: string
          user_id: string
          work_schedule: Json | null
        }
        Insert: {
          monthly_salary?: number | null
          org_id: string
          updated_at?: string
          user_id: string
          work_schedule?: Json | null
        }
        Update: {
          monthly_salary?: number | null
          org_id?: string
          updated_at?: string
          user_id?: string
          work_schedule?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "member_pay_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_pay_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_categories: {
        Row: {
          color: string
          created_at: string
          description: string | null
          icon: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      forum_posts: {
        Row: {
          author_id: string
          body: string
          category_id: string
          created_at: string
          deleted_at: string | null
          id: string
          link_url: string | null
          org_id: string
          pinned: boolean
          reply_count: number
          title: string
        }
        Insert: {
          author_id: string
          body: string
          category_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          link_url?: string | null
          org_id: string
          pinned?: boolean
          reply_count?: number
          title: string
        }
        Update: {
          author_id?: string
          body?: string
          category_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          link_url?: string | null
          org_id?: string
          pinned?: boolean
          reply_count?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_posts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "forum_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_posts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_replies: {
        Row: {
          author_id: string
          body: string
          created_at: string
          deleted_at: string | null
          id: string
          org_id: string
          post_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          org_id: string
          post_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          org_id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_replies_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_replies_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "forum_posts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_public_feedback: {
        Args: {
          _author_name: string
          _item_id: string
          _text: string
          _token: string
        }
        Returns: Json
      }
      admin_list_profile_emails: {
        Args: never
        Returns: {
          email: string
          id: string
        }[]
      }
      approve_public_feed: { Args: { _token: string }; Returns: string }
      auto_mark_missed: { Args: never; Returns: number }
      current_org_id: { Args: never; Returns: string }
      generate_recurring_for_month: {
        Args: { _month_key?: string }
        Returns: number
      }
      get_client_id_for_token: { Args: { _token: string }; Returns: string }
      get_my_email: { Args: never; Returns: string }
      get_org_id_for_token: { Args: { _token: string }; Returns: string }
      get_public_feed: { Args: { _token: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_setor_permission: {
        Args: { _perm: string; _user_id: string }
        Returns: boolean
      }
      is_active_profile: { Args: { _user_id: string }; Returns: boolean }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_master: { Args: { _user_id: string }; Returns: boolean }
      luzeria_admin_list_cron_jobs: {
        Args: never
        Returns: {
          active: boolean
          jobname: string
          last_start: string
          last_status: string
          schedule: string
        }[]
      }
      member_can_edit_item: { Args: { _item_id: string }; Returns: boolean }
      notify_stale_client_updates: { Args: never; Returns: number }
      platform_list_bug_reports: {
        Args: never
        Returns: {
          created_at: string
          id: string
          message: string
          org_name: string
          page_url: string
          reporter_name: string
          screenshot_path: string
          status: string
          whatsapp: string
        }[]
      }
      admin_list_member_hourly_cost: {
        Args: never
        Returns: {
          id: string
          hourly_cost: number | null
        }[]
      }
      list_forum_posts: {
        Args: { _category_id?: string | null }
        Returns: {
          author_id: string
          author_name: string
          body: string
          category_id: string
          created_at: string
          id: string
          link_url: string | null
          org_id: string
          org_name: string
          pinned: boolean
          reply_count: number
          title: string
        }[]
      }
      get_forum_post: {
        Args: { _post_id: string }
        Returns: {
          author_id: string
          author_name: string
          body: string
          category_id: string
          created_at: string
          id: string
          link_url: string | null
          org_id: string
          org_name: string
          pinned: boolean
          reply_count: number
          title: string
        }[]
      }
      list_forum_replies: {
        Args: { _post_id: string }
        Returns: {
          author_id: string
          author_name: string
          body: string
          created_at: string
          id: string
          org_id: string
          org_name: string
        }[]
      }
      send_daily_digest: { Args: never; Returns: number }
      send_deadline_reminders: { Args: never; Returns: number }
      set_item_editor: {
        Args: { _editor_id: string | null; _item_id: string }
        Returns: undefined
      }
      set_item_post_format: {
        Args: { _item_id: string; _post_format: string | null }
        Returns: undefined
      }
      set_item_reel_type: {
        Args: { _item_id: string; _reel_type: string | null }
        Returns: undefined
      }
      set_item_status: {
        Args: { p_item_id: string; p_status: string }
        Returns: undefined
      }
      set_onboarding_defaults: {
        Args: { _labels: string[] }
        Returns: undefined
      }
      set_roteiro_client_status: {
        Args: { _client_note: string | null; _client_status: string; _doc_id: string; _roteiro_title: string; _token: string }
        Returns: Json
      }
      update_feed_order: { Args: { p_updates: Json }; Returns: undefined }
      verify_public_token_file: {
        Args: { _file_id: string; _token: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "master" | "setor" | "member"
      content_status:
        | "PLANEJAMENTO"
        | "COPY"
        | "CRIACAO"
        | "REVISAO_ARTE"
        | "EM_GRAVACAO"
        | "EM_EDICAO"
        | "REVISAO_INTERNA"
        | "REVISAO_CLIENTE"
        | "AGENDAMENTO"
        | "REVISAO_AGENDAMENTO"
        | "TRAVADO"
        | "PRONTO_PARA_PUBLICAR"
        | "PENDENTE"
        | "CONCLUIDO"
        | "FINALIZADO"
      content_type:
        | "post"
        | "reel"
        | "outros"
        | "gravacao"
        | "roteiro"
        | "sistema"
        | "story"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["master", "setor", "member"],
      content_status: [
        "PLANEJAMENTO",
        "COPY",
        "CRIACAO",
        "REVISAO_ARTE",
        "EM_GRAVACAO",
        "EM_EDICAO",
        "REVISAO_INTERNA",
        "REVISAO_CLIENTE",
        "AGENDAMENTO",
        "REVISAO_AGENDAMENTO",
        "TRAVADO",
        "PRONTO_PARA_PUBLICAR",
        "PENDENTE",
        "CONCLUIDO",
        "FINALIZADO",
      ],
      content_type: [
        "post",
        "reel",
        "outros",
        "gravacao",
        "roteiro",
        "sistema",
        "story",
      ],
    },
  },
} as const
