export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      forum_anonymous_authorship: {
        Row: {
          created_at: string;
          id: number;
          post_id: string | null;
          thread_id: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: never;
          post_id?: string | null;
          thread_id?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: never;
          post_id?: string | null;
          thread_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "forum_anonymous_authorship_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: true;
            referencedRelation: "forum_posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "forum_anonymous_authorship_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: true;
            referencedRelation: "forum_threads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "forum_anonymous_authorship_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      forum_categories: {
        Row: {
          allow_anonymous: boolean;
          created_at: string;
          description: string;
          icon: string;
          id: number;
          name: string;
          slug: string;
          sort_order: number;
        };
        ComputedFields: never;
        Insert: {
          allow_anonymous?: boolean;
          created_at?: string;
          description?: string;
          icon?: string;
          id?: number;
          name: string;
          slug: string;
          sort_order?: number;
        };
        Update: {
          allow_anonymous?: boolean;
          created_at?: string;
          description?: string;
          icon?: string;
          id?: number;
          name?: string;
          slug?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      forum_posts: {
        Row: {
          author_id: string | null;
          body: string;
          created_at: string;
          edited_at: string | null;
          id: string;
          is_anonymous: boolean;
          thread_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          author_id?: string | null;
          body: string;
          created_at?: string;
          edited_at?: string | null;
          id?: string;
          is_anonymous?: boolean;
          thread_id: string;
          updated_at?: string;
        };
        Update: {
          author_id?: string | null;
          body?: string;
          created_at?: string;
          edited_at?: string | null;
          id?: string;
          is_anonymous?: boolean;
          thread_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "forum_posts_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "forum_posts_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "forum_threads";
            referencedColumns: ["id"];
          },
        ];
      };
      forum_reactions: {
        Row: {
          created_at: string;
          id: number;
          kind: Database["public"]["Enums"]["reaction_kind"];
          post_id: string | null;
          thread_id: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: never;
          kind: Database["public"]["Enums"]["reaction_kind"];
          post_id?: string | null;
          thread_id?: string | null;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          id?: never;
          kind?: Database["public"]["Enums"]["reaction_kind"];
          post_id?: string | null;
          thread_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "forum_reactions_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "forum_posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "forum_reactions_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "forum_threads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "forum_reactions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      forum_threads: {
        Row: {
          author_id: string | null;
          body: string;
          category_id: number;
          created_at: string;
          edited_at: string | null;
          id: string;
          is_anonymous: boolean;
          is_locked: boolean;
          is_pinned: boolean;
          last_activity_at: string;
          reply_count: number;
          solution_post_id: string | null;
          tags: string[];
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          author_id?: string | null;
          body: string;
          category_id: number;
          created_at?: string;
          edited_at?: string | null;
          id?: string;
          is_anonymous?: boolean;
          is_locked?: boolean;
          is_pinned?: boolean;
          last_activity_at?: string;
          reply_count?: number;
          solution_post_id?: string | null;
          tags?: string[];
          title: string;
          updated_at?: string;
        };
        Update: {
          author_id?: string | null;
          body?: string;
          category_id?: number;
          created_at?: string;
          edited_at?: string | null;
          id?: string;
          is_anonymous?: boolean;
          is_locked?: boolean;
          is_pinned?: boolean;
          last_activity_at?: string;
          reply_count?: number;
          solution_post_id?: string | null;
          tags?: string[];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "forum_threads_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "forum_threads_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "forum_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "forum_threads_solution_post_id_fkey";
            columns: ["solution_post_id"];
            isOneToOne: false;
            referencedRelation: "forum_posts";
            referencedColumns: ["id"];
          },
        ];
      };
      mentor_suggestions: {
        Row: {
          conversation_starters: string[];
          created_at: string;
          mentee_id: string;
          mentor_id: string;
          model: string | null;
          rank: number;
          reason: string;
          score: number;
          source: string;
        };
        ComputedFields: never;
        Insert: {
          conversation_starters?: string[];
          created_at?: string;
          mentee_id?: string;
          mentor_id: string;
          model?: string | null;
          rank: number;
          reason?: string;
          score: number;
          source: string;
        };
        Update: {
          conversation_starters?: string[];
          created_at?: string;
          mentee_id?: string;
          mentor_id?: string;
          model?: string | null;
          rank?: number;
          reason?: string;
          score?: number;
          source?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mentor_suggestions_mentee_id_fkey";
            columns: ["mentee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mentor_suggestions_mentor_id_fkey";
            columns: ["mentor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      mentorship_requests: {
        Row: {
          created_at: string;
          id: string;
          match_reason: string | null;
          match_score: number | null;
          mentee_id: string;
          mentor_id: string;
          message: string;
          responded_at: string | null;
          response_message: string | null;
          status: Database["public"]["Enums"]["mentorship_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          match_reason?: string | null;
          match_score?: number | null;
          mentee_id?: string;
          mentor_id: string;
          message: string;
          responded_at?: string | null;
          response_message?: string | null;
          status?: Database["public"]["Enums"]["mentorship_status"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          match_reason?: string | null;
          match_score?: number | null;
          mentee_id?: string;
          mentor_id?: string;
          message?: string;
          responded_at?: string | null;
          response_message?: string | null;
          status?: Database["public"]["Enums"]["mentorship_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mentorship_requests_mentee_id_fkey";
            columns: ["mentee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mentorship_requests_mentor_id_fkey";
            columns: ["mentor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      newsletter_deliveries: {
        Row: {
          edition_id: string;
          error: string | null;
          provider_message_id: string | null;
          sent_at: string | null;
          subscriber_id: string;
        };
        ComputedFields: never;
        Insert: {
          edition_id: string;
          error?: string | null;
          provider_message_id?: string | null;
          sent_at?: string | null;
          subscriber_id: string;
        };
        Update: {
          edition_id?: string;
          error?: string | null;
          provider_message_id?: string | null;
          sent_at?: string | null;
          subscriber_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "newsletter_deliveries_edition_id_fkey";
            columns: ["edition_id"];
            isOneToOne: false;
            referencedRelation: "newsletter_editions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "newsletter_deliveries_subscriber_id_fkey";
            columns: ["subscriber_id"];
            isOneToOne: false;
            referencedRelation: "newsletter_subscribers";
            referencedColumns: ["id"];
          },
        ];
      };
      newsletter_editions: {
        Row: {
          content: NonNullable<Json>;
          created_at: string;
          id: string;
          period_end: string | null;
          period_start: string | null;
          published_at: string | null;
          recipients_count: number;
          sent_at: string | null;
          slug: string;
          status: Database["public"]["Enums"]["edition_status"];
          summary: string | null;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          content?: NonNullable<Json>;
          created_at?: string;
          id?: string;
          period_end?: string | null;
          period_start?: string | null;
          published_at?: string | null;
          recipients_count?: number;
          sent_at?: string | null;
          slug: string;
          status?: Database["public"]["Enums"]["edition_status"];
          summary?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          content?: NonNullable<Json>;
          created_at?: string;
          id?: string;
          period_end?: string | null;
          period_start?: string | null;
          published_at?: string | null;
          recipients_count?: number;
          sent_at?: string | null;
          slug?: string;
          status?: Database["public"]["Enums"]["edition_status"];
          summary?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      newsletter_subscribers: {
        Row: {
          area_ids: number[];
          confirm_token: string;
          confirmed_at: string | null;
          consent_text: string;
          consented_at: string;
          created_at: string;
          email: string;
          id: string;
          profile_id: string | null;
          status: Database["public"]["Enums"]["subscriber_status"];
          unsubscribe_token: string;
          unsubscribed_at: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          area_ids?: number[];
          confirm_token?: string;
          confirmed_at?: string | null;
          consent_text: string;
          consented_at?: string;
          created_at?: string;
          email: string;
          id?: string;
          profile_id?: string | null;
          status?: Database["public"]["Enums"]["subscriber_status"];
          unsubscribe_token?: string;
          unsubscribed_at?: string | null;
          updated_at?: string;
        };
        Update: {
          area_ids?: number[];
          confirm_token?: string;
          confirmed_at?: string | null;
          consent_text?: string;
          consented_at?: string;
          created_at?: string;
          email?: string;
          id?: string;
          profile_id?: string | null;
          status?: Database["public"]["Enums"]["subscriber_status"];
          unsubscribe_token?: string;
          unsubscribed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "newsletter_subscribers_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          id: string;
          link: string | null;
          read_at: string | null;
          title: string;
          type: Database["public"]["Enums"]["notification_type"];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          body?: string | null;
          created_at?: string;
          id?: string;
          link?: string | null;
          read_at?: string | null;
          title: string;
          type: Database["public"]["Enums"]["notification_type"];
          user_id: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          id?: string;
          link?: string | null;
          read_at?: string | null;
          title?: string;
          type?: Database["public"]["Enums"]["notification_type"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      paper_comments: {
        Row: {
          author_id: string;
          body: string;
          created_at: string;
          id: string;
          paper_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          author_id?: string;
          body: string;
          created_at?: string;
          id?: string;
          paper_id: string;
          updated_at?: string;
        };
        Update: {
          author_id?: string;
          body?: string;
          created_at?: string;
          id?: string;
          paper_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "paper_comments_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "paper_comments_paper_id_fkey";
            columns: ["paper_id"];
            isOneToOne: false;
            referencedRelation: "papers";
            referencedColumns: ["id"];
          },
        ];
      };
      paper_votes: {
        Row: {
          created_at: string;
          paper_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          paper_id: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          paper_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "paper_votes_paper_id_fkey";
            columns: ["paper_id"];
            isOneToOne: false;
            referencedRelation: "papers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "paper_votes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      papers: {
        Row: {
          abstract: string;
          area_id: number | null;
          authors: string[];
          comment_count: number;
          created_at: string;
          doi: string | null;
          id: string;
          is_hidden: boolean;
          keywords: string[];
          plain_summary: string | null;
          plain_summary_source: string | null;
          submitted_by: string;
          submitter_relation: string;
          title: string;
          updated_at: string;
          url: string | null;
          venue: string | null;
          vote_count: number;
          women_authorship_confirmed: boolean;
          year: number | null;
        };
        ComputedFields: never;
        Insert: {
          abstract: string;
          area_id?: number | null;
          authors: string[];
          comment_count?: number;
          created_at?: string;
          doi?: string | null;
          id?: string;
          is_hidden?: boolean;
          keywords?: string[];
          plain_summary?: string | null;
          plain_summary_source?: string | null;
          submitted_by?: string;
          submitter_relation: string;
          title: string;
          updated_at?: string;
          url?: string | null;
          venue?: string | null;
          vote_count?: number;
          women_authorship_confirmed: boolean;
          year?: number | null;
        };
        Update: {
          abstract?: string;
          area_id?: number | null;
          authors?: string[];
          comment_count?: number;
          created_at?: string;
          doi?: string | null;
          id?: string;
          is_hidden?: boolean;
          keywords?: string[];
          plain_summary?: string | null;
          plain_summary_source?: string | null;
          submitted_by?: string;
          submitter_relation?: string;
          title?: string;
          updated_at?: string;
          url?: string | null;
          venue?: string | null;
          vote_count?: number;
          women_authorship_confirmed?: boolean;
          year?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "papers_area_id_fkey";
            columns: ["area_id"];
            isOneToOne: false;
            referencedRelation: "research_areas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "papers_submitted_by_fkey";
            columns: ["submitted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profile_embeddings: {
        Row: {
          content_hash: string;
          embedding: string;
          model: string;
          profile_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          content_hash: string;
          embedding: string;
          model: string;
          profile_id?: string;
          updated_at?: string;
        };
        Update: {
          content_hash?: string;
          embedding?: string;
          model?: string;
          profile_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profile_embeddings_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profile_research_areas: {
        Row: {
          area_id: number;
          profile_id: string;
        };
        ComputedFields: never;
        Insert: {
          area_id: number;
          profile_id?: string;
        };
        Update: {
          area_id?: number;
          profile_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profile_research_areas_area_id_fkey";
            columns: ["area_id"];
            isOneToOne: false;
            referencedRelation: "research_areas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profile_research_areas_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          ai_consent: boolean;
          ai_consent_at: string | null;
          avatar_url: string | null;
          bio: string | null;
          career_stage: Database["public"]["Enums"]["career_stage"] | null;
          city: string | null;
          created_at: string;
          full_name: string;
          headline: string | null;
          id: string;
          institution: string | null;
          is_mentor: boolean;
          keywords: string[];
          languages: string[];
          lattes_url: string | null;
          linkedin_url: string | null;
          meeting_formats: Database["public"]["Enums"]["meeting_format"][];
          mentor_available: boolean;
          mentor_capacity: number;
          mentoring_goals: string | null;
          mentoring_offer: string | null;
          mentorship_topics: string[];
          onboarded_at: string | null;
          orcid: string | null;
          pronouns: string | null;
          role: Database["public"]["Enums"]["user_role"];
          seeks_mentorship: boolean;
          state: string | null;
          updated_at: string;
          website_url: string | null;
        };
        ComputedFields: never;
        Insert: {
          ai_consent?: boolean;
          ai_consent_at?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          career_stage?: Database["public"]["Enums"]["career_stage"] | null;
          city?: string | null;
          created_at?: string;
          full_name?: string;
          headline?: string | null;
          id: string;
          institution?: string | null;
          is_mentor?: boolean;
          keywords?: string[];
          languages?: string[];
          lattes_url?: string | null;
          linkedin_url?: string | null;
          meeting_formats?: Database["public"]["Enums"]["meeting_format"][];
          mentor_available?: boolean;
          mentor_capacity?: number;
          mentoring_goals?: string | null;
          mentoring_offer?: string | null;
          mentorship_topics?: string[];
          onboarded_at?: string | null;
          orcid?: string | null;
          pronouns?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          seeks_mentorship?: boolean;
          state?: string | null;
          updated_at?: string;
          website_url?: string | null;
        };
        Update: {
          ai_consent?: boolean;
          ai_consent_at?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          career_stage?: Database["public"]["Enums"]["career_stage"] | null;
          city?: string | null;
          created_at?: string;
          full_name?: string;
          headline?: string | null;
          id?: string;
          institution?: string | null;
          is_mentor?: boolean;
          keywords?: string[];
          languages?: string[];
          lattes_url?: string | null;
          linkedin_url?: string | null;
          meeting_formats?: Database["public"]["Enums"]["meeting_format"][];
          mentor_available?: boolean;
          mentor_capacity?: number;
          mentoring_goals?: string | null;
          mentoring_offer?: string | null;
          mentorship_topics?: string[];
          onboarded_at?: string | null;
          orcid?: string | null;
          pronouns?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          seeks_mentorship?: boolean;
          state?: string | null;
          updated_at?: string;
          website_url?: string | null;
        };
        Relationships: [];
      };
      reports: {
        Row: {
          created_at: string;
          details: string | null;
          id: string;
          reason: Database["public"]["Enums"]["report_reason"];
          reporter_id: string;
          resolution_note: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          status: Database["public"]["Enums"]["report_status"];
          target_id: string;
          target_type: Database["public"]["Enums"]["report_target"];
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          details?: string | null;
          id?: string;
          reason: Database["public"]["Enums"]["report_reason"];
          reporter_id?: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: Database["public"]["Enums"]["report_status"];
          target_id: string;
          target_type: Database["public"]["Enums"]["report_target"];
        };
        Update: {
          created_at?: string;
          details?: string | null;
          id?: string;
          reason?: Database["public"]["Enums"]["report_reason"];
          reporter_id?: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: Database["public"]["Enums"]["report_status"];
          target_id?: string;
          target_type?: Database["public"]["Enums"]["report_target"];
        };
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey";
            columns: ["reporter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_resolved_by_fkey";
            columns: ["resolved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      research_areas: {
        Row: {
          big_area: string;
          created_at: string;
          id: number;
          name: string;
          slug: string;
        };
        ComputedFields: never;
        Insert: {
          big_area: string;
          created_at?: string;
          id?: number;
          name: string;
          slug: string;
        };
        Update: {
          big_area?: string;
          created_at?: string;
          id?: number;
          name?: string;
          slug?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      forum_post_reaction_counts: {
        Row: {
          kind: Database["public"]["Enums"]["reaction_kind"];
          post_id: string | null;
          total: number | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "forum_reactions_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "forum_posts";
            referencedColumns: ["id"];
          },
        ];
      };
      forum_thread_reaction_counts: {
        Row: {
          kind: Database["public"]["Enums"]["reaction_kind"];
          thread_id: string | null;
          total: number | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "forum_reactions_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "forum_threads";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      get_community_leaderboard: {
        Args: { p_limit?: number };
        Returns: {
          avatar_url: string | null;
          career_stage: Database["public"]["Enums"]["career_stage"] | null;
          full_name: string;
          mentorships: number;
          papers: number;
          points: number;
          posts: number;
          profile_id: string;
          solutions: number;
          votes_received: number;
        }[];
      };
      get_mentor_candidates: {
        Args: { p_limit?: number };
        Returns: {
          area_ids: number[];
          avatar_url: string | null;
          career_stage: Database["public"]["Enums"]["career_stage"] | null;
          existing_request_status:
            Database["public"]["Enums"]["mentorship_status"] | null;
          full_name: string;
          headline: string | null;
          institution: string | null;
          keywords: string[];
          languages: string[];
          meeting_formats: Database["public"]["Enums"]["meeting_format"][];
          mentor_id: string;
          mentoring_offer: string | null;
          mentorship_topics: string[];
          open_slots: number;
          similarity: number | null;
          state: string | null;
        }[];
      };
      get_mentorship_contact: {
        Args: { p_request_id: string };
        Returns: {
          email: string;
          full_name: string;
        }[];
      };
      get_paper_ranking: {
        Args: {
          p_area_slug?: string;
          p_limit?: number;
          p_offset?: number;
          p_period?: string;
        };
        Returns: {
          area_id: number | null;
          area_name: string | null;
          area_slug: string | null;
          authors: string[];
          comment_count: number;
          created_at: string;
          doi: string | null;
          hot_score: number;
          id: string;
          period_votes: number;
          plain_summary: string | null;
          submitted_by: string;
          title: string;
          url: string | null;
          venue: string | null;
          vote_count: number;
          year: number | null;
        }[];
      };
      get_platform_stats: {
        Args: Record<PropertyKey, never>;
        Returns: {
          members: number;
          mentors: number;
          mentorships: number;
          papers: number;
          threads: number;
        }[];
      };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_moderator: { Args: Record<PropertyKey, never>; Returns: boolean };
      moderate_paper: {
        Args: { p_hidden: boolean; p_paper_id: string };
        Returns: undefined;
      };
      moderate_thread: {
        Args: { p_locked?: boolean; p_pinned?: boolean; p_thread_id: string };
        Returns: undefined;
      };
      reveal_anonymous_author: {
        Args: { p_post_id?: string; p_thread_id?: string };
        Returns: string | null;
      };
    };
    Enums: {
      career_stage:
        | "high_school"
        | "undergraduate"
        | "masters"
        | "phd"
        | "postdoc"
        | "researcher"
        | "professor"
        | "industry";
      edition_status: "draft" | "published" | "sent";
      meeting_format: "online" | "in_person" | "hybrid";
      mentorship_status:
        "pending" | "accepted" | "declined" | "cancelled" | "completed";
      notification_type:
        | "mentorship_request"
        | "mentorship_response"
        | "thread_reply"
        | "solution_marked"
        | "paper_comment";
      reaction_kind: "support" | "useful" | "celebrate";
      report_reason:
        | "harassment"
        | "spam"
        | "misinformation"
        | "offensive"
        | "plagiarism"
        | "other";
      report_status: "open" | "resolved" | "dismissed";
      report_target: "thread" | "post" | "paper" | "paper_comment" | "profile";
      subscriber_status: "pending" | "active" | "unsubscribed";
      user_role: "member" | "moderator" | "admin";
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      career_stage: [
        "high_school",
        "undergraduate",
        "masters",
        "phd",
        "postdoc",
        "researcher",
        "professor",
        "industry",
      ],
      edition_status: ["draft", "published", "sent"],
      meeting_format: ["online", "in_person", "hybrid"],
      mentorship_status: [
        "pending",
        "accepted",
        "declined",
        "cancelled",
        "completed",
      ],
      notification_type: [
        "mentorship_request",
        "mentorship_response",
        "thread_reply",
        "solution_marked",
        "paper_comment",
      ],
      reaction_kind: ["support", "useful", "celebrate"],
      report_reason: [
        "harassment",
        "spam",
        "misinformation",
        "offensive",
        "plagiarism",
        "other",
      ],
      report_status: ["open", "resolved", "dismissed"],
      report_target: ["thread", "post", "paper", "paper_comment", "profile"],
      subscriber_status: ["pending", "active", "unsubscribed"],
      user_role: ["member", "moderator", "admin"],
    },
  },
} as const;
