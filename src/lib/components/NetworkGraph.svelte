<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import type { Network, Options, Node, Edge } from 'vis-network';
	import type { DataSet } from 'vis-data';

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
		remix_bond_id?: string | null;
		phase_number?: number;
	};

	// Using 'any' for DataSet to avoid complex vis-network type compatibility issues
	type NodeData = Node & { id: string };
	type EdgeData = Edge & { id: string };

	// Fallback placeholder image (1x1 pink pixel as data URL)
	const PLACEHOLDER_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

	let { guests = [], bonds = [], highlightedGuestId = null, onBondClick = (_bondId: string) => {} }: {
		guests: Guest[];
		bonds: Bond[];
		highlightedGuestId?: string | null;
		onBondClick?: (bondId: string) => void;
	} = $props();

	let container: HTMLDivElement;
	let network: Network | null = null;
	let nodesDataSet: DataSet<NodeData> | null = null;
	let edgesDataSet: DataSet<EdgeData> | null = null;
	let lastDataHash = '';

	// Create a simple hash of the data to detect actual changes
	function getDataHash(): string {
		const guestIds = guests.map(g => g.id).sort().join(',');
		const bondData = bonds.map(b => `${b.id}:${b.status}`).sort().join(',');
		return `${guestIds}|${bondData}`;
	}

	// Expose fitAll method for parent component
	export function fitAll() {
		if (!network) return;
		network.fit({
			animation: {
				duration: 500,
				easingFunction: 'easeInOutQuad'
			}
		});
	}

	// Build node data for a guest
	function buildNodeData(guest: Guest): NodeData {
		return {
			id: guest.id,
			label: guest.nickname,
			shape: 'circularImage',
			image: guest.photo_url || PLACEHOLDER_IMAGE,
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
		};
	}

	// Build edge data for a bond
	function buildEdgeData(bond: Bond): EdgeData {
		const isCompleted = bond.status === 'completed';
		const isRemix = !!(bond.remix_bond_id || (bond.phase_number && bond.phase_number >= 2));

		if (isRemix) {
			return {
				id: bond.id,
				from: bond.guest_a_id,
				to: bond.guest_b_id,
				width: isCompleted ? 4 : 2,
				dashes: isCompleted ? false : [5, 5],
				color: {
					color: '#00D4AA',
					highlight: '#00D4AA',
					hover: '#00D4AA',
					opacity: isCompleted ? 1.0 : 0.7
				},
				smooth: {
					enabled: true,
					type: 'curvedCW',
					roundness: 0.3
				}
			};
		}

		return {
			id: bond.id,
			from: bond.guest_a_id,
			to: bond.guest_b_id,
			width: isCompleted ? 4 : 2,
			dashes: isCompleted ? false : [5, 5],
			color: {
				color: isCompleted ? '#FFD700' : '#FF69B4',
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
			},
			brokenImage: PLACEHOLDER_IMAGE
		},
		edges: {
			smooth: {
				enabled: true,
				type: 'continuous',
				roundness: 0.5
			}
		}
	};

	async function initNetwork() {
		if (!browser || !container) return;

		const { Network } = await import('vis-network');
		const { DataSet } = await import('vis-data');

		// Create DataSets
		nodesDataSet = new DataSet<NodeData>(guests.map(buildNodeData));
		edgesDataSet = new DataSet<EdgeData>(
			bonds
				.filter((b) => b.status === 'completed' || b.status === 'accepted')
				.map(buildEdgeData)
		);

		// Create network with DataSets
		network = new Network(container, { nodes: nodesDataSet, edges: edgesDataSet }, options);

		// Handle edge clicks
		network.on('click', (params) => {
			if (params.edges.length > 0) {
				const bondId = params.edges[0];
				onBondClick(bondId);
			}
		});

		// Set initial hash
		lastDataHash = getDataHash();
	}

	function updateNetwork() {
		if (!network || !nodesDataSet || !edgesDataSet) return;

		// Get current IDs in DataSets
		const existingNodeIds = new Set(nodesDataSet.getIds());
		const existingEdgeIds = new Set(edgesDataSet.getIds());

		// Build new data
		const newNodeIds = new Set(guests.map(g => g.id));
		const validBonds = bonds.filter((b) => b.status === 'completed' || b.status === 'accepted');
		const newEdgeIds = new Set(validBonds.map(b => b.id));

		// Nodes: Add new, remove old
		const nodesToAdd: NodeData[] = [];
		const nodesToRemove: string[] = [];

		for (const guest of guests) {
			if (!existingNodeIds.has(guest.id)) {
				nodesToAdd.push(buildNodeData(guest));
			}
		}

		for (const id of existingNodeIds) {
			if (!newNodeIds.has(id as string)) {
				nodesToRemove.push(id as string);
			}
		}

		// Edges: Add new, update changed, remove old
		const edgesToAdd: EdgeData[] = [];
		const edgesToUpdate: EdgeData[] = [];
		const edgesToRemove: string[] = [];

		for (const bond of validBonds) {
			if (!existingEdgeIds.has(bond.id)) {
				edgesToAdd.push(buildEdgeData(bond));
			} else {
				// Check if edge needs update (status might have changed)
				const existingEdge = edgesDataSet.get(bond.id);
				const newEdge = buildEdgeData(bond);
				if (existingEdge && existingEdge.width !== newEdge.width) {
					edgesToUpdate.push(newEdge);
				}
			}
		}

		for (const id of existingEdgeIds) {
			if (!newEdgeIds.has(id as string)) {
				edgesToRemove.push(id as string);
			}
		}

		// Apply changes
		if (nodesToRemove.length > 0) {
			nodesDataSet.remove(nodesToRemove);
		}
		if (nodesToAdd.length > 0) {
			nodesDataSet.add(nodesToAdd);
		}
		if (edgesToRemove.length > 0) {
			edgesDataSet.remove(edgesToRemove);
		}
		if (edgesToAdd.length > 0) {
			edgesDataSet.add(edgesToAdd);
		}
		if (edgesToUpdate.length > 0) {
			edgesDataSet.update(edgesToUpdate);
		}

		console.log('NetworkGraph incremental update:', {
			nodesAdded: nodesToAdd.length,
			nodesRemoved: nodesToRemove.length,
			edgesAdded: edgesToAdd.length,
			edgesRemoved: edgesToRemove.length,
			edgesUpdated: edgesToUpdate.length
		});
	}

	onMount(() => {
		initNetwork();
	});

	onDestroy(() => {
		if (network) {
			network.destroy();
			network = null;
		}
		nodesDataSet = null;
		edgesDataSet = null;
	});

	// Update when data changes - only if data actually changed
	$effect(() => {
		// Access data to ensure Svelte tracks changes
		const currentHash = getDataHash();

		if (network && currentHash !== lastDataHash) {
			console.log('NetworkGraph data changed, updating incrementally');
			lastDataHash = currentHash;
			updateNetwork();
		}
	});

	// Handle highlighted guest - focus and select the node
	$effect(() => {
		// Access highlightedGuestId to ensure reactivity
		const guestId = highlightedGuestId;

		console.log('NetworkGraph highlight effect:', { guestId, hasNetwork: !!network });

		if (!network || !guestId) return;

		// Select the node
		network.selectNodes([guestId]);

		// Focus on the node with animation
		network.focus(guestId, {
			scale: 1.5,
			animation: {
				duration: 500,
				easingFunction: 'easeInOutQuad'
			}
		});
	});
</script>

<div bind:this={container} class="w-full h-full min-h-[400px] bg-gradient-to-br from-[#E8F4FF] to-[#FFE8F0]"></div>

<style>
	:global(.vis-network) {
		outline: none;
	}
</style>
