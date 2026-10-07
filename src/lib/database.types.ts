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
    PostgrestVersion: "14.18"
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
      activities: {
        Row: {
          body: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          event_id: string | null
          id: string
          lead_id: string | null
          meta: Json | null
          player_id: string | null
          type: Database["public"]["Enums"]["activity_type"]
        }
        Insert: {
          body?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          id?: string
          lead_id?: string | null
          meta?: Json | null
          player_id?: string | null
          type: Database["public"]["Enums"]["activity_type"]
        }
        Update: {
          body?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          id?: string
          lead_id?: string | null
          meta?: Json | null
          player_id?: string | null
          type?: Database["public"]["Enums"]["activity_type"]
        }
        Relationships: [
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "coach_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          assessor_id: string
          created_at: string
          event_id: string
          id: string
          improvements: string | null
          mental: number | null
          notes: string | null
          overall: number | null
          physical: number | null
          player_id: string
          position_played: string | null
          recommendation:
            | Database["public"]["Enums"]["assessment_recommendation"]
            | null
          strengths: string | null
          tactical: number | null
          technical: number | null
          updated_at: string | null
        }
        Insert: {
          assessor_id: string
          created_at?: string
          event_id: string
          id?: string
          improvements?: string | null
          mental?: number | null
          notes?: string | null
          overall?: number | null
          physical?: number | null
          player_id: string
          position_played?: string | null
          recommendation?:
            | Database["public"]["Enums"]["assessment_recommendation"]
            | null
          strengths?: string | null
          tactical?: number | null
          technical?: number | null
          updated_at?: string | null
        }
        Update: {
          assessor_id?: string
          created_at?: string
          event_id?: string
          id?: string
          improvements?: string | null
          mental?: number | null
          notes?: string | null
          overall?: number | null
          physical?: number | null
          player_id?: string
          position_played?: string | null
          recommendation?:
            | Database["public"]["Enums"]["assessment_recommendation"]
            | null
          strengths?: string | null
          tactical?: number | null
          technical?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessments_assessor_id_fkey"
            columns: ["assessor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "coach_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          archived_at: string | null
          contact_type: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          marketing_consent: Database["public"]["Enums"]["consent_type"]
          notes: string | null
          phone: string | null
          source: Database["public"]["Enums"]["lead_source"] | null
          state: string | null
          suburb: string | null
          tags: string[]
          unsubscribed_at: string | null
          updated_at: string | null
        }
        Insert: {
          archived_at?: string | null
          contact_type?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          marketing_consent?: Database["public"]["Enums"]["consent_type"]
          notes?: string | null
          phone?: string | null
          source?: Database["public"]["Enums"]["lead_source"] | null
          state?: string | null
          suburb?: string | null
          tags?: string[]
          unsubscribed_at?: string | null
          updated_at?: string | null
        }
        Update: {
          archived_at?: string | null
          contact_type?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          marketing_consent?: Database["public"]["Enums"]["consent_type"]
          notes?: string | null
          phone?: string | null
          source?: Database["public"]["Enums"]["lead_source"] | null
          state?: string | null
          suburb?: string | null
          tags?: string[]
          unsubscribed_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      document_request_tokens: {
        Row: {
          created_at: string
          event_participant_id: string
          expires_at: string
          id: string
          revoked_at: string | null
          token_hash: string
          used_count: number
        }
        Insert: {
          created_at?: string
          event_participant_id: string
          expires_at: string
          id?: string
          revoked_at?: string | null
          token_hash: string
          used_count?: number
        }
        Update: {
          created_at?: string
          event_participant_id?: string
          expires_at?: string
          id?: string
          revoked_at?: string | null
          token_hash?: string
          used_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_request_tokens_event_participant_id_fkey"
            columns: ["event_participant_id"]
            isOneToOne: false
            referencedRelation: "coach_event_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_request_tokens_event_participant_id_fkey"
            columns: ["event_participant_id"]
            isOneToOne: false
            referencedRelation: "event_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      document_types: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          retention_days_after_event: number | null
          sensitive: boolean
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          retention_days_after_event?: number | null
          sensitive?: boolean
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          retention_days_after_event?: number | null
          sensitive?: boolean
          updated_at?: string | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          delete_after: string | null
          document_type_id: string
          event_id: string | null
          expires_on: string | null
          file_name: string
          file_path: string
          id: string
          mime_type: string | null
          notes: string | null
          player_id: string
          size_bytes: number | null
          updated_at: string | null
          uploaded_by: string | null
          uploaded_via: string
        }
        Insert: {
          created_at?: string
          delete_after?: string | null
          document_type_id: string
          event_id?: string | null
          expires_on?: string | null
          file_name: string
          file_path: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          player_id: string
          size_bytes?: number | null
          updated_at?: string | null
          uploaded_by?: string | null
          uploaded_via?: string
        }
        Update: {
          created_at?: string
          delete_after?: string | null
          document_type_id?: string
          event_id?: string | null
          expires_on?: string | null
          file_name?: string
          file_path?: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          player_id?: string
          size_bytes?: number | null
          updated_at?: string | null
          uploaded_by?: string | null
          uploaded_via?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "coach_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_attachments: {
        Row: {
          campaign_id: string
          created_at: string
          file_name: string
          file_path: string
          id: string
          mime_type: string | null
          size_bytes: number | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "email_attachments_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          audience: Json | null
          body_html: string | null
          body_text: string | null
          bounced: number
          clicked: number
          created_at: string
          created_by: string | null
          delivered: number
          event_id: string | null
          format: Database["public"]["Enums"]["email_format"]
          from_name: string | null
          id: string
          include_rsvp: boolean
          name: string
          opened: number
          preheader: string | null
          reply_to: string | null
          scheduled_at: string | null
          sent: number
          sent_at: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          subject: string
          total: number
          updated_at: string | null
        }
        Insert: {
          audience?: Json | null
          body_html?: string | null
          body_text?: string | null
          bounced?: number
          clicked?: number
          created_at?: string
          created_by?: string | null
          delivered?: number
          event_id?: string | null
          format?: Database["public"]["Enums"]["email_format"]
          from_name?: string | null
          id?: string
          include_rsvp?: boolean
          name: string
          opened?: number
          preheader?: string | null
          reply_to?: string | null
          scheduled_at?: string | null
          sent?: number
          sent_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          subject: string
          total?: number
          updated_at?: string | null
        }
        Update: {
          audience?: Json | null
          body_html?: string | null
          body_text?: string | null
          bounced?: number
          clicked?: number
          created_at?: string
          created_by?: string | null
          delivered?: number
          event_id?: string | null
          format?: Database["public"]["Enums"]["email_format"]
          from_name?: string | null
          id?: string
          include_rsvp?: boolean
          name?: string
          opened?: number
          preheader?: string | null
          reply_to?: string | null
          scheduled_at?: string | null
          sent?: number
          sent_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          subject?: string
          total?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaigns_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      email_messages: {
        Row: {
          body_html: string | null
          body_text: string | null
          bounced_at: string | null
          campaign_id: string | null
          clicked_at: string | null
          contact_id: string
          created_at: string
          delivered_at: string | null
          error: string | null
          event_id: string | null
          id: string
          invoice_id: string | null
          opened_at: string | null
          player_id: string | null
          resend_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["message_status"]
          subject: string
          to_email: string
          updated_at: string | null
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          bounced_at?: string | null
          campaign_id?: string | null
          clicked_at?: string | null
          contact_id: string
          created_at?: string
          delivered_at?: string | null
          error?: string | null
          event_id?: string | null
          id?: string
          invoice_id?: string | null
          opened_at?: string | null
          player_id?: string | null
          resend_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          subject: string
          to_email: string
          updated_at?: string | null
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          bounced_at?: string | null
          campaign_id?: string | null
          clicked_at?: string | null
          contact_id?: string
          created_at?: string
          delivered_at?: string | null
          error?: string | null
          event_id?: string | null
          id?: string
          invoice_id?: string | null
          opened_at?: string | null
          player_id?: string | null
          resend_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          subject?: string
          to_email?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "coach_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body_html: string | null
          body_text: string | null
          category: string
          created_at: string
          format: Database["public"]["Enums"]["email_format"]
          id: string
          name: string
          subject: string
          updated_at: string | null
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          category?: string
          created_at?: string
          format?: Database["public"]["Enums"]["email_format"]
          id?: string
          name: string
          subject: string
          updated_at?: string | null
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          category?: string
          created_at?: string
          format?: Database["public"]["Enums"]["email_format"]
          id?: string
          name?: string
          subject?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      event_document_requirements: {
        Row: {
          created_at: string
          document_type_id: string
          event_id: string
          id: string
          notes: string | null
          required: boolean
        }
        Insert: {
          created_at?: string
          document_type_id: string
          event_id: string
          id?: string
          notes?: string | null
          required?: boolean
        }
        Update: {
          created_at?: string
          document_type_id?: string
          event_id?: string
          id?: string
          notes?: string | null
          required?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "event_document_requirements_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_document_requirements_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_participants: {
        Row: {
          checked_in_at: string | null
          checked_in_by: string | null
          contact_id: string | null
          created_at: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          event_id: string
          flight_out: string | null
          flight_return: string | null
          id: string
          logistics_notes: string | null
          notes: string | null
          player_id: string | null
          room: string | null
          shirt_size: string | null
          source_lead_id: string | null
          status: Database["public"]["Enums"]["participant_status"]
          status_updated_at: string | null
          updated_at: string | null
        }
        Insert: {
          checked_in_at?: string | null
          checked_in_by?: string | null
          contact_id?: string | null
          created_at?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          event_id: string
          flight_out?: string | null
          flight_return?: string | null
          id?: string
          logistics_notes?: string | null
          notes?: string | null
          player_id?: string | null
          room?: string | null
          shirt_size?: string | null
          source_lead_id?: string | null
          status?: Database["public"]["Enums"]["participant_status"]
          status_updated_at?: string | null
          updated_at?: string | null
        }
        Update: {
          checked_in_at?: string | null
          checked_in_by?: string | null
          contact_id?: string | null
          created_at?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          event_id?: string
          flight_out?: string | null
          flight_return?: string | null
          id?: string
          logistics_notes?: string | null
          notes?: string | null
          player_id?: string | null
          room?: string | null
          shirt_size?: string | null
          source_lead_id?: string | null
          status?: Database["public"]["Enums"]["participant_status"]
          status_updated_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_participants_checked_in_by_fkey"
            columns: ["checked_in_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_participants_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_participants_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "coach_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_participants_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_participants_source_lead_id_fkey"
            columns: ["source_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          address: string | null
          archived_at: string | null
          birth_years: number[] | null
          capacity: number | null
          city: string | null
          country: string
          cover_image_path: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          end_at: string | null
          id: string
          parent_event_id: string | null
          price_cents: number | null
          reminder_hours_before: number | null
          reminder_template_id: string | null
          slug: string
          start_at: string
          status: Database["public"]["Enums"]["event_status"]
          timezone: string
          title: string
          type: Database["public"]["Enums"]["event_type"]
          updated_at: string | null
          venue_name: string | null
        }
        Insert: {
          address?: string | null
          archived_at?: string | null
          birth_years?: number[] | null
          capacity?: number | null
          city?: string | null
          country?: string
          cover_image_path?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          end_at?: string | null
          id?: string
          parent_event_id?: string | null
          price_cents?: number | null
          reminder_hours_before?: number | null
          reminder_template_id?: string | null
          slug: string
          start_at: string
          status?: Database["public"]["Enums"]["event_status"]
          timezone?: string
          title: string
          type: Database["public"]["Enums"]["event_type"]
          updated_at?: string | null
          venue_name?: string | null
        }
        Update: {
          address?: string | null
          archived_at?: string | null
          birth_years?: number[] | null
          capacity?: number | null
          city?: string | null
          country?: string
          cover_image_path?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          end_at?: string | null
          id?: string
          parent_event_id?: string | null
          price_cents?: number | null
          reminder_hours_before?: number | null
          reminder_template_id?: string | null
          slug?: string
          start_at?: string
          status?: Database["public"]["Enums"]["event_status"]
          timezone?: string
          title?: string
          type?: Database["public"]["Enums"]["event_type"]
          updated_at?: string | null
          venue_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_parent_event_id_fkey"
            columns: ["parent_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_reminder_template_id_fkey"
            columns: ["reminder_template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      ingest_field_mappings: {
        Row: {
          created_at: string
          form_type: string | null
          id: string
          source_key: string
          target: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          form_type?: string | null
          id?: string
          source_key: string
          target: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          form_type?: string | null
          id?: string
          source_key?: string
          target?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ingest_log: {
        Row: {
          error: string | null
          external_id: string | null
          form_type: string | null
          id: string
          lead_id: string | null
          received_at: string
          source: string | null
          status: string
        }
        Insert: {
          error?: string | null
          external_id?: string | null
          form_type?: string | null
          id?: string
          lead_id?: string | null
          received_at?: string
          source?: string | null
          status: string
        }
        Update: {
          error?: string | null
          external_id?: string | null
          form_type?: string | null
          id?: string
          lead_id?: string | null
          received_at?: string
          source?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingest_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          amount_cents: number
          created_at: string
          description: string
          id: string
          invoice_id: string
          quantity: number
          sort_order: number
          unit_price_cents: number
          updated_at: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          quantity?: number
          sort_order?: number
          unit_price_cents: number
          updated_at?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number
          sort_order?: number
          unit_price_cents?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid_cents: number
          contact_id: string
          created_at: string
          due_date: string
          event_id: string | null
          gst_cents: number
          id: string
          issue_date: string
          notes: string | null
          number: string
          pdf_path: string | null
          player_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal_cents: number
          total_cents: number
          updated_at: string | null
          voided_at: string | null
        }
        Insert: {
          amount_paid_cents?: number
          contact_id: string
          created_at?: string
          due_date: string
          event_id?: string | null
          gst_cents?: number
          id?: string
          issue_date?: string
          notes?: string | null
          number: string
          pdf_path?: string | null
          player_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal_cents?: number
          total_cents?: number
          updated_at?: string | null
          voided_at?: string | null
        }
        Update: {
          amount_paid_cents?: number
          contact_id?: string
          created_at?: string
          due_date?: string
          event_id?: string | null
          gst_cents?: number
          id?: string
          issue_date?: string
          notes?: string | null
          number?: string
          pdf_path?: string | null
          player_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal_cents?: number
          total_cents?: number
          updated_at?: string | null
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "coach_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          adset_name: string | null
          archived_at: string | null
          campaign_name: string | null
          contact_id: string | null
          created_at: string
          external_id: string | null
          form_type: string | null
          id: string
          interested_event_id: string | null
          next_follow_up_at: string | null
          owner_id: string | null
          player_id: string | null
          raw: Json | null
          source: Database["public"]["Enums"]["lead_source"]
          source_detail: string | null
          stage: Database["public"]["Enums"]["lead_stage"]
          submitted_at: string | null
          updated_at: string | null
        }
        Insert: {
          adset_name?: string | null
          archived_at?: string | null
          campaign_name?: string | null
          contact_id?: string | null
          created_at?: string
          external_id?: string | null
          form_type?: string | null
          id?: string
          interested_event_id?: string | null
          next_follow_up_at?: string | null
          owner_id?: string | null
          player_id?: string | null
          raw?: Json | null
          source: Database["public"]["Enums"]["lead_source"]
          source_detail?: string | null
          stage?: Database["public"]["Enums"]["lead_stage"]
          submitted_at?: string | null
          updated_at?: string | null
        }
        Update: {
          adset_name?: string | null
          archived_at?: string | null
          campaign_name?: string | null
          contact_id?: string | null
          created_at?: string
          external_id?: string | null
          form_type?: string | null
          id?: string
          interested_event_id?: string | null
          next_follow_up_at?: string | null
          owner_id?: string | null
          player_id?: string | null
          raw?: Json | null
          source?: Database["public"]["Enums"]["lead_source"]
          source_detail?: string | null
          stage?: Database["public"]["Enums"]["lead_stage"]
          submitted_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_interested_event_id_fkey"
            columns: ["interested_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "coach_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          invoice_id: string
          method: string
          notes: string | null
          paid_on: string
          recorded_by: string | null
          reference: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string
          id?: string
          invoice_id: string
          method?: string
          notes?: string | null
          paid_on?: string
          recorded_by?: string | null
          reference?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          invoice_id?: string
          method?: string
          notes?: string | null
          paid_on?: string
          recorded_by?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_contacts: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          is_emergency: boolean
          is_primary: boolean
          player_id: string
          relationship: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          is_emergency?: boolean
          is_primary?: boolean
          player_id: string
          relationship: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          is_emergency?: boolean
          is_primary?: boolean
          player_id?: string
          relationship?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_contacts_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "coach_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_contacts_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          archived_at: string | null
          birth_year: number | null
          created_at: string
          current_club: string | null
          dietary_notes: string | null
          dob: string | null
          eligibility_notes: string | null
          first_name: string | null
          gender: string | null
          id: string
          last_name: string | null
          level: string | null
          medical_alerts: string | null
          notes: string | null
          out_of_age_range: boolean | null
          photo_path: string | null
          position: string | null
          preferred_foot: string | null
          secondary_position: string | null
          squad: string | null
          state: string | null
          status: string
          suburb: string | null
          updated_at: string | null
        }
        Insert: {
          archived_at?: string | null
          birth_year?: number | null
          created_at?: string
          current_club?: string | null
          dietary_notes?: string | null
          dob?: string | null
          eligibility_notes?: string | null
          first_name?: string | null
          gender?: string | null
          id?: string
          last_name?: string | null
          level?: string | null
          medical_alerts?: string | null
          notes?: string | null
          out_of_age_range?: boolean | null
          photo_path?: string | null
          position?: string | null
          preferred_foot?: string | null
          secondary_position?: string | null
          squad?: string | null
          state?: string | null
          status?: string
          suburb?: string | null
          updated_at?: string | null
        }
        Update: {
          archived_at?: string | null
          birth_year?: number | null
          created_at?: string
          current_club?: string | null
          dietary_notes?: string | null
          dob?: string | null
          eligibility_notes?: string | null
          first_name?: string | null
          gender?: string | null
          id?: string
          last_name?: string | null
          level?: string | null
          medical_alerts?: string | null
          notes?: string | null
          out_of_age_range?: boolean | null
          photo_path?: string | null
          position?: string | null
          preferred_foot?: string | null
          secondary_position?: string | null
          squad?: string | null
          state?: string | null
          status?: string
          suburb?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      posts: {
        Row: {
          author: string | null
          body_html: string | null
          category: string
          cover_image_url: string | null
          created_at: string
          excerpt: string | null
          id: string
          last_synced_at: string | null
          published: boolean
          published_at: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          sync_error: string | null
          tags: string[]
          title: string
          updated_at: string | null
        }
        Insert: {
          author?: string | null
          body_html?: string | null
          category: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          last_synced_at?: string | null
          published?: boolean
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          sync_error?: string | null
          tags?: string[]
          title: string
          updated_at?: string | null
        }
        Update: {
          author?: string | null
          body_html?: string | null
          category?: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          last_synced_at?: string | null
          published?: boolean
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          sync_error?: string | null
          tags?: string[]
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
        }
        Relationships: []
      }
      settings: {
        Row: {
          abn: string | null
          address: string | null
          bank_account_name: string | null
          bank_account_number: string | null
          bank_bsb: string | null
          created_at: string
          daily_email_cap: number
          default_timezone: string
          email: string | null
          email_footer_html: string | null
          email_from_address: string | null
          email_from_name: string
          email_reply_to: string | null
          gst_rate: number
          gst_registered: boolean
          id: number
          invoice_footer: string | null
          invoice_next_number: number
          invoice_prefix: string
          logo_path: string | null
          org_name: string
          payid: string | null
          payment_terms_days: number
          phone: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          abn?: string | null
          address?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_bsb?: string | null
          created_at?: string
          daily_email_cap?: number
          default_timezone?: string
          email?: string | null
          email_footer_html?: string | null
          email_from_address?: string | null
          email_from_name?: string
          email_reply_to?: string | null
          gst_rate?: number
          gst_registered?: boolean
          id?: number
          invoice_footer?: string | null
          invoice_next_number?: number
          invoice_prefix?: string
          logo_path?: string | null
          org_name?: string
          payid?: string | null
          payment_terms_days?: number
          phone?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          abn?: string | null
          address?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_bsb?: string | null
          created_at?: string
          daily_email_cap?: number
          default_timezone?: string
          email?: string | null
          email_footer_html?: string | null
          email_from_address?: string | null
          email_from_name?: string
          email_reply_to?: string | null
          gst_rate?: number
          gst_registered?: boolean
          id?: number
          invoice_footer?: string | null
          invoice_next_number?: number
          invoice_prefix?: string
          logo_path?: string | null
          org_name?: string
          payid?: string | null
          payment_terms_days?: number
          phone?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_to: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          done_at: string | null
          due_at: string | null
          event_id: string | null
          id: string
          lead_id: string | null
          notes: string | null
          player_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          done_at?: string | null
          due_at?: string | null
          event_id?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          player_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          done_at?: string | null
          due_at?: string | null
          event_id?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          player_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "coach_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      coach_emergency_contacts: {
        Row: {
          first_name: string | null
          id: string | null
          is_emergency: boolean | null
          last_name: string | null
          phone: string | null
          player_id: string | null
          relationship: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_contacts_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "coach_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_contacts_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_event_participants: {
        Row: {
          checked_in_at: string | null
          checked_in_by: string | null
          contact_id: string | null
          created_at: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          event_id: string | null
          flight_out: string | null
          flight_return: string | null
          id: string | null
          logistics_notes: string | null
          notes: string | null
          player_id: string | null
          room: string | null
          shirt_size: string | null
          status: Database["public"]["Enums"]["participant_status"] | null
          status_updated_at: string | null
          updated_at: string | null
        }
        Insert: {
          checked_in_at?: string | null
          checked_in_by?: string | null
          contact_id?: string | null
          created_at?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          event_id?: string | null
          flight_out?: string | null
          flight_return?: string | null
          id?: string | null
          logistics_notes?: string | null
          notes?: string | null
          player_id?: string | null
          room?: string | null
          shirt_size?: string | null
          status?: Database["public"]["Enums"]["participant_status"] | null
          status_updated_at?: string | null
          updated_at?: string | null
        }
        Update: {
          checked_in_at?: string | null
          checked_in_by?: string | null
          contact_id?: string | null
          created_at?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          event_id?: string | null
          flight_out?: string | null
          flight_return?: string | null
          id?: string | null
          logistics_notes?: string | null
          notes?: string | null
          player_id?: string | null
          room?: string | null
          shirt_size?: string | null
          status?: Database["public"]["Enums"]["participant_status"] | null
          status_updated_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_participants_checked_in_by_fkey"
            columns: ["checked_in_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_participants_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_participants_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "coach_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_participants_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_players: {
        Row: {
          archived_at: string | null
          birth_year: number | null
          created_at: string | null
          current_club: string | null
          dietary_notes: string | null
          dob: string | null
          first_name: string | null
          gender: string | null
          id: string | null
          last_name: string | null
          level: string | null
          medical_alerts: string | null
          photo_path: string | null
          position: string | null
          preferred_foot: string | null
          secondary_position: string | null
          state: string | null
          status: string | null
          suburb: string | null
        }
        Insert: {
          archived_at?: string | null
          birth_year?: number | null
          created_at?: string | null
          current_club?: string | null
          dietary_notes?: string | null
          dob?: string | null
          first_name?: string | null
          gender?: string | null
          id?: string | null
          last_name?: string | null
          level?: string | null
          medical_alerts?: string | null
          photo_path?: string | null
          position?: string | null
          preferred_foot?: string | null
          secondary_position?: string | null
          state?: string | null
          status?: string | null
          suburb?: string | null
        }
        Update: {
          archived_at?: string | null
          birth_year?: number | null
          created_at?: string | null
          current_club?: string | null
          dietary_notes?: string | null
          dob?: string | null
          first_name?: string | null
          gender?: string | null
          id?: string | null
          last_name?: string | null
          level?: string | null
          medical_alerts?: string | null
          photo_path?: string | null
          position?: string | null
          preferred_foot?: string | null
          secondary_position?: string | null
          state?: string | null
          status?: string | null
          suburb?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_in_participant: {
        Args: {
          p_participant_id: string
          p_status: Database["public"]["Enums"]["participant_status"]
        }
        Returns: undefined
      }
      current_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      next_invoice_number: { Args: never; Returns: string }
    }
    Enums: {
      activity_type:
        | "note"
        | "call"
        | "sms"
        | "whatsapp"
        | "email_sent"
        | "email_opened"
        | "email_clicked"
        | "email_bounced"
        | "status_change"
        | "stage_change"
        | "lead_created"
        | "event_added"
        | "checked_in"
        | "document_uploaded"
        | "document_requested"
        | "invoice_sent"
        | "payment_recorded"
        | "assessment_added"
        | "unsubscribed"
        | "rsvp"
      app_role: "admin" | "coach"
      assessment_recommendation: "select" | "monitor" | "not_yet"
      campaign_status: "draft" | "scheduled" | "sending" | "sent" | "cancelled"
      consent_type: "express" | "inferred" | "none"
      email_format: "plain" | "html"
      event_status:
        | "draft"
        | "open"
        | "full"
        | "closed"
        | "completed"
        | "cancelled"
      event_type:
        | "trial"
        | "training_session"
        | "trial_game"
        | "tour"
        | "camp"
        | "community_event"
        | "other"
      invoice_status:
        | "draft"
        | "sent"
        | "part_paid"
        | "paid"
        | "overdue"
        | "void"
      lead_source:
        | "website"
        | "meta_instant_form"
        | "newsletter"
        | "referral"
        | "manual"
        | "import"
        | "other"
      lead_stage:
        | "new"
        | "contacted"
        | "interested"
        | "confirmed"
        | "signed"
        | "not_interested"
        | "lost"
      message_status:
        | "queued"
        | "sending"
        | "sent"
        | "delivered"
        | "opened"
        | "clicked"
        | "bounced"
        | "complained"
        | "failed"
        | "skipped"
      participant_status:
        | "invited"
        | "to_be_invited"
        | "confirmed"
        | "declined"
        | "waitlisted"
        | "attended"
        | "no_show"
        | "cancelled"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      activity_type: [
        "note",
        "call",
        "sms",
        "whatsapp",
        "email_sent",
        "email_opened",
        "email_clicked",
        "email_bounced",
        "status_change",
        "stage_change",
        "lead_created",
        "event_added",
        "checked_in",
        "document_uploaded",
        "document_requested",
        "invoice_sent",
        "payment_recorded",
        "assessment_added",
        "unsubscribed",
        "rsvp",
      ],
      app_role: ["admin", "coach"],
      assessment_recommendation: ["select", "monitor", "not_yet"],
      campaign_status: ["draft", "scheduled", "sending", "sent", "cancelled"],
      consent_type: ["express", "inferred", "none"],
      email_format: ["plain", "html"],
      event_status: [
        "draft",
        "open",
        "full",
        "closed",
        "completed",
        "cancelled",
      ],
      event_type: [
        "trial",
        "training_session",
        "trial_game",
        "tour",
        "camp",
        "community_event",
        "other",
      ],
      invoice_status: ["draft", "sent", "part_paid", "paid", "overdue", "void"],
      lead_source: [
        "website",
        "meta_instant_form",
        "newsletter",
        "referral",
        "manual",
        "import",
        "other",
      ],
      lead_stage: [
        "new",
        "contacted",
        "interested",
        "confirmed",
        "signed",
        "not_interested",
        "lost",
      ],
      message_status: [
        "queued",
        "sending",
        "sent",
        "delivered",
        "opened",
        "clicked",
        "bounced",
        "complained",
        "failed",
        "skipped",
      ],
      participant_status: [
        "invited",
        "to_be_invited",
        "confirmed",
        "declined",
        "waitlisted",
        "attended",
        "no_show",
        "cancelled",
      ],
    },
  },
} as const
