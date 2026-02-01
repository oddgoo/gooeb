<script lang="ts">
	type ShowcaseBond = {
		id: string;
		guest_a_id: string;
		guest_b_id: string;
		status: string;
		photo_url: string | null;
		phase_number: number;
		remix_bond_id: string | null;
		prompt: { word: string; category: string } | null;
		prompt_a: { word: string; category: string } | null;
		prompt_b: { word: string; category: string } | null;
		activity_prompt: { description: string; activity_category: string | null } | null;
		remix_source?: { id: string; photo_url: string | null } | null;
	};

	type GuestInfo = { id: string; nickname: string; photo_url: string };

	type Props = {
		guest: { id: string; nickname: string; photo_url: string; team_emoji: string | null; code: string };
		bonds: ShowcaseBond[];
		guestMap: Map<string, GuestInfo>;
		imageCache: Map<string, string>;
	};

	let { guest, bonds, guestMap, imageCache }: Props = $props();

	/** Returns a base64 data URL from cache, or empty string if unavailable */
	function cachedSrc(url: string | null | undefined): string {
		if (!url) return '';
		const cached = imageCache.get(url);
		if (cached !== undefined) return cached || '';
		// Don't fall back to original URL — html-to-image can't handle cross-origin
		return '';
	}

	function activityEmoji(category: string | null | undefined): string {
		if (!category) return '';
		const map: Record<string, string> = { drawing: '🎨', pose: '💃', craft: '🧶', photo: '📷', prose: '✍️' };
		return map[category] ?? '';
	}

	function getPartner(bond: ShowcaseBond): GuestInfo | null {
		const partnerId = bond.guest_a_id === guest.id ? bond.guest_b_id : bond.guest_a_id;
		return guestMap.get(partnerId) || null;
	}

	function getMyPrompt(bond: ShowcaseBond): { word: string; category: string } | null {
		if (!bond.prompt_a && !bond.prompt_b) return bond.prompt;
		const isA = bond.guest_a_id === guest.id;
		return isA ? bond.prompt_a : bond.prompt_b;
	}

	function getPartnerPrompt(bond: ShowcaseBond): { word: string; category: string } | null {
		if (!bond.prompt_a && !bond.prompt_b) return null;
		const isA = bond.guest_a_id === guest.id;
		return isA ? bond.prompt_b : bond.prompt_a;
	}

	function isRemix(bond: ShowcaseBond): boolean {
		return bond.phase_number === 2 || !!bond.remix_bond_id;
	}
</script>

<div
	style="width: 800px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: linear-gradient(135deg, #dbeafe 0%, #fce7f3 50%, #ede9fe 100%); padding: 32px; box-sizing: border-box;"
