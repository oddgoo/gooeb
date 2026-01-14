<script lang="ts">
	import { page } from '$app/stores';
</script>

<div class="min-h-screen flex flex-col">
	<div class="win-window flex-1 flex flex-col m-0 sm:m-4 sm:max-w-lg sm:mx-auto sm:flex-initial">
		<!-- Title Bar -->
		<div class="win-titlebar">
			<span>Error</span>
		</div>

		<!-- Window Content -->
		<div class="p-6 flex-1 flex flex-col items-center justify-center text-center">
			<div class="text-6xl mb-4">
				{#if $page.status === 404}
					🔍
				{:else}
					⚠️
				{/if}
			</div>

			<div class="text-2xl font-bold mb-2">
				{$page.status}
			</div>

			<div class="text-win-text mb-6">
				{$page.error?.message || 'Something went wrong'}
			</div>

			<a href="/" class="win-btn bg-gradient-to-r from-y2k-pink to-y2k-magenta text-white px-6 py-2">
				Go Back
			</a>
		</div>

		<!-- Status Bar -->
		<div class="bg-win-bg border-t-2 border-win-btnHighlight px-2 py-1 text-sm">
			<div class="win-inset px-2">Error {$page.status}</div>
		</div>
	</div>
</div>
