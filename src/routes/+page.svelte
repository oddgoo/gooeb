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

<div class="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-gooeb-50 to-white">
	<div class="text-center mb-10">
		<h1 class="text-5xl font-bold text-gooeb-600 mb-2">The Gooeb</h1>
		<p class="text-gray-500 text-lg">Bond with friends at the party</p>
	</div>

	<div class="w-full max-w-sm">
		<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-6">
			<div>
				<label for="code" class="block text-sm font-medium text-gray-700 mb-2 text-center">
					Enter your mask code
				</label>
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
					class="w-full text-center text-4xl tracking-[0.5em] font-mono font-bold
					       p-4 border-2 border-gray-200 rounded-2xl
					       focus:border-gooeb-500 focus:outline-none transition-colors
					       placeholder:text-gray-300 placeholder:tracking-[0.5em]"
				/>
				{#if error}
					<p class="text-red-500 mt-2 text-center text-sm">{error}</p>
				{/if}
			</div>

			<button
				type="submit"
				disabled={isSubmitting || code.length !== 4}
				class="btn-primary w-full text-lg"
			>
				{isSubmitting ? 'Entering...' : 'Enter the Party'}
			</button>
		</form>

		<div class="mt-8 text-center">
			<p class="text-gray-400 text-sm">
				Or tap your mask's NFC tag
			</p>
		</div>
	</div>

	<div class="mt-auto pt-8">
		<p class="text-gray-300 text-xs">
			Look for the 4-digit code on your mask
		</p>
	</div>
</div>
