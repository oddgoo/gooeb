import type { ActivityCategory } from '$lib/supabase/types';

const activityEmojiMap: Record<ActivityCategory, string> = {
	drawing: '🎨',
	pose: '💃',
	craft: '🧶',
	photo: '📷'
};

export function activityEmoji(category: string): string {
	return activityEmojiMap[category as ActivityCategory] ?? '';
}
