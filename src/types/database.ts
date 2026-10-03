export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          key_hash: string;
          last_used_at: string | null;
          name: string;
          prefix: string;
          revoked_at: string | null;
          tenant_id: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          key_hash: string;
          last_used_at?: string | null;
          name: string;
          prefix: string;
          revoked_at?: string | null;
          tenant_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          key_hash?: string;
          last_used_at?: string | null;
          name?: string;
          prefix?: string;
          revoked_at?: string | null;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "api_keys_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_log: {
        Row: {
          action: string;
          created_at: string;
          details: NonNullable<Json>;
          entity_id: string | null;
          entity_type: string;
          id: number;
          tenant_id: string;
          user_id: string | null;
        };
        Insert: {
          action: string;
          created_at?: string;
          details?: NonNullable<Json>;
          entity_id?: string | null;
          entity_type: string;
          id?: never;
          tenant_id: string;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string;
          details?: NonNullable<Json>;
          entity_id?: string | null;
          entity_type?: string;
          id?: never;
          tenant_id?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_log_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      dispatch_lines: {
        Row: {
          dispatch_id: string;
          id: string;
          issue_note: string | null;
          product_id: string;
          quantity_damaged: number;
          quantity_missing: number;
          quantity_received: number | null;
          quantity_sent: number;
          resolution: Database["public"]["Enums"]["discrepancy_resolution"] | null;
          resolved_at: string | null;
          resolved_by: string | null;
          tenant_id: string;
        };
        Insert: {
          dispatch_id: string;
          id?: string;
          issue_note?: string | null;
          product_id: string;
          quantity_damaged?: number;
          quantity_missing?: number;
          quantity_received?: number | null;
          quantity_sent: number;
          resolution?: Database["public"]["Enums"]["discrepancy_resolution"] | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          tenant_id: string;
        };
        Update: {
          dispatch_id?: string;
          id?: string;
          issue_note?: string | null;
          product_id?: string;
          quantity_damaged?: number;
          quantity_missing?: number;
          quantity_received?: number | null;
          quantity_sent?: number;
          resolution?: Database["public"]["Enums"]["discrepancy_resolution"] | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dispatch_lines_tenant_id_dispatch_id_fkey";
            columns: ["tenant_id", "dispatch_id"];
            isOneToOne: false;
            referencedRelation: "dispatches";
            referencedColumns: ["tenant_id", "id"];
          },
          {
            foreignKeyName: "dispatch_lines_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dispatch_lines_tenant_id_product_id_fkey";
            columns: ["tenant_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["tenant_id", "id"];
          },
        ];
      };
      dispatches: {
        Row: {
          created_at: string;
          created_by: string;
          dispatched_at: string | null;
          dispatched_by: string | null;
          from_location_id: string;
          id: string;
          note: string | null;
          number: string;
          received_at: string | null;
          received_by: string | null;
          restock_request_id: string | null;
          status: Database["public"]["Enums"]["dispatch_status"];
          tenant_id: string;
          to_location_id: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          dispatched_at?: string | null;
          dispatched_by?: string | null;
          from_location_id: string;
          id?: string;
          note?: string | null;
          number: string;
          received_at?: string | null;
          received_by?: string | null;
          restock_request_id?: string | null;
          status?: Database["public"]["Enums"]["dispatch_status"];
          tenant_id: string;
          to_location_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          dispatched_at?: string | null;
          dispatched_by?: string | null;
          from_location_id?: string;
          id?: string;
          note?: string | null;
          number?: string;
          received_at?: string | null;
          received_by?: string | null;
          restock_request_id?: string | null;
          status?: Database["public"]["Enums"]["dispatch_status"];
          tenant_id?: string;
          to_location_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dispatches_created_by_profile_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "dispatches_received_by_profile_fkey";
            columns: ["received_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "dispatches_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dispatches_tenant_id_from_location_id_fkey";
            columns: ["tenant_id", "from_location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["tenant_id", "id"];
          },
          {
            foreignKeyName: "dispatches_tenant_id_restock_request_id_fkey";
            columns: ["tenant_id", "restock_request_id"];
            isOneToOne: false;
            referencedRelation: "restock_requests";
            referencedColumns: ["tenant_id", "id"];
          },
          {
            foreignKeyName: "dispatches_tenant_id_to_location_id_fkey";
            columns: ["tenant_id", "to_location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["tenant_id", "id"];
          },
        ];
      };
      idempotency_keys: {
        Row: {
          created_at: string;
          fn: string;
          key: string;
          result: NonNullable<Json>;
          tenant_id: string;
        };
        Insert: {
          created_at?: string;
          fn: string;
          key: string;
          result: NonNullable<Json>;
          tenant_id: string;
        };
        Update: {
          created_at?: string;
          fn?: string;
          key?: string;
          result?: NonNullable<Json>;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "idempotency_keys_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      label_print_log: {
        Row: {
          created_at: string;
          id: number;
          label_count: number;
          preset: number;
          product_count: number;
          receipt_id: string | null;
          source: string;
          tenant_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: never;
          label_count: number;
          preset: number;
          product_count: number;
          receipt_id?: string | null;
          source: string;
          tenant_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: never;
          label_count?: number;
          preset?: number;
          product_count?: number;
          receipt_id?: string | null;
          source?: string;
          tenant_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "label_print_log_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      locations: {
        Row: {
          active: boolean;
          address: string | null;
          created_at: string;
          id: string;
          kind: Database["public"]["Enums"]["location_kind"];
          name: string;
          tenant_id: string;
        };
        Insert: {
          active?: boolean;
          address?: string | null;
          created_at?: string;
          id?: string;
          kind: Database["public"]["Enums"]["location_kind"];
          name: string;
          tenant_id: string;
        };
        Update: {
          active?: boolean;
          address?: string | null;
          created_at?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["location_kind"];
          name?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "locations_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      product_costs: {
        Row: {
          cost_price: number;
          product_id: string;
          tenant_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          cost_price: number;
          product_id: string;
          tenant_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          cost_price?: number;
          product_id?: string;
          tenant_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_costs_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_costs_tenant_id_product_id_fkey";
            columns: ["tenant_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["tenant_id", "id"];
          },
        ];
      };
      products: {
        Row: {
          active: boolean;
          barcode: string;
          category: Database["public"]["Enums"]["product_category"];
          created_at: string;
          id: string;
          image_path: string | null;
          name: string;
          reorder_level: number;
          selling_price: number;
          sku: string;
          supplier_id: string | null;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          barcode: string;
          category: Database["public"]["Enums"]["product_category"];
          created_at?: string;
          id?: string;
          image_path?: string | null;
          name: string;
          reorder_level?: number;
          selling_price?: number;
          sku: string;
          supplier_id?: string | null;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          barcode?: string;
          category?: Database["public"]["Enums"]["product_category"];
          created_at?: string;
          id?: string;
          image_path?: string | null;
          name?: string;
          reorder_level?: number;
          selling_price?: number;
          sku?: string;
          supplier_id?: string | null;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_tenant_id_supplier_id_fkey";
            columns: ["tenant_id", "supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["tenant_id", "id"];
          },
        ];
      };
      profile_locations: {
        Row: {
          location_id: string;
          tenant_id: string;
          user_id: string;
        };
        Insert: {
          location_id: string;
          tenant_id: string;
          user_id: string;
        };
        Update: {
          location_id?: string;
          tenant_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profile_locations_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profile_locations_tenant_id_location_id_fkey";
            columns: ["tenant_id", "location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["tenant_id", "id"];
          },
          {
            foreignKeyName: "profile_locations_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      profiles: {
        Row: {
          active: boolean;
          created_at: string;
          email: string;
          full_name: string;
          role: Database["public"]["Enums"]["app_role"];
          tenant_id: string;
          user_id: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          email: string;
          full_name: string;
          role: Database["public"]["Enums"]["app_role"];
          tenant_id: string;
          user_id: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          email?: string;
          full_name?: string;
          role?: Database["public"]["Enums"]["app_role"];
          tenant_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      receipt_lines: {
        Row: {
          id: string;
          product_id: string;
          quantity: number;
          receipt_id: string;
          tenant_id: string;
          unit_cost: number | null;
        };
        Insert: {
          id?: string;
          product_id: string;
          quantity: number;
          receipt_id: string;
          tenant_id: string;
          unit_cost?: number | null;
        };
        Update: {
          id?: string;
          product_id?: string;
          quantity?: number;
          receipt_id?: string;
          tenant_id?: string;
          unit_cost?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "receipt_lines_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "receipt_lines_tenant_id_product_id_fkey";
            columns: ["tenant_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["tenant_id", "id"];
          },
          {
            foreignKeyName: "receipt_lines_tenant_id_receipt_id_fkey";
            columns: ["tenant_id", "receipt_id"];
            isOneToOne: false;
            referencedRelation: "receipts";
            referencedColumns: ["tenant_id", "id"];
          },
        ];
      };
      receipts: {
        Row: {
          bill_amount: number | null;
          bill_path: string | null;
          created_at: string;
          created_by: string;
          id: string;
          invoice_number: string;
          location_id: string;
          note: string | null;
          number: string;
          paid_at: string | null;
          payment_due_date: string | null;
          payment_status: string;
          supplier_id: string | null;
          tenant_id: string;
        };
        Insert: {
          bill_amount?: number | null;
          bill_path?: string | null;
          created_at?: string;
          created_by: string;
          id?: string;
          invoice_number: string;
          location_id: string;
          note?: string | null;
          number: string;
          paid_at?: string | null;
          payment_due_date?: string | null;
          payment_status?: string;
          supplier_id?: string | null;
          tenant_id: string;
        };
        Update: {
          bill_amount?: number | null;
          bill_path?: string | null;
          created_at?: string;
          created_by?: string;
          id?: string;
          invoice_number?: string;
          location_id?: string;
          note?: string | null;
          number?: string;
          paid_at?: string | null;
          payment_due_date?: string | null;
          payment_status?: string;
          supplier_id?: string | null;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "receipts_created_by_profile_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "receipts_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "receipts_tenant_id_location_id_fkey";
            columns: ["tenant_id", "location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["tenant_id", "id"];
          },
          {
            foreignKeyName: "receipts_tenant_id_supplier_id_fkey";
            columns: ["tenant_id", "supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["tenant_id", "id"];
          },
        ];
      };
      restock_request_lines: {
        Row: {
          id: string;
          line_status: Database["public"]["Enums"]["restock_line_status"];
          product_id: string;
          quantity: number;
          request_id: string;
          suggested_quantity: number | null;
          tenant_id: string;
        };
        Insert: {
          id?: string;
          line_status?: Database["public"]["Enums"]["restock_line_status"];
          product_id: string;
          quantity: number;
          request_id: string;
          suggested_quantity?: number | null;
          tenant_id: string;
        };
        Update: {
          id?: string;
          line_status?: Database["public"]["Enums"]["restock_line_status"];
          product_id?: string;
          quantity?: number;
          request_id?: string;
          suggested_quantity?: number | null;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "restock_request_lines_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "restock_request_lines_tenant_id_product_id_fkey";
            columns: ["tenant_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["tenant_id", "id"];
          },
          {
            foreignKeyName: "restock_request_lines_tenant_id_request_id_fkey";
            columns: ["tenant_id", "request_id"];
            isOneToOne: false;
            referencedRelation: "restock_requests";
            referencedColumns: ["tenant_id", "id"];
          },
        ];
      };
      restock_requests: {
        Row: {
          created_at: string;
          created_by: string | null;
          decided_at: string | null;
          decided_by: string | null;
          decision_note: string | null;
          id: string;
          location_id: string;
          note: string | null;
          number: string;
          source: Database["public"]["Enums"]["restock_source"];
          status: Database["public"]["Enums"]["restock_status"];
          submitted_at: string | null;
          submitted_by: string | null;
          tenant_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_note?: string | null;
          id?: string;
          location_id: string;
          note?: string | null;
          number: string;
          source: Database["public"]["Enums"]["restock_source"];
          status: Database["public"]["Enums"]["restock_status"];
          submitted_at?: string | null;
          submitted_by?: string | null;
          tenant_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_note?: string | null;
          id?: string;
          location_id?: string;
          note?: string | null;
          number?: string;
          source?: Database["public"]["Enums"]["restock_source"];
          status?: Database["public"]["Enums"]["restock_status"];
          submitted_at?: string | null;
          submitted_by?: string | null;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "restock_requests_created_by_profile_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "restock_requests_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "restock_requests_tenant_id_location_id_fkey";
            columns: ["tenant_id", "location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["tenant_id", "id"];
          },
        ];
      };
      return_damage_entries: {
        Row: {
          created_at: string;
          created_by: string;
          decided_at: string | null;
          decided_by: string | null;
          decision_note: string | null;
          id: string;
          location_id: string;
          number: string;
          product_id: string;
          quantity: number;
          reason: string;
          status: Database["public"]["Enums"]["approval_status"];
          tenant_id: string;
          type: Database["public"]["Enums"]["return_damage_type"];
        };
        Insert: {
          created_at?: string;
          created_by: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_note?: string | null;
          id?: string;
          location_id: string;
          number: string;
          product_id: string;
          quantity: number;
          reason: string;
          status?: Database["public"]["Enums"]["approval_status"];
          tenant_id: string;
          type: Database["public"]["Enums"]["return_damage_type"];
        };
        Update: {
          created_at?: string;
          created_by?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_note?: string | null;
          id?: string;
          location_id?: string;
          number?: string;
          product_id?: string;
          quantity?: number;
          reason?: string;
          status?: Database["public"]["Enums"]["approval_status"];
          tenant_id?: string;
          type?: Database["public"]["Enums"]["return_damage_type"];
        };
        Relationships: [
          {
            foreignKeyName: "return_damage_entries_created_by_profile_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "return_damage_entries_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "return_damage_entries_tenant_id_location_id_fkey";
            columns: ["tenant_id", "location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["tenant_id", "id"];
          },
          {
            foreignKeyName: "return_damage_entries_tenant_id_product_id_fkey";
            columns: ["tenant_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["tenant_id", "id"];
          },
        ];
      };
      sale_lines: {
        Row: {
          barcode: string;
          id: string;
          product_id: string;
          quantity: number;
          sale_id: string;
          tenant_id: string;
        };
        Insert: {
          barcode: string;
          id?: string;
          product_id: string;
          quantity: number;
          sale_id: string;
          tenant_id: string;
        };
        Update: {
          barcode?: string;
          id?: string;
          product_id?: string;
          quantity?: number;
          sale_id?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sale_lines_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sale_lines_tenant_id_product_id_fkey";
            columns: ["tenant_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["tenant_id", "id"];
          },
          {
            foreignKeyName: "sale_lines_tenant_id_sale_id_fkey";
            columns: ["tenant_id", "sale_id"];
            isOneToOne: false;
            referencedRelation: "sales";
            referencedColumns: ["tenant_id", "id"];
          },
        ];
      };
      sales: {
        Row: {
          created_at: string;
          created_by: string | null;
          external_ref: string;
          id: string;
          location_id: string;
          source: string;
          tenant_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          external_ref: string;
          id?: string;
          location_id: string;
          source: string;
          tenant_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          external_ref?: string;
          id?: string;
          location_id?: string;
          source?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sales_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_tenant_id_location_id_fkey";
            columns: ["tenant_id", "location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["tenant_id", "id"];
          },
        ];
      };
      stock_levels: {
        Row: {
          location_id: string;
          product_id: string;
          quantity: number;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          location_id: string;
          product_id: string;
          quantity?: number;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          location_id?: string;
          product_id?: string;
          quantity?: number;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stock_levels_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_levels_tenant_id_location_id_fkey";
            columns: ["tenant_id", "location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["tenant_id", "id"];
          },
          {
            foreignKeyName: "stock_levels_tenant_id_product_id_fkey";
            columns: ["tenant_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["tenant_id", "id"];
          },
        ];
      };
      stock_movements: {
        Row: {
          created_at: string;
          id: number;
          location_id: string;
          note: string | null;
          product_id: string;
          quantity_after: number;
          quantity_delta: number;
          ref_id: string | null;
          ref_type: string | null;
          tenant_id: string;
          type: Database["public"]["Enums"]["movement_type"];
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: never;
          location_id: string;
          note?: string | null;
          product_id: string;
          quantity_after: number;
          quantity_delta: number;
          ref_id?: string | null;
          ref_type?: string | null;
          tenant_id: string;
          type: Database["public"]["Enums"]["movement_type"];
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: never;
          location_id?: string;
          note?: string | null;
          product_id?: string;
          quantity_after?: number;
          quantity_delta?: number;
          ref_id?: string | null;
          ref_type?: string | null;
          tenant_id?: string;
          type?: Database["public"]["Enums"]["movement_type"];
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "stock_movements_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_tenant_id_location_id_fkey";
            columns: ["tenant_id", "location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["tenant_id", "id"];
          },
          {
            foreignKeyName: "stock_movements_tenant_id_product_id_fkey";
            columns: ["tenant_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["tenant_id", "id"];
          },
          {
            foreignKeyName: "stock_movements_user_profile_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      suppliers: {
        Row: {
          active: boolean;
          address: string | null;
          created_at: string;
          email: string | null;
          id: string;
          name: string;
          phone: string | null;
          tenant_id: string;
        };
        Insert: {
          active?: boolean;
          address?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          name: string;
          phone?: string | null;
          tenant_id: string;
        };
        Update: {
          active?: boolean;
          address?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          name?: string;
          phone?: string | null;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "suppliers_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tenant_counters: {
        Row: {
          name: string;
          tenant_id: string;
          value: number;
        };
        Insert: {
          name: string;
          tenant_id: string;
          value?: number;
        };
        Update: {
          name?: string;
          tenant_id?: string;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: "tenant_counters_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tenants: {
        Row: {
          address: string | null;
          created_at: string;
          currency: string;
          email: string | null;
          id: string;
          legal_name: string | null;
          name: string;
          phone: string | null;
          plan: string;
          slug: string;
          status: Database["public"]["Enums"]["tenant_status"];
          tax_id: string | null;
          timezone: string;
          trial_ends_at: string;
        };
        Insert: {
          address?: string | null;
          created_at?: string;
          currency?: string;
          email?: string | null;
          id?: string;
          legal_name?: string | null;
          name: string;
          phone?: string | null;
          plan?: string;
          slug: string;
          status?: Database["public"]["Enums"]["tenant_status"];
          tax_id?: string | null;
          timezone?: string;
          trial_ends_at?: string;
        };
        Update: {
          address?: string | null;
          created_at?: string;
          currency?: string;
          email?: string | null;
          id?: string;
          legal_name?: string | null;
          name?: string;
          phone?: string | null;
          plan?: string;
          slug?: string;
          status?: Database["public"]["Enums"]["tenant_status"];
          tax_id?: string | null;
          timezone?: string;
          trial_ends_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_add_member: {
        Args: {
          p_email: string;
          p_full_name: string;
          p_location_ids: string[];
          p_owner_id: string;
          p_role: Database["public"]["Enums"]["app_role"];
          p_user_id: string;
        };
        Returns: undefined;
      };
      api_record_sale: {
        Args: { p_api_key: string; p_external_ref: string; p_items: Json; p_location_id: string };
        Returns: Json;
      };
      create_api_key: { Args: { p_name: string }; Returns: Json };
      create_return_damage_entry: {
        Args: {
          p_idempotency_key?: string;
          p_location_id: string;
          p_product_id: string;
          p_quantity: number;
          p_reason: string;
          p_type: Database["public"]["Enums"]["return_damage_type"];
        };
        Returns: Json;
      };
      create_tenant: {
        Args: { p_owner_name: string; p_shop_name: string; p_slug: string; p_store_name?: string };
        Returns: Json;
      };
      decide_restock_request: {
        Args: { p_approve: boolean; p_id: string; p_idempotency_key?: string; p_note?: string };
        Returns: Json;
      };
      decide_return_damage: {
        Args: { p_approve: boolean; p_id: string; p_idempotency_key?: string; p_note?: string };
        Returns: Json;
      };
      delete_dispatch_draft: { Args: { p_id: string }; Returns: undefined };
      delete_restock_draft: { Args: { p_id: string }; Returns: undefined };
      find_product_by_code: {
        Args: { p_code: string; p_location_id?: string };
        Returns: {
          active: boolean;
          barcode: string;
          id: string;
          image_path: string;
          name: string;
          quantity: number;
          selling_price: number;
          sku: string;
        }[];
      };
      forward_suggestions: { Args: { p_idempotency_key?: string; p_request_id: string }; Returns: Json };
      generate_restock_suggestions: { Args: { p_location_id: string }; Returns: Json };
      import_products: { Args: { p_dry_run?: boolean; p_rows: Json }; Returns: Json };
      location_summary: {
        Args: Record<PropertyKey, never>;
        Returns: {
          kind: Database["public"]["Enums"]["location_kind"];
          location_id: string;
          low_stock: number;
          name: string;
          out_of_stock: number;
          pieces: number;
          products_in_stock: number;
        }[];
      };
      my_context: { Args: Record<PropertyKey, never>; Returns: Json };
      notification_summary: { Args: Record<PropertyKey, never>; Returns: Json };
      receive_dispatch: { Args: { p_id: string; p_idempotency_key?: string; p_lines: Json }; Returns: Json };
      receive_stock: {
        Args: {
          p_bill_amount?: number;
          p_idempotency_key?: string;
          p_invoice_number: string;
          p_lines: Json;
          p_note?: string;
          p_payment_due_date?: string;
          p_payment_status?: string;
          p_supplier_id: string;
        };
        Returns: Json;
      };
      record_sale: { Args: { p_external_ref: string; p_items: Json; p_location_id: string }; Returns: Json };
      report_dispatches: {
        Args: { p_from: string; p_limit?: number; p_location_id?: string; p_offset?: number; p_to: string };
        Returns: {
          damaged: number;
          dispatched_at: string;
          lines: number;
          missing: number;
          number: string;
          received: number;
          received_at: string;
          sent: number;
          status: string;
          store: string;
          total_count: number;
        }[];
      };
      report_movements: {
        Args: {
          p_from: string;
          p_limit?: number;
          p_location_id?: string;
          p_offset?: number;
          p_to: string;
          p_type?: Database["public"]["Enums"]["movement_type"];
        };
        Returns: {
          by_user: string;
          happened_at: string;
          location: string;
          note: string;
          product: string;
          quantity_after: number;
          quantity_delta: number;
          sku: string;
          total_count: number;
          type: string;
        }[];
      };
      report_returns: {
        Args: { p_from: string; p_limit?: number; p_location_id?: string; p_offset?: number; p_to: string };
        Returns: {
          happened_at: string;
          kind: string;
          location: string;
          outcome: string;
          product: string;
          quantity: number;
          reason: string;
          reference: string;
          sku: string;
          total_count: number;
        }[];
      };
      report_stock: {
        Args: { p_limit?: number; p_location_id?: string; p_low_only?: boolean; p_offset?: number };
        Returns: {
          barcode: string;
          category: string;
          location: string;
          product: string;
          quantity: number;
          reorder_level: number;
          selling_price: number;
          sku: string;
          status: string;
          total_count: number;
        }[];
      };
      resolve_discrepancy: {
        Args: {
          p_idempotency_key?: string;
          p_line_id: string;
          p_note?: string;
          p_resolution: Database["public"]["Enums"]["discrepancy_resolution"];
        };
        Returns: Json;
      };
      review_suggestion_line: {
        Args: { p_action: string; p_line_id: string; p_quantity?: number };
        Returns: undefined;
      };
      revoke_api_key: { Args: { p_id: string }; Returns: undefined };
      rotate_api_key: { Args: { p_id: string }; Returns: Json };
      save_dispatch_draft: {
        Args: { p_id: string; p_lines: Json; p_note?: string; p_to_location_id: string };
        Returns: string;
      };
      save_location: { Args: { p_active?: boolean; p_address: string; p_id: string; p_name: string }; Returns: string };
      save_product: {
        Args: {
          p_active: boolean;
          p_barcode: string;
          p_category: Database["public"]["Enums"]["product_category"];
          p_cost_price: number;
          p_id: string;
          p_name: string;
          p_reorder_level: number;
          p_selling_price: number;
          p_sku: string;
          p_supplier_id: string;
        };
        Returns: string;
      };
      save_restock_request: {
        Args: {
          p_id: string;
          p_idempotency_key?: string;
          p_lines: Json;
          p_location_id: string;
          p_note?: string;
          p_send?: boolean;
        };
        Returns: Json;
      };
      search_stock: {
        Args: {
          p_category?: Database["public"]["Enums"]["product_category"];
          p_include_inactive?: boolean;
          p_limit?: number;
          p_location_id: string;
          p_offset?: number;
          p_q?: string;
          p_stock?: string;
          p_supplier_id?: string;
        };
        Returns: {
          active: boolean;
          barcode: string;
          category: Database["public"]["Enums"]["product_category"];
          id: string;
          image_path: string;
          name: string;
          quantity: number;
          reorder_level: number;
          selling_price: number;
          sku: string;
          supplier_id: string;
          total_count: number;
        }[];
      };
      send_dispatch: { Args: { p_id: string; p_idempotency_key?: string }; Returns: Json };
      set_receipt_bill: { Args: { p_bill_path: string; p_receipt_id: string }; Returns: string };
      set_receipt_payment: {
        Args: { p_bill_amount?: number; p_payment_due_date?: string; p_payment_status: string; p_receipt_id: string };
        Returns: undefined;
      };
      setup_progress: { Args: Record<PropertyKey, never>; Returns: Json };
      signup_create_tenant: {
        Args: {
          p_email: string;
          p_owner_name: string;
          p_shop_name: string;
          p_slug: string;
          p_store_name?: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      slug_available: { Args: { p_slug: string }; Returns: boolean };
      tenant_public_info: {
        Args: { p_slug: string };
        Returns: {
          name: string;
          slug: string;
        }[];
      };
      update_member: {
        Args: {
          p_active: boolean;
          p_full_name: string;
          p_location_ids: string[];
          p_role: Database["public"]["Enums"]["app_role"];
          p_user_id: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      app_role: "OWNER" | "STOREROOM_MANAGER" | "STORE_STAFF";
      approval_status: "PENDING" | "APPROVED" | "REJECTED";
      discrepancy_resolution: "RETURN_TO_STOCK" | "WRITE_OFF";
      dispatch_status: "DRAFT" | "DISPATCHED" | "RECEIVED" | "RECEIVED_WITH_ISSUES" | "RESOLVED";
      location_kind: "STORE_ROOM" | "STORE";
      movement_type:
        | "RECEIPT"
        | "DISPATCH_OUT"
        | "DISPATCH_IN"
        | "SALE"
        | "RETURN_OUT"
        | "RETURN_IN"
        | "DAMAGE"
        | "SUPPLIER_RETURN"
        | "ADJUSTMENT";
      product_category: "CLOTHING" | "ACCESSORY";
      restock_line_status: "PENDING" | "APPROVED" | "SKIPPED";
      restock_source: "MANUAL" | "SUGGESTED";
      restock_status: "DRAFT" | "WAITING_STAFF_APPROVAL" | "SENT" | "APPROVED" | "REJECTED" | "DISPATCHED";
      return_damage_type: "RETURN_TO_STOREROOM" | "DAMAGE" | "SUPPLIER_RETURN";
      tenant_status: "trial" | "active" | "past_due" | "canceled";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["OWNER", "STOREROOM_MANAGER", "STORE_STAFF"],
      approval_status: ["PENDING", "APPROVED", "REJECTED"],
      discrepancy_resolution: ["RETURN_TO_STOCK", "WRITE_OFF"],
      dispatch_status: ["DRAFT", "DISPATCHED", "RECEIVED", "RECEIVED_WITH_ISSUES", "RESOLVED"],
      location_kind: ["STORE_ROOM", "STORE"],
      movement_type: [
        "RECEIPT",
        "DISPATCH_OUT",
        "DISPATCH_IN",
        "SALE",
        "RETURN_OUT",
        "RETURN_IN",
        "DAMAGE",
        "SUPPLIER_RETURN",
        "ADJUSTMENT",
      ],
      product_category: ["CLOTHING", "ACCESSORY"],
      restock_line_status: ["PENDING", "APPROVED", "SKIPPED"],
      restock_source: ["MANUAL", "SUGGESTED"],
      restock_status: ["DRAFT", "WAITING_STAFF_APPROVAL", "SENT", "APPROVED", "REJECTED", "DISPATCHED"],
      return_damage_type: ["RETURN_TO_STOREROOM", "DAMAGE", "SUPPLIER_RETURN"],
      tenant_status: ["trial", "active", "past_due", "canceled"],
    },
  },
} as const;
