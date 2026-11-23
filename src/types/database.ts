// 数据库类型。格式与 `supabase gen types typescript --linked` 生成的一致。
// 这份是按 supabase/migrations 手写的；以后改了表结构，运行 tools\gen-types.cmd 重新生成即可覆盖它。

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; username: string; created_at: string };
        Insert: { id: string; username: string; created_at?: string };
        Update: { id?: string; username?: string; created_at?: string };
        Relationships: [];
      };
      friendships: {
        Row: { id: string; requester: string; addressee: string; status: 'pending' | 'accepted'; created_at: string };
        Insert: { id?: string; requester: string; addressee: string; status?: 'pending' | 'accepted'; created_at?: string };
        Update: { status?: 'pending' | 'accepted' };
        Relationships: [];
      };
      conversations: {
        Row: { id: string; type: 'dm' | 'group'; name: string | null; created_by: string; created_at: string };
        Insert: { id?: string; type: 'dm' | 'group'; name?: string | null; created_by: string; created_at?: string };
        Update: { name?: string | null };
        Relationships: [];
      };
      conversation_members: {
        Row: {
          conversation_id: string;
          user_id: string;
          role: 'owner' | 'member';
          joined_at: string;
          last_read_at: string;
          cleared_at: string;
        };
        Insert: {
          conversation_id: string;
          user_id: string;
          role?: 'owner' | 'member';
          joined_at?: string;
          last_read_at?: string;
          cleared_at?: string;
        };
        Update: { role?: 'owner' | 'member'; last_read_at?: string; cleared_at?: string };
        Relationships: [];
      };
      messages: {
        Row: { id: string; conversation_id: string; sender_id: string; body: string; created_at: string };
        Insert: { id?: string; conversation_id: string; sender_id: string; body: string; created_at?: string };
        Update: { body?: string };
        Relationships: [];
      };
      push_tokens: {
        Row: {
          id: string;
          user_id: string;
          provider: 'fcm' | 'hms';
          token: string;
          platform: string;
          device_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider: 'fcm' | 'hms';
          token: string;
          platform?: string;
          device_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: { token?: string; device_name?: string | null; updated_at?: string };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      is_member: { Args: { conv: string }; Returns: boolean };
      create_dm: { Args: { friend: string }; Returns: string };
      create_group: { Args: { group_name: string; member_ids: string[] }; Returns: string };
      add_group_members: { Args: { conv: string; member_ids: string[] }; Returns: undefined };
      remove_group_member: { Args: { conv: string; member: string }; Returns: undefined };
      leave_group: { Args: { conv: string }; Returns: undefined };
      dissolve_group: { Args: { conv: string }; Returns: undefined };
      mark_conversation_read: { Args: { conv: string }; Returns: undefined };
      clear_conversation: { Args: { conv: string }; Returns: undefined };
      get_conversation_stats: {
        Args: Record<PropertyKey, never>;
        Returns: {
          conversation_id: string;
          unread: number;
          last_message_at: string | null;
          last_body: string | null;
          last_sender_id: string | null;
        }[];
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type MessageRow = Database['public']['Tables']['messages']['Row'];
