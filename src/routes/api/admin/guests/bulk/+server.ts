import { json, error } from '@sveltejs/kit';
import { createServerClient, getGuestByCode } from '$lib/supabase/server';
import { v4 as uuidv4 } from 'uuid';
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

export const POST: RequestHandler = async ({ request, cookies }) => {
	await requireAdmin(cookies);
	const supabase = createServerClient();

	const formData = await request.formData();
	const csvFile = formData.get('csv') as File | null;

	if (!csvFile) {
		error(400, { message: 'CSV file is required' });
	}

	// Parse CSV
	const csvText = await csvFile.text();
	const lines = csvText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

	// Skip header if present
	const header = lines[0].toLowerCase();
	const startIndex = header.includes('code') && header.includes('nickname') ? 1 : 0;

	// Collect photo files by nickname
	const photoFiles = new Map<string, File>();
	for (const [key, value] of formData.entries()) {
		if (key === 'photos' && value instanceof File && value.size > 0) {
			// Strip extension to get nickname
			const name = value.name.replace(/\.[^.]+$/, '');
			photoFiles.set(name.toLowerCase(), value);
		}
	}

	const created: string[] = [];
	const updated: string[] = [];
	const skipped: string[] = [];
	const errors: string[] = [];

	for (let i = startIndex; i < lines.length; i++) {
		const line = lines[i];
		// Parse CSV row: code,nickname,intro_text
		// Handle possible quoted fields
		const parts = parseCSVLine(line);

		if (parts.length < 2) {
			errors.push(`Line ${i + 1}: not enough columns`);
			continue;
		}

		const code = parts[0].trim().toUpperCase();
		const nickname = parts[1].trim();
		const introText = parts.length > 2 ? parts[2].trim() || null : null;

		if (!code || !nickname) {
			errors.push(`Line ${i + 1}: missing code or nickname`);
			continue;
		}

		// Look up mask code
		const { data: maskCode } = await supabase
			.from('mask_codes')
			.select('id, event_id, is_claimed')
			.eq('code', code)
			.single();

		const mc = maskCode as { id: string; event_id: string; is_claimed: boolean } | null;

		if (!mc) {
			errors.push(`Line ${i + 1}: code ${code} not found`);
			continue;
		}

		// Check if guest already exists for this mask code
		const { data: existingGuest } = await supabase
			.from('guests')
			.select('id')
			.eq('mask_code_id', mc.id)
			.single();

		if (existingGuest) {
			const eg = existingGuest as { id: string };
			const updateObj: Record<string, string | null> = {
				nickname,
				intro_text: introText
			};

			// Upload photo if provided
			const photoFile = photoFiles.get(nickname.toLowerCase());
			if (photoFile) {
				const ext = photoFile.name.split('.').pop() || 'png';
				const photoPath = `guests/${eg.id}.${ext}`;
				const buffer = Buffer.from(await photoFile.arrayBuffer());

				const { error: uploadError } = await supabase.storage
					.from('photos')
					.upload(photoPath, buffer, {
						contentType: photoFile.type || 'image/png',
						upsert: true
					});

				if (uploadError) {
					errors.push(`Line ${i + 1}: photo upload failed for ${nickname}`);
					continue;
				}

				const {
					data: { publicUrl }
				} = supabase.storage.from('photos').getPublicUrl(photoPath);
				updateObj.photo_url = publicUrl;
			}

			const { error: updateError } = await supabase
				.from('guests')
				.update(updateObj as never)
				.eq('id', eg.id);

			if (updateError) {
				errors.push(`Line ${i + 1}: failed to update guest ${nickname} - ${updateError.message}`);
				continue;
			}

			updated.push(`${code} - ${nickname}`);
			continue;
		}

		const guestId = uuidv4();
		let photoUrl = '';

		// Look for matching photo file by nickname
		const photoFile = photoFiles.get(nickname.toLowerCase());
		if (photoFile) {
			const ext = photoFile.name.split('.').pop() || 'png';
			const photoPath = `guests/${guestId}.${ext}`;
			const buffer = Buffer.from(await photoFile.arrayBuffer());

			const { error: uploadError } = await supabase.storage
				.from('photos')
				.upload(photoPath, buffer, {
					contentType: photoFile.type || 'image/png',
					upsert: false
				});

			if (uploadError) {
				errors.push(`Line ${i + 1}: photo upload failed for ${nickname}`);
				continue;
			}

			const {
				data: { publicUrl }
			} = supabase.storage.from('photos').getPublicUrl(photoPath);
			photoUrl = publicUrl;
		}

		// Create guest record - do NOT claim the mask code
		const { error: guestError } = await supabase.from('guests').insert({
			id: guestId,
			event_id: mc.event_id,
			mask_code_id: mc.id,
			nickname,
			photo_url: photoUrl,
			auth_token: uuidv4(),
			intro_text: introText
		} as never);

		if (guestError) {
			errors.push(`Line ${i + 1}: failed to create guest ${nickname} - ${guestError.message}`);
			continue;
		}

		created.push(`${code} - ${nickname}`);
	}

	return json({
		created: created.length,
		updated: updated.length,
		skipped: skipped.length,
		errors,
		details: { created, updated, skipped }
	});
};

function parseCSVLine(line: string): string[] {
	const result: string[] = [];
	let current = '';
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];
		if (char === '"') {
			inQuotes = !inQuotes;
		} else if (char === ',' && !inQuotes) {
			result.push(current);
			current = '';
		} else {
			current += char;
		}
	}
	result.push(current);
	return result;
}
