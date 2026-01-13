<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';

	let { children, data }: { children: Snippet; data: LayoutData } = $props();
</script>

<div class="min-h-screen bg-gray-50">
	{@render children()}
</div>
