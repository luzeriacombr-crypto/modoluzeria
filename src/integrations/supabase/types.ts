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
      cleaning_log: {
        Row: {
          created_at: string
          done_at: string | null
          done_by: string | null
          id: string
          occurrence_date: string
          status: string
          task_idx: number
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
          status: string
          task_idx: number
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
          status?: string
          task_idx?: number
          updated_at?: string
          user_id?: string | null
          weekday?: number
        }
        Relationships: []
      }
      cleaning_schedule: {
        Row: {
          created_at: string
          id: string
          label: string | null
          task_idx: number
          updated_at: string
          user_id: string | null
          weekday: number
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          task_idx: number
          updated_at?: string
          user_id?: string | null
          weekday: number
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          task_idx?: number
          updated_at?: string
          user_id?: string | null
          weekday?: number
        }
        Relationships: []
      }
      cleaning_settings: {
        Row: {
          id: number
          note: string
          updated_at: string
        }
        Insert: {
          id?: number
          note?: string
          updated_at?: string
        }
        Update: {
          id?: number
          note?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_contacts: {
        Row: {
          client_id: string
          created_at: string
          email: string
          id: string
          name: string
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
      clients: {
        Row: {
          archived: boolean
          category: string
          color: string
          created_at: string
          description: string
          favorite: boolean
          fixed_responsible_id: string | null
          icon: string | null
          id: string
          name: string
          niche: string | null
          notes: string | null
          posts_per_week: number | null
          reels_per_week: number | null
          review_day: string | null
        }
        Insert: {
          archived?: boolean
          category?: string
          color?: string
          created_at?: string
          description?: string
          favorite?: boolean
          fixed_responsible_id?: string | null
          icon?: string | null
          id?: string
          name: string
          niche?: string | null
          notes?: string | null
          posts_per_week?: number | null
          reels_per_week?: number | null
          review_day?: string | null
        }
        Update: {
          archived?: boolean
          category?: string
          color?: string
          created_at?: string
          description?: string
          favorite?: boolean
          fixed_responsible_id?: string | null
          icon?: string | null
          id?: string
          name?: string
          niche?: string | null
          notes?: string | null
          posts_per_week?: number | null
          reels_per_week?: number | null
          review_day?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_fixed_responsible_id_fkey"
            columns: ["fixed_responsible_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string | null
          created_at: string
          id: string
          is_system: boolean
          item_id: string
          text: string
        }
        Insert: {
          author_id?: string | null
          created_at?: string
          id?: string
          is_system?: boolean
          item_id: string
          text: string
        }
        Update: {
          author_id?: string | null
          created_at?: string
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
          blocked_reason: string | null
          caption: string
          checklist: Json
          copy: string
          drive_link: string
          due_date: string | null
          editor_id: string | null
          finished_at: string | null
          id: string
          idx: number
          last_status_change_at: string | null
          legacy_assignee: string | null
          month_id: string
          quality_rating: number | null
          reel_type: string | null
          rework_count: number
          started_at: string | null
          status: Database["public"]["Enums"]["content_status"]
          title: string
          type: Database["public"]["Enums"]["content_type"]
          updated_at: string
        }
        Insert: {
          blocked_reason?: string | null
          caption?: string
          checklist?: Json
          copy?: string
          drive_link?: string
          due_date?: string | null
          editor_id?: string | null
          finished_at?: string | null
          id?: string
          idx: number
          last_status_change_at?: string | null
          legacy_assignee?: string | null
          month_id: string
          quality_rating?: number | null
          reel_type?: string | null
          rework_count?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          type: Database["public"]["Enums"]["content_type"]
          updated_at?: string
        }
        Update: {
          blocked_reason?: string | null
          caption?: string
          checklist?: Json
          copy?: string
          drive_link?: string
          due_date?: string | null
          editor_id?: string | null
          finished_at?: string | null
          id?: string
          idx?: number
          last_status_change_at?: string | null
          legacy_assignee?: string | null
          month_id?: string
          quality_rating?: number | null
          reel_type?: string | null
          rework_count?: number
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
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          email: string
          name: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          email?: string
          name?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
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
          client_id: string
          created_at: string
          id: string
          key: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          key: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          key?: string
        }
        Relationships: [
          {
            foreignKeyName: "months_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
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
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_digest?: boolean
          deadline_alerts?: boolean
          digest_hour?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_digest?: boolean
          deadline_alerts?: boolean
          digest_hour?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          item_id: string | null
          message: string
          read: boolean
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id?: string | null
          message: string
          read?: boolean
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string | null
          message?: string
          read?: boolean
          type?: string
          user_id?: string
        }
        Relationships: [
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
      profiles: {
        Row: {
          active: boolean
          avatar_url: string | null
          color: string
          created_at: string
          email: string
          icon: string | null
          id: string
          name: string
          onboarded_at: string | null
          tour_completed_at: string | null
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          color?: string
          created_at?: string
          email: string
          icon?: string | null
          id: string
          name: string
          onboarded_at?: string | null
          tour_completed_at?: string | null
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          color?: string
          created_at?: string
          email?: string
          icon?: string | null
          id?: string
          name?: string
          onboarded_at?: string | null
          tour_completed_at?: string | null
        }
        Relationships: []
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
      status_transitions: {
        Row: {
          actor_id: string | null
          at: string
          duration_ms: number | null
          from_status: string | null
          id: string
          item_id: string
          to_status: string
        }
        Insert: {
          actor_id?: string | null
          at?: string
          duration_ms?: number | null
          from_status?: string | null
          id?: string
          item_id: string
          to_status: string
        }
        Update: {
          actor_id?: string | null
          at?: string
          duration_ms?: number | null
          from_status?: string | null
          id?: string
          item_id?: string
          to_status?: string
        }
        Relationships: [
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
          created_at: string
          day: string
          done_at: string | null
          done_by: string | null
          id: string
          label: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          day: string
          done_at?: string | null
          done_by?: string | null
          id?: string
          label?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          day?: string
          done_at?: string | null
          done_by?: string | null
          id?: string
          label?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_list_profile_emails: {
        Args: never
        Returns: {
          email: string
          id: string
        }[]
      }
      auto_mark_missed: { Args: never; Returns: number }
      generate_recurring_for_month: {
        Args: { _month_key?: string }
        Returns: number
      }
      get_my_email: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
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
      send_daily_digest: { Args: never; Returns: number }
      send_deadline_reminders: { Args: never; Returns: number }
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
      content_type: "post" | "reel" | "outros"
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
      ],
      content_type: ["post", "reel", "outros"],
    },
  },
} as const
