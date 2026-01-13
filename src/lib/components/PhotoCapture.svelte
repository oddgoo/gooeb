<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { resizeImage, captureFromVideo } from '$lib/utils/image';

	type Props = {
		onCapture: (dataUrl: string) => void;
		initialPhoto?: string | null;
	};

	let { onCapture, initialPhoto = null }: Props = $props();

	let videoElement: HTMLVideoElement | null = $state(null);
	let stream: MediaStream | null = $state(null);
	let capturedPhoto: string | null = $state(null);
	let cameraError = $state('');
	let facingMode: 'user' | 'environment' = $state('user');
	let isCapturing = $state(false);
	let isStartingCamera = $state(false);

	// Set initial photo if provided
	$effect(() => {
		if (initialPhoto && !capturedPhoto) {
			capturedPhoto = initialPhoto;
		}
	});

	onMount(async () => {
		if (browser && !initialPhoto) {
			await startCamera();
		}
	});

	onDestroy(() => {
		stopCamera();
	});

	async function startCamera() {
		if (!browser || isStartingCamera) return;

		isStartingCamera = true;
		cameraError = '';

		try {
			stream = await navigator.mediaDevices.getUserMedia({
				video: {
					facingMode,
					width: { ideal: 1280 },
					height: { ideal: 720 }
				}
			});

			if (videoElement) {
				videoElement.srcObject = stream;
			}
		} catch (e) {
			console.error('Camera error:', e);
			if (e instanceof Error && e.name === 'NotAllowedError') {
				cameraError = 'Camera access denied. Please allow camera access or upload a photo.';
			} else {
				cameraError = 'Could not access camera. Try uploading a photo instead.';
			}
		} finally {
			isStartingCamera = false;
		}
	}

	function stopCamera() {
		if (stream) {
			stream.getTracks().forEach((track) => track.stop());
			stream = null;
		}
	}

	async function capture() {
		if (!videoElement || isCapturing) return;

		isCapturing = true;
		try {
			const dataUrl = await captureFromVideo(videoElement);
			capturedPhoto = dataUrl;
			onCapture(dataUrl);
			stopCamera();
		} catch (e) {
			console.error('Capture error:', e);
			cameraError = 'Failed to capture photo. Please try again.';
		} finally {
			isCapturing = false;
		}
	}

	async function retake() {
		capturedPhoto = null;
		await startCamera();
	}

	async function switchCamera() {
		facingMode = facingMode === 'user' ? 'environment' : 'user';
		stopCamera();
		await startCamera();
	}

	async function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		try {
			const dataUrl = await resizeImage(file);
			capturedPhoto = dataUrl;
			onCapture(dataUrl);
			stopCamera();
		} catch (e) {
			console.error('File resize error:', e);
			cameraError = 'Failed to process image. Please try another.';
		}
	}
</script>

<div class="relative aspect-square bg-gray-900 rounded-2xl overflow-hidden">
	{#if capturedPhoto}
		<!-- Captured photo preview -->
		<img src={capturedPhoto} alt="Captured" class="w-full h-full object-cover" />
		<div class="absolute bottom-4 left-0 right-0 flex justify-center">
			<button
				type="button"
				onclick={retake}
				class="bg-white/90 backdrop-blur px-6 py-2 rounded-full font-medium text-gray-800
				       hover:bg-white transition-colors"
			>
				Retake
			</button>
		</div>
	{:else if cameraError}
		<!-- Camera error state -->
		<div class="flex flex-col items-center justify-center h-full p-6 text-center">
			<div class="text-5xl mb-4">📷</div>
			<p class="text-white/80 mb-6 text-sm">{cameraError}</p>
			<label
				class="bg-gooeb-600 text-white px-6 py-3 rounded-xl cursor-pointer
				       hover:bg-gooeb-700 transition-colors font-medium"
			>
				Upload Photo
				<input type="file" accept="image/*" class="hidden" onchange={handleFileSelect} />
			</label>
		</div>
	{:else}
		<!-- Camera view -->
		<video
			bind:this={videoElement}
			autoplay
			playsinline
			muted
			class="w-full h-full object-cover scale-x-[-1]"
		></video>

		<!-- Camera controls overlay -->
		<div class="absolute bottom-4 left-0 right-0 flex justify-center items-center gap-4">
			<!-- Switch camera button -->
			<button
				type="button"
				onclick={switchCamera}
				class="bg-black/30 backdrop-blur p-3 rounded-full text-white
				       hover:bg-black/50 transition-colors"
				aria-label="Switch camera"
			>
				<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
					/>
				</svg>
			</button>

			<!-- Capture button -->
			<button
				type="button"
				onclick={capture}
				disabled={isCapturing}
				class="w-16 h-16 bg-white rounded-full border-4 border-gooeb-500
				       hover:scale-105 active:scale-95 transition-transform
				       disabled:opacity-50 disabled:cursor-not-allowed"
				aria-label="Take photo"
			></button>

			<!-- Upload fallback -->
			<label
				class="bg-black/30 backdrop-blur p-3 rounded-full text-white cursor-pointer
				       hover:bg-black/50 transition-colors"
				aria-label="Upload photo"
			>
				<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
					/>
				</svg>
				<input type="file" accept="image/*" class="hidden" onchange={handleFileSelect} />
			</label>
		</div>

		<!-- Loading overlay -->
		{#if isStartingCamera}
			<div class="absolute inset-0 flex items-center justify-center bg-gray-900">
				<div
					class="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin"
				></div>
			</div>
		{/if}
	{/if}
</div>
