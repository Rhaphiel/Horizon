export type Json = string | number | boolean | null | {
    [key: string]: Json | undefined;
} | Json[];
export type Database = {
    public: {
        Tables: {
            profiles: {
                Row: {
                    id: string;
                    username: string;
                    avatar_url: string | null;
                    horizon_id: number | null;
                    id_searchable: boolean;
                    shown_title: string | null;
                    handle: string | null;
                    handle_set_at: string | null;
                    created_at: string;
                };
                Insert: {
                    id: string;
                    username: string;
                    avatar_url?: string | null;
                    horizon_id?: number | null;
                    id_searchable?: boolean;
                    shown_title?: string | null;
                    handle?: string | null;
                    handle_set_at?: string | null;
                    username_changed_at?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    username?: string;
                    avatar_url?: string | null;
                    horizon_id?: number | null;
                    id_searchable?: boolean;
                    shown_title?: string | null;
                    handle?: string | null;
                    handle_set_at?: string | null;
                    username_changed_at?: string | null;
                    created_at?: string;
                };
                Relationships: [
                ];
            };
            friendships: {
                Row: {
                    id: string;
                    requester: string;
                    addressee: string;
                    status: 'pending' | 'accepted';
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    requester: string;
                    addressee: string;
                    status?: 'pending' | 'accepted';
                    created_at?: string;
                };
                Update: {
                    status?: 'pending' | 'accepted';
                };
                Relationships: [
                ];
            };
            conversations: {
                Row: {
                    id: string;
                    type: 'dm' | 'group';
                    name: string | null;
                    avatar_url: string | null;
                    created_by: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    type: 'dm' | 'group';
                    name?: string | null;
                    avatar_url?: string | null;
                    created_by?: string | null;
                    created_at?: string;
                };
                Update: {
                    name?: string | null;
                    avatar_url?: string | null;
                };
                Relationships: [
                ];
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
                Update: {
                    role?: 'owner' | 'member';
                    last_read_at?: string;
                    cleared_at?: string;
                };
                Relationships: [
                ];
            };
            messages: {
                Row: {
                    id: string;
                    conversation_id: string;
                    sender_id: string;
                    body: string;
                    created_at: string;
                    media_type: 'text' | 'image' | 'audio' | 'video' | 'file';
                    media_path: string | null;
                    media_name: string | null;
                    media_mime: string | null;
                    media_size: number | null;
                    media_duration: number | null;
                    expires_at: string | null;
                    is_expired: boolean;
                    recalled_at: string | null;
                    reply_to: string | null;
                    reply_preview: string | null;
                };
                Insert: {
                    id?: string;
                    conversation_id: string;
                    sender_id: string;
                    body: string;
                    created_at?: string;
                    media_type?: 'text' | 'image' | 'audio' | 'video' | 'file';
                    media_path?: string | null;
                    media_name?: string | null;
                    media_mime?: string | null;
                    media_size?: number | null;
                    media_duration?: number | null;
                    expires_at?: string | null;
                    is_expired?: boolean;
                    recalled_at?: string | null;
                    reply_to?: string | null;
                    reply_preview?: string | null;
                };
                Update: {
                    body?: string;
                    media_path?: string | null;
                    is_expired?: boolean;
                    recalled_at?: string | null;
                    reply_to?: string | null;
                    reply_preview?: string | null;
                };
                Relationships: [
                ];
            };
            conversation_mutes: {
                Row: {
                    user_id: string;
                    conversation_id: string;
                    created_at: string;
                };
                Insert: {
                    user_id?: string;
                    conversation_id: string;
                    created_at?: string;
                };
                Update: {
                    [_ in never]: never;
                };
                Relationships: [
                ];
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
                Update: {
                    token?: string;
                    device_name?: string | null;
                    updated_at?: string;
                };
                Relationships: [
                ];
            };
            user_titles: {
                Row: {
                    id: string;
                    user_id: string;
                    title: string;
                    gradient: boolean;
                    gradient_from: string | null;
                    gradient_to: string | null;
                    title_gradient: boolean;
                    title_from: string | null;
                    title_to: string | null;
                    name_gradient: boolean;
                    name_from: string | null;
                    name_to: string | null;
                    created_by: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    title: string;
                    gradient?: boolean;
                    gradient_from?: string | null;
                    gradient_to?: string | null;
                    title_gradient?: boolean;
                    title_from?: string | null;
                    title_to?: string | null;
                    name_gradient?: boolean;
                    name_from?: string | null;
                    name_to?: string | null;
                    created_by?: string | null;
                    created_at?: string;
                };
                Update: {
                    title?: string;
                    gradient?: boolean;
                    gradient_from?: string | null;
                    gradient_to?: string | null;
                    title_gradient?: boolean;
                    title_from?: string | null;
                    title_to?: string | null;
                    name_gradient?: boolean;
                    name_from?: string | null;
                    name_to?: string | null;
                };
                Relationships: [
                ];
            };
        };
        Views: {
            profile_titles: {
                Row: {
                    user_id: string;
                    username: string;
                    horizon_id: number | null;
                    title: string | null;
                    title_gradient: boolean | null;
                    title_from: string | null;
                    title_to: string | null;
                    name_gradient: boolean | null;
                    name_from: string | null;
                    name_to: string | null;
                    shown_title: string | null;
                };
                Relationships: [
                ];
            };
        };
        Functions: {
            is_member: {
                Args: {
                    conv: string;
                };
                Returns: boolean;
            };
            grant_title: {
                Args: {
                    target_horizon_id: number;
                    new_title: string;
                    title_grad?: boolean;
                    title_from_hex?: string | null;
                    title_to_hex?: string | null;
                    name_grad?: boolean;
                    name_from_hex?: string | null;
                    name_to_hex?: string | null;
                };
                Returns: string;
            };
            is_owner: {
                Args: Record<PropertyKey, never>;
                Returns: boolean;
            };
            change_username: {
                Args: {
                    new_name: string;
                };
                Returns: undefined;
            };
            set_handle: {
                Args: {
                    new_handle: string;
                };
                Returns: undefined;
            };
            find_for_login: {
                Args: {
                    identifier: string;
                };
                Returns: {
                    id: string;
                    username: string;
                    handle: string | null;
                }[];
            };
            is_username_ok: {
                Args: {
                    u: string;
                };
                Returns: boolean;
            };
            find_by_horizon_id: {
                Args: {
                    hid: number;
                };
                Returns: {
                    id: string;
                    username: string;
                    avatar_url: string | null;
                }[];
            };
            create_dm: {
                Args: {
                    friend: string;
                };
                Returns: string;
            };
            create_group: {
                Args: {
                    group_name: string;
                    member_ids: string[];
                };
                Returns: string;
            };
            add_group_members: {
                Args: {
                    conv: string;
                    member_ids: string[];
                };
                Returns: undefined;
            };
            remove_group_member: {
                Args: {
                    conv: string;
                    member: string;
                };
                Returns: undefined;
            };
            leave_group: {
                Args: {
                    conv: string;
                };
                Returns: undefined;
            };
            dissolve_group: {
                Args: {
                    conv: string;
                };
                Returns: undefined;
            };
            mark_conversation_read: {
                Args: {
                    conv: string;
                };
                Returns: undefined;
            };
            clear_conversation: {
                Args: {
                    conv: string;
                };
                Returns: undefined;
            };
            rename_group: {
                Args: {
                    conv: string;
                    new_name: string;
                };
                Returns: undefined;
            };
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
        Enums: {
            [_ in never]: never;
        };
        CompositeTypes: {
            [_ in never]: never;
        };
    };
};
export type MessageRow = Database['public']['Tables']['messages']['Row'];
