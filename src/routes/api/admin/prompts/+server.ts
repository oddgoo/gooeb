import { json, error } from '@sveltejs/kit';
import { createServerClient, getGuestByCode } from '$lib/supabase/server';
import type { RequestHandler } from './$types';
import type { PromptCategory } from '$lib/supabase/types';

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

// GET /api/admin/prompts - List all prompts
export const GET: RequestHandler = async ({ cookies }) => {
	await requireAdmin(cookies);

	const supabase = createServerClient();

	const { data: prompts } = await supabase
		.from('prompts')
		.select('*')
		.order('category', { ascending: true })
		.order('word', { ascending: true });

	return json({ prompts: prompts || [] });
};

// POST /api/admin/prompts - Create a new prompt
export const POST: RequestHandler = async ({ cookies, request }) => {
	await requireAdmin(cookies);

	const { word, category, eventId } = await request.json();

	if (!word || !category || !eventId) {
		error(400, { message: 'Word, category, and eventId required' });
	}

	const validCategories: PromptCategory[] = ['character', 'theme', 'place'];
	if (!validCategories.includes(category)) {
		error(400, { message: 'Invalid category' });
	}

	const supabase = createServerClient();

	const { data: prompt, error: insertError } = await supabase
		.from('prompts')
		.insert({
			event_id: eventId,
			word: word.trim(),
			category,
			is_active: true
		} as never)
		.select()
		.single();

	if (insertError) {
		error(500, { message: 'Failed to create prompt' });
	}

	return json({ prompt });
};

// PATCH /api/admin/prompts - Toggle prompt active status
export const PATCH: RequestHandler = async ({ cookies, request }) => {
	await requireAdmin(cookies);

	const { promptId, isActive } = await request.json();

	if (!promptId || typeof isActive !== 'boolean') {
		error(400, { message: 'Prompt ID and isActive required' });
	}

	const supabase = createServerClient();

	const { error: updateError } = await supabase
		.from('prompts')
		.update({ is_active: isActive } as never)
		.eq('id', promptId);

	if (updateError) {
		error(500, { message: 'Failed to update prompt' });
	}

	return json({ success: true });
};

// DELETE /api/admin/prompts - Delete a prompt
export const DELETE: RequestHandler = async ({ cookies, request }) => {
	await requireAdmin(cookies);

	const { promptId } = await request.json();

	if (!promptId) {
		error(400, { message: 'Prompt ID required' });
	}

	const supabase = createServerClient();

	const { error: deleteError } = await supabase.from('prompts').delete().eq('id', promptId);

	if (deleteError) {
		error(500, { message: 'Failed to delete prompt' });
	}

	return json({ success: true });
};
