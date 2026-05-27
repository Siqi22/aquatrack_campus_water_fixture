export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      buildings: {
        Row: {
          campus_id: string;
          collection_ended_at: string | null;
          collection_started_at: string | null;
          created_at: string;
          created_by: string | null;
          floors: number;
          id: string;
          latitude: number | null;
          longitude: number | null;
          name: string;
          updated_at: string;
        };
        Insert: {
          campus_id: string;
          collection_ended_at?: string | null;
          collection_started_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          floors?: number;
          id?: string;
          latitude?: number | null;
          longitude?: number | null;
          name: string;
          updated_at?: string;
        };
        Update: {
          campus_id?: string;
          collection_ended_at?: string | null;
          collection_started_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          floors?: number;
          id?: string;
          latitude?: number | null;
          longitude?: number | null;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "buildings_campus_id_fkey";
            columns: ["campus_id"];
            isOneToOne: false;
            referencedRelation: "campuses";
            referencedColumns: ["id"];
          },
        ];
      };
      campuses: {
        Row: {
          address: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          latitude: number | null;
          longitude: number | null;
          name: string;
          school: string;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          latitude?: number | null;
          longitude?: number | null;
          name: string;
          school: string;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          latitude?: number | null;
          longitude?: number | null;
          name?: string;
          school?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      fixtures: {
        Row: {
          brand: string | null;
          building_id: string;
          campus_id: string;
          category: Database["public"]["Enums"]["fixture_category"];
          cleanliness_rating: number;
          created_at: string;
          created_by: string | null;
          filter_type: string | null;
          floor: string;
          id: string;
          import_metadata: string | null;
          installation_date: string | null;
          issues: string[] | null;
          last_maintenance_date: string;
          location_confirmed: boolean;
          model: string | null;
          model_plate_photo_url: string | null;
          nearest_room: string;
          no_label_reason: string | null;
          no_label_reason_other: string | null;
          observations: string | null;
          photo_url: string | null;
          photos_provided: string[] | null;
          pos_x: number | null;
          pos_y: number | null;
          pressure_rating: number;
          saved_by_name: string | null;
          serial_number: string | null;
          updated_at: string;
        };
        Insert: {
          brand?: string | null;
          building_id: string;
          campus_id: string;
          category?: Database["public"]["Enums"]["fixture_category"];
          cleanliness_rating?: number;
          created_at?: string;
          created_by?: string | null;
          filter_type?: string | null;
          floor: string;
          id?: string;
          import_metadata?: string | null;
          installation_date?: string | null;
          issues?: string[] | null;
          last_maintenance_date?: string;
          location_confirmed?: boolean;
          model?: string | null;
          model_plate_photo_url?: string | null;
          nearest_room: string;
          no_label_reason?: string | null;
          no_label_reason_other?: string | null;
          observations?: string | null;
          photo_url?: string | null;
          photos_provided?: string[] | null;
          pos_x?: number | null;
          pos_y?: number | null;
          pressure_rating?: number;
          saved_by_name?: string | null;
          serial_number?: string | null;
          updated_at?: string;
        };
        Update: {
          brand?: string | null;
          building_id?: string;
          campus_id?: string;
          category?: Database["public"]["Enums"]["fixture_category"];
          cleanliness_rating?: number;
          created_at?: string;
          created_by?: string | null;
          filter_type?: string | null;
          floor?: string;
          id?: string;
          import_metadata?: string | null;
          installation_date?: string | null;
          issues?: string[] | null;
          last_maintenance_date?: string;
          location_confirmed?: boolean;
          model?: string | null;
          model_plate_photo_url?: string | null;
          nearest_room?: string | null;
          no_label_reason?: string | null;
          no_label_reason_other?: string | null;
          observations?: string | null;
          photo_url?: string | null;
          photos_provided?: string[] | null;
          pos_x?: number | null;
          pos_y?: number | null;
          pressure_rating?: number;
          saved_by_name?: string | null;
          serial_number?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fixtures_building_id_fkey";
            columns: ["building_id"];
            isOneToOne: false;
            referencedRelation: "buildings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fixtures_campus_id_fkey";
            columns: ["campus_id"];
            isOneToOne: false;
            referencedRelation: "campuses";
            referencedColumns: ["id"];
          },
        ];
      };
      floor_progress: {
        Row: {
          building_id: string;
          created_at: string;
          ended_at: string | null;
          floor: string;
          id: string;
          notes: string | null;
          restricted_reason: string | null;
          started_at: string | null;
          status: Database["public"]["Enums"]["floor_status"];
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          building_id: string;
          created_at?: string;
          ended_at?: string | null;
          floor: string;
          id?: string;
          notes?: string | null;
          restricted_reason?: string | null;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["floor_status"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          building_id?: string;
          created_at?: string;
          ended_at?: string | null;
          floor?: number;
          id?: string;
          notes?: string | null;
          restricted_reason?: string | null;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["floor_status"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "floor_progress_building_id_fkey";
            columns: ["building_id"];
            isOneToOne: false;
            referencedRelation: "buildings";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_name: string | null;
          id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "Surveyor" | "Facilities" | "Admin";
      fixture_category:
        | "PorcelainFountain"
        | "MetalFountain"
        | "VendingMachine"
        | "BottleRefillStation"
        | "Other";
      floor_status: "NotStarted" | "InProgress" | "Done" | "Restricted";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["Surveyor", "Facilities", "Admin"],
      fixture_category: [
        "PorcelainFountain",
        "MetalFountain",
        "VendingMachine",
        "BottleRefillStation",
        "Other",
      ],
      floor_status: ["NotStarted", "InProgress", "Done", "Restricted"],
    },
  },
} as const;
