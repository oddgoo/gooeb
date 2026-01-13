<script>
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<title>The Gooeb</title>
	<meta name="description" content="Bond with friends at the party" />
</svelte:head>

{@render children()}
