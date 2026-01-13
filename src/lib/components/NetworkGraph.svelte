<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import type { Network, Options, Data } from 'vis-network';

	type Guest = {
		id: string;
		nickname: string;
		photo_url: string;
	};

	type Bond = {
		id: string;
		guest_a_id: string;
		guest_b_id: string;
		status: string;
		photo_url: string | null;
	};

	let { guests = [], bonds = [], onBondClick = (_bondId: string) => {} }: {
		guests: Guest[];
		bonds: Bond[];
		onBondClick?: (bondId: string) => void;
	} = $props();

	let container: HTMLDivElement;
	let network: Network | null = null;

	// Build network data from guests and bonds - Y2K color theme
	function buildNetworkData(): Data {
		const nodes = guests.map((guest) => ({
			id: guest.id,
			label: guest.nickname,
			shape: 'circularImage',
			image: guest.photo_url,
			size: 30,
			font: {
				color: '#FF1493',
				size: 14,
				face: 'VT323, monospace',
				strokeWidth: 3,
				strokeColor: '#ffffff'
			},
			borderWidth: 3,
			borderWidthSelected: 5,
			color: {
				border: '#FF69B4',
				background: '#FFF5F8',
				highlight: {
					border: '#FF1493',
					background: '#ffffff'
				}
			}
		}));

		const edges = bonds
			.filter((bond) => bond.status === 'completed' || bond.status === 'accepted')
			.map((bond) => {
				const isCompleted = bond.status === 'completed';
				return {
					id: bond.id,
					from: bond.guest_a_id,
					to: bond.guest_b_id,
					width: isCompleted ? 4 : 2,
					dashes: isCompleted ? false : [5, 5], // Dashed line for in-progress bonds
					color: {
						color: isCompleted ? '#FFD700' : '#FF69B4', // Gold for completed, pink for in-progress
						highlight: '#FF69B4',
						hover: '#FF69B4',
						opacity: isCompleted ? 1.0 : 0.7
					},
					smooth: {
						enabled: true,
						type: 'continuous',
						roundness: 0.5
					}
				};
			});

		return { nodes, edges };
	}

	const options: Options = {
		physics: {
			enabled: true,
			solver: 'barnesHut',
			barnesHut: {
				gravitationalConstant: -3000,
				centralGravity: 0.3,
				springLength: 150,
				springConstant: 0.04,
				damping: 0.09
			},
			stabilization: {
				enabled: true,
				iterations: 100,
				updateInterval: 25
			}
		},
		interaction: {
			hover: true,
			tooltipDelay: 200,
			zoomView: true,
			dragView: true
		},
		nodes: {
			shapeProperties: {
				useBorderWithImage: true,
				interpolation: false
			}
		},
		edges: {
			smooth: {
				enabled: true,
				type: 'continuous',
				roundness: 0.5
			}
		}
	};

	function initNetwork() {
		if (!browser || !container) return;

		import('vis-network').then(({ Network }) => {
			const data = buildNetworkData();
			network = new Network(container, data, options);

			// Handle edge clicks
			network.on('click', (params) => {
				if (params.edges.length > 0) {
					const bondId = params.edges[0];
					onBondClick(bondId);
				}
			});
		});
	}

	function updateNetwork() {
		if (!network) return;

		const data = buildNetworkData();
		network.setData(data);
	}

	onMount(() => {
		initNetwork();
	});

	onDestroy(() => {
		if (network) {
			network.destroy();
			network = null;
		}
	});

	// Update when data changes - track array lengths for proper reactivity
	$effect(() => {
		// Explicitly access array lengths to ensure Svelte tracks changes
		const guestCount = guests.length;
		const bondCount = bonds.length;

		if (network && (guestCount >= 0 || bondCount >= 0)) {
			updateNetwork();
		}
	});
</script>

<div bind:this={container} class="w-full h-full min-h-[400px] bg-gradient-to-br from-[#E8F4FF] to-[#FFE8F0]"></div>

<style>
	:global(.vis-network) {
		outline: none;
	}
</style>
