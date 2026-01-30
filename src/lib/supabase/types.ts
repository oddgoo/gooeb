// Database types for The Gooeb
// These match the schema in supabase/migrations/001_initial_schema.sql

export type PromptCategory = 'character' | 'theme' | 'place';
export type ActivityCategory = 'drawing' | 'pose' | 'craft' | 'photo';

export type Phase = {
	id: string;
	event_id: string;
	phase_number: number;
	name: string;
	created_at: string;
};

export type ActivityPrompt = {
	id: string;
	event_id: string;
	description: string;
	is_active: boolean;
	times_used: number;
	phase_numbers: number[];
	activity_category: ActivityCategory;
	created_at: string;
};

export type Database = {
	public: {
		Tables: {
			events: {
				Row: {
					id: string;
					name: string;
					slug: string;
					is_active: boolean;
					current_phase_id: string | null;
					created_at: string;
				};
				Insert: {
					id?: string;
					name: string;
					slug: string;
					is_active?: boolean;
					current_phase_id?: string | null;
					created_at?: string;
				};
				Update: {
					id?: string;
					name?: string;
					slug?: string;
					is_active?: boolean;
					current_phase_id?: string | null;
					created_at?: string;
				};
			};
			phases: {
				Row: {
					id: string;
					event_id: string;
					phase_number: number;
					name: string;
					created_at: string;
				};
				Insert: {
					id?: string;
					event_id: string;
					phase_number: number;
					name: string;
					created_at?: string;
				};
				Update: {
					id?: string;
					event_id?: string;
					phase_number?: number;
					name?: string;
					created_at?: string;
				};
			};
			activity_prompts: {
				Row: {
					id: string;
					event_id: string;
					description: string;
					is_active: boolean;
					times_used: number;
					phase_numbers: number[];
					activity_category: string;
					created_at: string;
				};
				Insert: {
					id?: string;
					event_id: string;
					description: string;
					is_active?: boolean;
					times_used?: number;
					phase_numbers?: number[];
					activity_category?: string;
					created_at?: string;
				};
				Update: {
					id?: string;
					event_id?: string;
					description?: string;
					is_active?: boolean;
					times_used?: number;
					phase_numbers?: number[];
					activity_category?: string;
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
					team_emoji: string | null;
					intro_text: string | null;
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
					team_emoji?: string | null;
					intro_text?: string | null;
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
					team_emoji?: string | null;
					intro_text?: string | null;
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
					prompt_a_id: string | null;
					prompt_b_id: string | null;
					activity_prompt_id: string | null;
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
					prompt_a_id?: string | null;
					prompt_b_id?: string | null;
					activity_prompt_id?: string | null;
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
					prompt_a_id?: string | null;
					prompt_b_id?: string | null;
					activity_prompt_id?: string | null;
					status?: 'pending' | 'accepted' | 'completed' | 'rejected' | 'expired';
					photo_url?: string | null;
					initiated_at?: string;
					accepted_at?: string | null;
					completed_at?: string | null;
				};
			};
			point_ledger: {
				Row: {
					id: string;
					event_id: string | null;
					guest_id: string;
					points: number;
					reason: string;
					created_by: string | null;
					created_at: string;
				};
				Insert: {
					id?: string;
					event_id?: string | null;
					guest_id: string;
					points: number;
					reason?: string;
					created_by?: string | null;
					created_at?: string;
				};
				Update: {
					id?: string;
					event_id?: string | null;
					guest_id?: string;
					points?: number;
					reason?: string;
					created_by?: string | null;
					created_at?: string;
				};
				Relationships: [];
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
export type PhaseRow = Database['public']['Tables']['phases']['Row'];
export type ActivityPromptRow = Database['public']['Tables']['activity_prompts']['Row'];

// Extended types with relations
export type GuestWithMaskCode = Guest & {
	mask_codes: MaskCode | null;
};

export type BondWithDetails = Bond & {
	prompt: Prompt | null;
	prompt_a: Prompt | null;
	prompt_b: Prompt | null;
	activity_prompt: ActivityPrompt | null;
	guest_a: Guest;
	guest_b: Guest;
};
