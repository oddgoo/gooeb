// Database types for The Gooeb
// These match the schema in supabase/migrations/001_initial_schema.sql

export type PromptCategory = 'character' | 'theme' | 'place';

export type Database = {
	public: {
		Tables: {
			events: {
				Row: {
					id: string;
					name: string;
					slug: string;
					is_active: boolean;
					created_at: string;
				};
				Insert: {
					id?: string;
					name: string;
					slug: string;
					is_active?: boolean;
					created_at?: string;
				};
				Update: {
					id?: string;
					name?: string;
					slug?: string;
					is_active?: boolean;
					created_at?: string;
				};
			};
			mask_codes: {
				Row: {
					id: string;
					event_id: string;
					code: string;
					is_claimed: boolean;
					claimed_at: string | null;
					created_at: string;
				};
				Insert: {
					id?: string;
					event_id: string;
					code: string;
					is_claimed?: boolean;
					claimed_at?: string | null;
					created_at?: string;
				};
				Update: {
					id?: string;
					event_id?: string;
					code?: string;
					is_claimed?: boolean;
					claimed_at?: string | null;
					created_at?: string;
				};
			};
			guests: {
				Row: {
					id: string;
					event_id: string;
					mask_code_id: string | null;
					nickname: string;
					photo_url: string;
					auth_token: string;
					is_admin: boolean;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					event_id: string;
					mask_code_id?: string | null;
					nickname: string;
					photo_url: string;
					auth_token: string;
					is_admin?: boolean;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					event_id?: string;
					mask_code_id?: string | null;
					nickname?: string;
					photo_url?: string;
					auth_token?: string;
					is_admin?: boolean;
					created_at?: string;
					updated_at?: string;
				};
			};
			prompts: {
				Row: {
					id: string;
					event_id: string;
					word: string;
					category: PromptCategory;
					is_active: boolean;
					times_used: number;
					created_at: string;
				};
				Insert: {
					id?: string;
					event_id: string;
					word: string;
					category: PromptCategory;
					is_active?: boolean;
					times_used?: number;
					created_at?: string;
				};
				Update: {
					id?: string;
					event_id?: string;
					word?: string;
					category?: PromptCategory;
					is_active?: boolean;
					times_used?: number;
					created_at?: string;
				};
			};
			bonds: {
				Row: {
					id: string;
					event_id: string;
					guest_a_id: string;
					guest_b_id: string;
					prompt_id: string | null;
					status: 'pending' | 'accepted' | 'completed' | 'rejected' | 'expired';
					photo_url: string | null;
					initiated_at: string;
					accepted_at: string | null;
					completed_at: string | null;
				};
				Insert: {
					id?: string;
					event_id: string;
					guest_a_id: string;
					guest_b_id: string;
					prompt_id?: string | null;
					status?: 'pending' | 'accepted' | 'completed' | 'rejected' | 'expired';
					photo_url?: string | null;
					initiated_at?: string;
					accepted_at?: string | null;
					completed_at?: string | null;
				};
				Update: {
					id?: string;
					event_id?: string;
					guest_a_id?: string;
					guest_b_id?: string;
					prompt_id?: string | null;
					status?: 'pending' | 'accepted' | 'completed' | 'rejected' | 'expired';
					photo_url?: string | null;
					initiated_at?: string;
					accepted_at?: string | null;
					completed_at?: string | null;
				};
			};
		};
	};
};

// Convenience types
export type Event = Database['public']['Tables']['events']['Row'];
export type MaskCode = Database['public']['Tables']['mask_codes']['Row'];
export type Guest = Database['public']['Tables']['guests']['Row'];
export type Prompt = Database['public']['Tables']['prompts']['Row'];
export type Bond = Database['public']['Tables']['bonds']['Row'];
export type BondStatus = Bond['status'];

// Extended types with relations
export type GuestWithMaskCode = Guest & {
	mask_codes: MaskCode | null;
};

export type BondWithDetails = Bond & {
	prompt: Prompt | null;
	guest_a: Guest;
	guest_b: Guest;
};
