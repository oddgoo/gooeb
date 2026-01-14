import { redirect, error } from '@sveltejs/kit';
import { createServerClient, getGuestByCode } from '$lib/supabase/server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, cookies }) => {
	const supabase = createServerClient();
	const code = params.code.toUpperCase();

	// Check if user already has a code cookie (they're registered)
	const existingCode = cookies.get('gooeb_code');

	if (existingCode) {
		const existingGuest = await getGuestByCode(existingCode);

		if (existingGuest) {
			// User is already registered
			// Check if they're tapping someone else's code (to send invite)
			if (code !== existingCode.toUpperCase()) {
				const { data: targetMaskCode } = await supabase
					.from('mask_codes')
					.select('id, is_claimed')
					.eq('code', code)
					.single();

				const maskCodeData = targetMaskCode as { id: string; is_claimed: boolean } | null;

				if (maskCodeData?.is_claimed) {
					// This code belongs to another guest - redirect to bond page with invite param
					redirect(303, `/bond?invite=${code}`);
				}
			}

			// Either tapping own code or unclaimed code - go to bond page
			redirect(303, '/bond');
		}
	}

	// New user - check if code exists and is unclaimed
	const { data: maskCode, error: codeError } = await supabase
		.from('mask_codes')
		.select('id, is_claimed, event_id')
		.eq('code', code)
		.single();

	const maskCodeResult = maskCode as { id: string; is_claimed: boolean; event_id: string } | null;

	if (codeError || !maskCodeResult) {
		error(404, {
			message: 'Invalid mask code. Please check your code and try again.'
		});
	}

	if (maskCodeResult.is_claimed) {
		// Code is claimed - fetch guest data for "Is this you?" confirmation
		const claimedGuest = await getGuestByCode(code);

		if (!claimedGuest) {
			// Data inconsistency - code claimed but no guest found
			error(500, {
				message: 'Something went wrong. Please try again or ask for help.'
			});
		}

		return {
			code,
			isClaimed: true as const,
			claimedGuest: {
				id: claimedGuest.id,
				nickname: claimedGuest.nickname,
				photo_url: claimedGuest.photo_url
			}
		};
	}

	// Valid unclaimed code - proceed to registration
	return {
		code,
		isClaimed: false as const,
		maskCodeId: maskCodeResult.id,
		eventId: maskCodeResult.event_id
	};
};
