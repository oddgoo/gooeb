<script lang="ts">
	import { goto } from '$app/navigation';
	import { formatCode, validateCode } from '$lib/utils/codes';

	let code = $state('');
	let error = $state('');
	let isSubmitting = $state(false);

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

<div class="min-h-screen flex flex-col items-center justify-center p-4">
	<!-- Main Window -->
	<div class="win-window w-full max-w-sm">
		<!-- Title Bar -->
		<div class="win-titlebar">
			<span>Welcome to The Gooeb</span>
			<div class="flex gap-1">
				<button class="win-btn px-2 py-0 min-w-0 text-xs">?</button>
			</div>
		</div>

		<!-- Window Content -->
		<div class="p-4 space-y-4">
			<!-- Logo/Title Area -->
			<div class="text-center py-4">
				<div class="text-4xl font-bold text-win-title mb-2">THE GOOEB</div>
				<div class="text-sm text-win-textDisabled">Bond with friends at the party</div>
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
							class="win-input w-full text-center text-3xl tracking-[0.4em] font-mono font-bold py-3"
						/>
					</div>

					{#if error}
						<div class="win-inset p-2 bg-red-100 text-red-800 text-sm">
							{error}
						</div>
					{/if}

					<button
						type="submit"
						disabled={isSubmitting || code.length !== 4}
						class="win-btn bg-win-title text-white w-full py-2 text-lg"
					>
						{isSubmitting ? 'Loading...' : 'OK'}
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

	<!-- Desktop Icons (decorative) -->
	<div class="mt-8 flex gap-6 text-center text-white text-xs">
		<div class="flex flex-col items-center gap-1 opacity-70">
			<div class="text-3xl">🎭</div>
			<span>Masks</span>
		</div>
		<div class="flex flex-col items-center gap-1 opacity-70">
			<div class="text-3xl">🤝</div>
			<span>Bonds</span>
		</div>
		<div class="flex flex-col items-center gap-1 opacity-70">
			<div class="text-3xl">📸</div>
			<span>Photos</span>
		</div>
	</div>
</div>
