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
      clients: {
        Row: {
          archived: boolean
          category: string
          color: string
          created_at: string
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
          copy: string
          drive_link: string
          id: string
          idx: number
          legacy_assignee: string | null
          month_id: string
          status: Database["public"]["Enums"]["content_status"]
          title: string
          type: Database["public"]["Enums"]["content_type"]
          updated_at: string
        }
        Insert: {
          copy?: string
          drive_link?: string
          id?: string
          idx: number
          legacy_assignee?: string | null
          month_id: string
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          type: Database["public"]["Enums"]["content_type"]
          updated_at?: string
        }
        Update: {
          copy?: string
          drive_link?: string
          id?: string
          idx?: number
          legacy_assignee?: string | null
          month_id?: string
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          type?: Database["public"]["Enums"]["content_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_items_month_id_fkey"
            columns: ["month_id"]
            isOneToOne: false
            referencedRelation: "months"
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
          color: string
          created_at: string
          email: string
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          color?: string
          created_at?: string
          email: string
          icon?: string | null
          id: string
          name: string
        }
        Update: {
          active?: boolean
          color?: string
          created_at?: string
          email?: string
          icon?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      stories_schedule: {
        Row: {
          created_at: string
          day: string
          id: string
          label: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          day: string
          id?: string
          label?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          day?: string
          id?: string
          label?: string | null
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_master: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "master" | "setor" | "member"
      content_status:
        | "START"
        | "CRIACAO"
        | "REVISAO_ARTE"
        | "REVISAO_CLIENTE"
        | "FINALIZADO"
        | "PLANEJAMENTO"
        | "COPY"
        | "REVISAO_INTERNA"
        | "AGENDAMENTO"
        | "REVISAO_AGENDAMENTO"
        | "EM_GRAVACAO"
        | "EM_EDICAO"
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
        "START",
        "CRIACAO",
        "REVISAO_ARTE",
        "REVISAO_CLIENTE",
        "FINALIZADO",
        "PLANEJAMENTO",
        "COPY",
        "REVISAO_INTERNA",
        "AGENDAMENTO",
        "REVISAO_AGENDAMENTO",
        "EM_GRAVACAO",
        "EM_EDICAO",
      ],
      content_type: ["post", "reel", "outros"],
    },
  },
} as const
