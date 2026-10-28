export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AccountType = 'student' | 'scientist';
export type RequestStatus = 'pending' | 'accepted' | 'rejected';
export type InterestOrigin = 'user_request' | 'creator_invite';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          full_name: string;
          account_type: AccountType;
          bio: string | null;
          avatar_url: string | null;
          course_or_area: string | null;
          is_self_declared_woman: boolean;
          conduct_accepted_at: string;
          is_verified_scientist: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          username: string;
          full_name: string;
          account_type: AccountType;
          bio?: string | null;
          avatar_url?: string | null;
          course_or_area?: string | null;
          is_self_declared_woman?: boolean;
          conduct_accepted_at?: string;
          is_verified_scientist?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          full_name?: string;
          account_type?: AccountType;
          bio?: string | null;
          avatar_url?: string | null;
          course_or_area?: string | null;
          is_self_declared_woman?: boolean;
          conduct_accepted_at?: string;
          is_verified_scientist?: boolean;
          created_at?: string;
        };
      };
      posts: {
        Row: {
          id: string;
          author_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          author_id: string;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          author_id?: string;
          content?: string;
          created_at?: string;
        };
      };
      post_likes: {
        Row: {
          post_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          post_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          post_id?: string;
          user_id?: string;
          created_at?: string;
        };
      };
      projects: {
        Row: {
          id: string;
          creator_id: string;
          title: string;
          description: string;
          area: string;
          tags: string[];
          slots: number;
          is_open: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          creator_id: string;
          title: string;
          description: string;
          area: string;
          tags?: string[];
          slots?: number;
          is_open?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          creator_id?: string;
          title?: string;
          description?: string;
          area?: string;
          tags?: string[];
          slots?: number;
          is_open?: boolean;
          created_at?: string;
        };
      };
      project_interests: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          origin: InterestOrigin;
          message: string | null;
          status: RequestStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          origin?: InterestOrigin;
          message?: string | null;
          status?: RequestStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          user_id?: string;
          origin?: InterestOrigin;
          message?: string | null;
          status?: RequestStatus;
          created_at?: string;
        };
      };
      follows: {
        Row: {
          follower_id: string;
          following_id: string;
          created_at: string;
        };
        Insert: {
          follower_id: string;
          following_id: string;
          created_at?: string;
        };
        Update: {
          follower_id?: string;
          following_id?: string;
          created_at?: string;
        };
      };
      connections: {
        Row: {
          id: string;
          requester_id: string;
          addressee_id: string;
          status: RequestStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          requester_id: string;
          addressee_id: string;
          status?: RequestStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          requester_id?: string;
          addressee_id?: string;
          status?: RequestStatus;
          created_at?: string;
        };
      };
      conversations: {
        Row: {
          id: string;
          user_a: string;
          user_b: string;
          requested_by: string;
          status: RequestStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_a: string;
          user_b: string;
          requested_by: string;
          status?: RequestStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_a?: string;
          user_b?: string;
          requested_by?: string;
          status?: RequestStatus;
          created_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id: string;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          sender_id?: string;
          content?: string;
          created_at?: string;
        };
      };
      showcases: {
        Row: {
          id: string;
          author_id: string;
          title: string;
          summary: string;
          image_urls: string[];
          external_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          author_id: string;
          title: string;
          summary: string;
          image_urls?: string[];
          external_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          author_id?: string;
          title?: string;
          summary?: string;
          image_urls?: string[];
          external_url?: string | null;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      account_type: AccountType;
      request_status: RequestStatus;
      interest_origin: InterestOrigin;
    };
  };
}
