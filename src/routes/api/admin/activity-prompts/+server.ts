import { json, error } from '@sveltejs/kit';
import { createServerClient, getGuestByCode } from '$lib/supabase/server';
import type { RequestHandler } from './$types';

async function requireAdmin(cookies: { get: (name: string) => string | undefined }) {
	const code = cookies.get('gooeb_code');
	if (!code) {
		error(401, { message: 'Not authenticated' });
	}

	const guest = await getGuestByCode(code);
	if (!guest) {
		error(401, { message: 'Invalid session' });
	}

	if (!guest.is_admin) {
		error(403, { message: 'Admin access required' });
	}

	return guest;
}

// GET /api/admin/activity-prompts - List all activity prompts
export const GET: RequestHandler = async ({ cookies }) => {
	await requireAdmin(cookies);

	const supabase = createServerClient();

	const { data: activityPrompts, error: queryError } = await supabase
		.from('activity_prompts')
		.select('*')
		.order('activity_category', { ascending: true })
		.order('description', { ascending: true });

	if (queryError) {
		console.error('Admin activity prompts query error:', queryError);
		error(500, { message: 'Failed to load activity prompts' });
	}

	return json({ activityPrompts: activityPrompts || [] });
};

// POST /api/admin/activity-prompts - Create a new activity prompt
export const POST: RequestHandler = async ({ cookies, request }) => {
	await requireAdmin(cookies);

	const { description, phaseNumbers, activityCategory, eventId } = await request.json();

	if (!description || !eventId) {
		error(400, { message: 'Description and event ID required' });
	}

	const supabase = createServerClient();

	const { data: activityPrompt, error: insertError } = await supabase
		.from('activity_prompts')
		.insert({
			event_id: eventId,
			description: description.trim(),
			phase_numbers: phaseNumbers || [1],
			activity_category: activityCategory || 'general',
			is_active: true
		} as never)
		.select()
		.single();

	if (insertError) {
		console.error('Create activity prompt error:', insertError);
		error(500, { message: 'Failed to create activity prompt' });
	}

	return json({ activityPrompt });
};

// PATCH /api/admin/activity-prompts - Update an activity prompt
export const PATCH: RequestHandler = async ({ cookies, request }) => {
	await requireAdmin(cookies);

	const { activityPromptId, isActive, phaseNumbers, activityCategory } = await request.json();

	if (!activityPromptId) {
		error(400, { message: 'Activity prompt ID required' });
	}

	const supabase = createServerClient();

	const updateData: Record<string, unknown> = {};
	if (typeof isActive === 'boolean') updateData.is_active = isActive;
	if (phaseNumbers) updateData.phase_numbers = phaseNumbers;
	if (activityCategory) updateData.activity_category = activityCategory;

	const { error: updateError } = await supabase
		.from('activity_prompts')
		.update(updateData as never)
		.eq('id', activityPromptId);

	if (updateError) {
		console.error('Update activity prompt error:', updateError);
		error(500, { message: 'Failed to update activity prompt' });
	}

	return json({ success: true });
};

// DELETE /api/admin/activity-prompts - Delete an activity prompt
export const DELETE: RequestHandler = async ({ cookies, request }) => {
	await requireAdmin(cookies);

	const { activityPromptId } = await request.json();

	if (!activityPromptId) {
		error(400, { message: 'Activity prompt ID required' });
	}

	const supabase = createServerClient();

	const { error: deleteError } = await supabase
		.from('activity_prompts')
		.delete()
		.eq('id', activityPromptId);

	if (deleteError) {
		console.error('Delete activity prompt error:', deleteError);
		error(500, { message: 'Failed to delete activity prompt' });
	}

	return json({ success: true });
};
