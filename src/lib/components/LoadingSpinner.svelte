<script lang="ts">
	type Props = {
		size?: 'sm' | 'md' | 'lg';
		color?: 'pink' | 'white' | 'current';
	};

	let { size = 'md', color = 'pink' }: Props = $props();

	const sizeClasses = {
		sm: 'w-4 h-4',
		md: 'w-6 h-6',
		lg: 'w-8 h-8'
	};

	const colorClasses = {
		pink: 'border-y2k-pink',
		white: 'border-white',
		current: 'border-current'
	};
</script>

<span
	class="inline-block rounded-full border-2 border-t-transparent animate-spin-slow {sizeClasses[size]} {colorClasses[color]}"
	role="status"
	aria-label="Loading"
></span>
