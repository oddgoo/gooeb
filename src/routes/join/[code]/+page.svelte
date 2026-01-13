<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	onMount(() => {
		// Auto-redirect to registration with code context
		const params = new URLSearchParams({
			code: data.code,
			maskCodeId: data.maskCodeId,
			eventId: data.eventId
		});
		goto(`/register?${params.toString()}`);
	});
</script>

<div class="min-h-screen flex items-center justify-center">
	<div class="win-window p-6 text-center">
		<div
			class="w-12 h-12 border-4 border-y2k-pink border-t-transparent rounded-full animate-spin mx-auto mb-4"
		></div>
		<p class="text-win-text">Preparing your registration...</p>
	</div>
</div>
