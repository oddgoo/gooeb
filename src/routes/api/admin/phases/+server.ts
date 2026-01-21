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

// GET /api/admin/phases - List all phases and get current phase
export const GET: RequestHandler = async ({ cookies }) => {
	await requireAdmin(cookies);

	const supabase = createServerClient();

	// Get all phases
	const { data: phases, error: phasesError } = await supabase
		.from('phases')
		.select('*')
		.order('phase_number', { ascending: true });

	if (phasesError) {
		console.error('Admin phases query error:', phasesError);
		error(500, { message: 'Failed to load phases' });
	}

	// Get current phase for the active event
	const { data: events } = await supabase
		.from('events')
		.select('id, current_phase_id')
		.eq('is_active', true)
		.limit(1);

	type EventWithPhase = { id: string; current_phase_id: string | null };
	const activeEvent = (events as EventWithPhase[] | null)?.[0];

	return json({
		phases: phases || [],
		currentPhaseId: activeEvent?.current_phase_id || null,
		eventId: activeEvent?.id || null
	});
};

// PATCH /api/admin/phases - Change the current phase
export const PATCH: RequestHandler = async ({ cookies, request }) => {
	await requireAdmin(cookies);

	const { phaseId, eventId } = await request.json();

	if (!eventId) {
		error(400, { message: 'Event ID required' });
	}

	const supabase = createServerClient();

	// Update the event's current phase
	const { error: updateError } = await supabase
		.from('events')
		.update({ current_phase_id: phaseId } as never)
		.eq('id', eventId);

	if (updateError) {
		console.error('Update phase error:', updateError);
		error(500, { message: 'Failed to update phase' });
	}

	return json({ success: true });
};

// POST /api/admin/phases - Create a new phase
export const POST: RequestHandler = async ({ cookies, request }) => {
	await requireAdmin(cookies);

	const { name, phaseNumber, eventId } = await request.json();

	if (!name || !phaseNumber || !eventId) {
		error(400, { message: 'Name, phase number, and event ID required' });
	}

	const supabase = createServerClient();

	const { data: phase, error: insertError } = await supabase
		.from('phases')
		.insert({
			event_id: eventId,
			phase_number: phaseNumber,
			name: name.trim()
		} as never)
		.select()
		.single();

	if (insertError) {
		console.error('Create phase error:', insertError);
		error(500, { message: 'Failed to create phase' });
	}

	return json({ phase });
};

// DELETE /api/admin/phases - Delete a phase
export const DELETE: RequestHandler = async ({ cookies, request }) => {
	await requireAdmin(cookies);

	const { phaseId } = await request.json();

	if (!phaseId) {
		error(400, { message: 'Phase ID required' });
	}

	const supabase = createServerClient();

	const { error: deleteError } = await supabase.from('phases').delete().eq('id', phaseId);

	if (deleteError) {
		console.error('Delete phase error:', deleteError);
		error(500, { message: 'Failed to delete phase' });
	}

	return json({ success: true });
};
