<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import PhotoCapture from '$lib/components/PhotoCapture.svelte';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';

	import { activityEmoji } from '$lib/utils/activityEmojis';

	let pageData = $derived($page.data as {
		bond: {
			id: string;
			prompt: { id: string; word: string; category: string } | null;
			myPrompt: { id: string; word: string; category: string } | null;
			partnerPrompt: { id: string; word: string; category: string } | null;
			partner: { id: string; nickname: string; photo_url: string };
			activityPrompt: { id: string; description: string; activity_category: string | null } | null;
			remixSourcePhoto: string | null;
			isRemix: boolean;
		};
	});

	let bond = $derived(pageData.bond);

	let photoDataUrl: string | null = $state(null);
	let isSubmitting = $state(false);
	let error = $state('');

	function handlePhotoCapture(dataUrl: string) {
		photoDataUrl = dataUrl;
		error = '';
	}

	async function handleSubmit() {
		if (!photoDataUrl) {
			error = 'Please take a photo to complete the meld';
			return;
		}

		isSubmitting = true;
		error = '';

		try {
			const response = await fetch(`/api/bond/${bond.id}/complete`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ photoDataUrl })
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.message || 'Failed to complete bond');
			}

			// Success! Go back to bond page
			goto('/bond');
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to complete meld';
		} finally {
			isSubmitting = false;
		}
	}
</script>

<div class="min-h-screen flex flex-col">
	<!-- Main Window - fills screen on mobile -->
	<div class="win-window flex-1 flex flex-col m-0 sm:m-4 sm:max-w-lg sm:mx-auto sm:flex-initial">
		<!-- Title Bar -->
		<div class="win-titlebar">
			<span>Complete Meld</span>
			<div class="flex gap-1">
				{#if isSubmitting}
					<span class="win-btn px-2 py-0 min-w-0 text-xs opacity-50 cursor-not-allowed">X</span>
				{:else}
					<a href="/bond" class="win-btn px-2 py-0 min-w-0 text-xs">X</a>
				{/if}
			</div>
		</div>

		<!-- Window Content - scrollable -->
		<div class="p-3 space-y-3 flex-1 overflow-y-auto">

			<!-- Partner Info -->
			<div class="win-groupbox">
				<span class="win-groupbox-label">Melding with</span>
				<div class="flex items-center gap-3">
					<div class="win-inset p-1">
						<img
							src={bond.partner.photo_url}
							alt={bond.partner.nickname}
							class="w-12 h-12 object-cover"
						/>
					</div>
					<div class="font-bold text-lg">{bond.partner.nickname}</div>
				</div>
			</div>

			<!-- Remix / Words Display -->
			{#if bond.isRemix && bond.remixSourcePhoto}
				<div class="text-center py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded space-y-2">
					{#if bond.activityPrompt}
						<div class="text-base font-bold">
							{bond.activityPrompt.activity_category ? activityEmoji(bond.activityPrompt.activity_category) + ' ' : ''}{bond.activityPrompt.description}
						</div>
					{/if}
					<div class="text-sm font-bold opacity-90">Remix this meld:</div>
					<div class="mx-auto w-32 h-32 win-inset p-1 bg-white/20">
						<img
							src={bond.remixSourcePhoto}
							alt="Source meld to remix"
							class="w-full h-full object-cover"
						/>
					</div>
				</div>
			{:else}
				{#if bond.activityPrompt}
					<div class="text-center py-3 bg-gradient-to-r from-y2k-pink to-y2k-magenta text-white rounded space-y-2">
						<div class="text-base font-bold">
							{bond.activityPrompt.activity_category ? activityEmoji(bond.activityPrompt.activity_category) + ' ' : ''}{bond.activityPrompt.description}
						</div>
						{#if bond.myPrompt && bond.partnerPrompt}
							<div class="text-sm opacity-90">
								Your words are: <strong>{bond.myPrompt.word}</strong> + <strong>{bond.partnerPrompt.word}</strong>
							</div>
						{:else if bond.myPrompt}
							<div class="text-sm opacity-90">
								Your word is: <strong>{bond.myPrompt.word}</strong>
							</div>
						{:else if bond.prompt}
							<div class="text-sm opacity-90">
								Your word is: <strong>{bond.prompt.word}</strong>
							</div>
						{/if}
					</div>
				{:else if bond.myPrompt && bond.partnerPrompt}
					<div class="text-center py-3 bg-gradient-to-r from-y2k-pink to-y2k-magenta text-white rounded">
						<div class="text-sm">
							Your words are: <strong>{bond.myPrompt.word}</strong> + <strong>{bond.partnerPrompt.word}</strong>
						</div>
					</div>
				{:else if bond.myPrompt}
					<div class="text-center py-3 bg-gradient-to-r from-y2k-pink to-y2k-magenta text-white rounded">
						<div class="text-sm">
							Your word is: <strong>{bond.myPrompt.word}</strong>
						</div>
					</div>
				{:else if bond.prompt}
					<div class="text-center py-3 bg-gradient-to-r from-y2k-pink to-y2k-magenta text-white rounded">
						<div class="text-sm">
							Your word is: <strong>{bond.prompt.word}</strong>
						</div>
					</div>
				{/if}
			{/if}

			<!-- Photo Capture -->
			<div class="win-groupbox">
				<span class="win-groupbox-label">Completion Photo</span>
				<p class="text-sm text-win-textDisabled mb-2">
					Take a photo together that represents your prompt!
				</p>
				<PhotoCapture onCapture={handlePhotoCapture} />
			</div>

			<!-- Error -->
			{#if error}
				<div class="win-inset p-2 bg-red-100 text-red-800 text-sm">
					{error}
				</div>
			{/if}

			<!-- Actions -->
			<div class="flex gap-2">
				{#if isSubmitting}
					<span class="win-btn flex-1 text-center py-2 opacity-50 cursor-not-allowed">
						Cancel
					</span>
				{:else}
					<a href="/bond" class="win-btn flex-1 text-center py-2">
						Cancel
					</a>
				{/if}
				<button
					type="button"
					onclick={handleSubmit}
					disabled={isSubmitting || !photoDataUrl}
					class="win-btn bg-gradient-to-r from-y2k-cyan to-y2k-pink text-white flex-1 py-2"
				>
					{#if isSubmitting}
						<LoadingSpinner size="sm" color="white" /> Uploading...
					{:else}
						Complete Meld
					{/if}
				</button>
			</div>

		</div>

		<!-- Status Bar -->
		<div class="bg-win-bg border-t-2 border-win-btnHighlight px-2 py-1 text-sm">
			<div class="win-inset px-2">
				{#if photoDataUrl}
					Photo ready
				{:else}
					Waiting for photo...
				{/if}
			</div>
		</div>
	</div>
</div>
