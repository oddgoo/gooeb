<script>
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<title>Cuauh's Mega Mind Meld Imaginarium OS</title>
	<meta name="description" content="Mind meld with friends at the party" />
</svelte:head>

{@render children()}
