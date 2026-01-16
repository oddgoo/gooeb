<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { formatCode, validateCode } from '$lib/utils/codes';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';

	let code = $state('');
	let error = $state('');
	let isSubmitting = $state(false);

	let message = $derived($page.url.searchParams.get('message'));

	function handleInput(e: Event) {
		const input = e.target as HTMLInputElement;
		code = formatCode(input.value);
		error = '';
	}

	async function handleSubmit() {
		if (!validateCode(code)) {
			error = 'Please enter a valid 4-digit code';
			return;
		}

		isSubmitting = true;
		error = '';

		try {
			await goto(`/join/${code}`);
		} catch {
			error = 'Something went wrong. Please try again.';
			isSubmitting = false;
		}
	}
</script>

<div class="min-h-screen flex flex-col">
	<!-- Main Window - fills screen on mobile -->
	<div class="win-window flex-1 flex flex-col m-0 sm:m-auto sm:max-w-sm sm:flex-initial sm:my-8">
		<!-- Title Bar -->
		<div class="win-titlebar">
			<span>Cuauh's Mega Mind Meld Imaginarium OS</span>
			<div class="flex gap-1">
				<button class="win-btn px-2 py-0 min-w-0 text-xs">?</button>
			</div>
		</div>

		<!-- Window Content -->
		<div class="p-4 space-y-4 flex-1 flex flex-col justify-center">
			<!-- Logo/Title Area -->
			<div class="text-center py-4">
				<div class="text-2xl font-bold text-win-title mb-2">MEGA MIND MELD IMAGINARIUM</div>
				<div class="text-sm text-win-textDisabled">Mind meld with friends at the party</div>
			</div>

			<!-- Code Entry Group -->
			<div class="win-groupbox">
				<span class="win-groupbox-label">Enter Code</span>

				<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
					<div>
						<label for="code" class="block text-sm mb-2">Mask code:</label>
						<input
							id="code"
							type="text"
							inputmode="numeric"
							pattern="[0-9]*"
							value={code}
							oninput={handleInput}
							placeholder="0000"
							maxlength="4"
							autocomplete="off"
							disabled={isSubmitting}
							class="win-input w-full text-center text-3xl tracking-[0.4em] font-mono font-bold py-3"
						/>
					</div>

					{#if error}
						<div class="win-inset p-2 bg-red-100 text-red-800 text-sm">
							{error}
						</div>
					{/if}

					{#if message === 'reclaim_declined'}
						<div class="win-inset p-2 bg-yellow-100 text-yellow-800 text-sm">
							That code belongs to someone else. Please find your own mask or ask a host for help.
						</div>
					{/if}

					<button
						type="submit"
						disabled={isSubmitting || code.length !== 4}
						class="win-btn bg-gradient-to-r from-y2k-pink to-y2k-magenta text-white w-full py-2 text-lg"
					>
						{#if isSubmitting}
							<LoadingSpinner size="sm" color="white" /> Loading...
						{:else}
							OK
						{/if}
					</button>
				</form>
			</div>

			<!-- Help Text -->
			<div class="win-inset p-2 text-sm">
				<div class="flex items-start gap-2">
					<span class="text-lg">💡</span>
					<span>Look for the 4-digit code on your mask, or tap your mask's NFC tag on your phone.</span>
				</div>
			</div>
		</div>

		<!-- Status Bar -->
		<div class="bg-win-bg border-t-2 border-win-btnHighlight px-2 py-1 text-sm">
			<div class="win-inset px-2">Ready to party</div>
		</div>
	</div>

	<!-- Desktop Icons (decorative) - hidden on mobile -->
	<div class="hidden sm:flex mt-8 gap-6 text-center text-white text-xs justify-center">
		<div class="flex flex-col items-center gap-1 opacity-70">
			<div class="text-3xl">🎭</div>
			<span>Masks</span>
		</div>
		<div class="flex flex-col items-center gap-1 opacity-70">
			<div class="text-3xl">🧠</div>
			<span>Melds</span>
		</div>
		<div class="flex flex-col items-center gap-1 opacity-70">
			<div class="text-3xl">📸</div>
			<span>Photos</span>
		</div>
	</div>
</div>