>
	<!-- Guest Profile Header -->
	<div
		style="background: white; border-radius: 16px; padding: 24px; display: flex; align-items: center; gap: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"
	>
		{#if cachedSrc(guest.photo_url)}
			<img
				src={cachedSrc(guest.photo_url)}
				alt={guest.nickname}
				style="width: 120px; height: 120px; border-radius: 12px; object-fit: cover; border: 3px solid #e5e7eb;"
			/>
		{:else}
			<div style="width: 120px; height: 120px; border-radius: 12px; background: #e5e7eb; display: flex; align-items: center; justify-content: center; font-size: 48px;">
				👤
			</div>
		{/if}
		<div style="flex: 1;">
			<div style="font-size: 32px; font-weight: 800; color: #1f2937; line-height: 1.2;">
				{guest.nickname}
				{#if guest.team_emoji}
					<span style="margin-left: 8px;">{guest.team_emoji}</span>
				{/if}
			</div>
			<div style="font-size: 16px; color: #6b7280; margin-top: 4px; font-family: monospace;">
				Code: {guest.code}
			</div>
		</div>
	</div>

	<!-- Melds Section -->
	<div style="margin-top: 24px;">
		<div style="font-size: 20px; font-weight: 700; color: #374151; margin-bottom: 16px;">
			Melds ({bonds.length} total)
		</div>

		{#if bonds.length === 0}
			<div style="background: white; border-radius: 12px; padding: 32px; text-align: center; color: #9ca3af; font-size: 16px;">
				No melds yet
			</div>
		{:else}
			<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
				{#each bonds as bond}
					{@const partner = getPartner(bond)}
					{@const myPrompt = getMyPrompt(bond)}
					{@const partnerPrompt = getPartnerPrompt(bond)}
					{@const remix = isRemix(bond)}
					<div
						style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 6px rgba(0,0,0,0.08); border: 2px solid {remix ? '#99f6e4' : '#fce7f3'};"
					>
						<!-- Meld Photo -->
						{#if cachedSrc(bond.photo_url)}
							<img
								src={cachedSrc(bond.photo_url)}
								alt="Meld"
								style="width: 100%; aspect-ratio: 1 / 1; object-fit: cover;"
							/>
						{:else}
							<div style="width: 100%; height: 80px; background: {remix ? 'linear-gradient(135deg, #ccfbf1, #a5f3fc)' : 'linear-gradient(135deg, #fce7f3, #ede9fe)'}; display: flex; align-items: center; justify-content: center; color: #9ca3af; font-size: 14px;">
								{bond.status === 'completed' ? 'No photo' : 'Pending completion'}
							</div>
						{/if}

						<div style="padding: 12px;">
							<!-- Participants -->
							<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
								{#if cachedSrc(guest.photo_url)}
									<img
										src={cachedSrc(guest.photo_url)}
										alt={guest.nickname}
										style="width: 32px; height: 32px; border-radius: 6px; object-fit: cover;"
									/>
								{:else}
									<div style="width: 32px; height: 32px; border-radius: 6px; background: #e5e7eb; display: flex; align-items: center; justify-content: center; font-size: 14px;">👤</div>
								{/if}
								<span style="font-size: 13px; font-weight: 600; color: #374151; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
									{guest.nickname}
								</span>
								<span style="font-size: 16px;">🤝</span>
								{#if partner}
									{#if cachedSrc(partner.photo_url)}
										<img
											src={cachedSrc(partner.photo_url)}
											alt={partner.nickname}
											style="width: 32px; height: 32px; border-radius: 6px; object-fit: cover;"
										/>
									{:else}
										<div style="width: 32px; height: 32px; border-radius: 6px; background: #e5e7eb; display: flex; align-items: center; justify-content: center; font-size: 14px;">👤</div>
									{/if}
									<span style="font-size: 13px; font-weight: 600; color: #374151; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
										{partner.nickname}
									</span>
								{/if}
							</div>

							<!-- Activity prompt -->
							{#if bond.activity_prompt}
								<div style="font-size: 12px; color: #6b7280; margin-bottom: 6px;">
									{activityEmoji(bond.activity_prompt.activity_category)} {bond.activity_prompt.description}
								</div>
							{/if}

							<!-- Word prompts or Remix badge -->
							{#if remix}
								<div
									style="display: inline-block; background: linear-gradient(135deg, #0d9488, #06b6d4); color: white; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 999px; letter-spacing: 0.05em;"
								>
									REMIX
								</div>
								{#if cachedSrc(bond.remix_source?.photo_url)}
									<div style="margin-top: 6px;">
										<img
											src={cachedSrc(bond.remix_source?.photo_url)}
											alt="Source"
											style="width: 60px; height: 40px; object-fit: cover; border-radius: 6px; border: 1px solid #e5e7eb;"
										/>
									</div>
								{/if}
							{:else if myPrompt}
								<div
									style="background: linear-gradient(135deg, #fce7f3, #ede9fe); padding: 6px 12px; border-radius: 8px; font-size: 13px; font-weight: 600; color: #7c3aed;"
								>
									Words: {myPrompt.word}{partnerPrompt ? ` + ${partnerPrompt.word}` : ''}
								</div>
							{/if}

							<!-- Status badge -->
							{#if bond.status !== 'completed'}
								<div style="margin-top: 6px; font-size: 11px; color: #f59e0b; font-weight: 600; text-transform: uppercase;">
									{bond.status}
								</div>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Footer -->
	<div style="margin-top: 24px; text-align: center; font-size: 14px; color: #9ca3af; font-weight: 600;">
		Cuauh's Mega Mind Meld Imaginarium OS
	</div>
</div>
