import { error } from '@sveltejs/kit';
import { createServerClient, getGuestByCode } from '$lib/supabase/server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, cookies }) => {
	const supabase = createServerClient();
	const bondId = params.id;

	// Get current user
	const myCode = cookies.get('gooeb_code');
	if (!myCode) {
		error(401, { message: 'Not authenticated' });
	}

	const me = await getGuestByCode(myCode);
	if (!me) {
		error(401, { message: 'Invalid session' });
	}

	// Get the bond with details
	const { data: bondData } = await supabase
		.from('bonds')
		.select(`
			id,
			status,
			guest_a_id,
			guest_b_id,
			photo_url,
			guest_a:guests!bonds_guest_a_id_fkey(id, nickname, photo_url),
			guest_b:guests!bonds_guest_b_id_fkey(id, nickname, photo_url),
			prompt:prompts(id, word, category)
		`)
		.eq('id', bondId)
		.single();

	const bond = bondData as {
		id: string;
		status: string;
		guest_a_id: string;
		guest_b_id: string;
		photo_url: string | null;
		guest_a: { id: string; nickname: string; photo_url: string };
		guest_b: { id: string; nickname: string; photo_url: string };
		prompt: { id: string; word: string; category: string } | null;
	} | null;

	if (!bond) {
		error(404, { message: 'Bond not found' });
	}

	// Verify user is part of this bond
	if (bond.guest_a_id !== me.id && bond.guest_b_id !== me.id) {
		error(403, { message: 'You are not part of this bond' });
	}

	// Bond must be in accepted status to complete
	if (bond.status !== 'accepted') {
		error(400, { message: 'This bond cannot be completed' });
	}

	// Determine partner
	const isGuestA = bond.guest_a_id === me.id;
	const partner = isGuestA ? bond.guest_b : bond.guest_a;

	return {
		bond: {
			id: bond.id,
			prompt: bond.prompt,
			partner
		}
	};
};
