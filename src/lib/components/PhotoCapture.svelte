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

<div class="win-inset aspect-square bg-black overflow-hidden">
	{#if capturedPhoto}
		<!-- Captured photo preview -->
		<div class="relative w-full h-full">
			<img src={capturedPhoto} alt="Captured" class="w-full h-full object-cover" />
			<div class="absolute bottom-2 left-0 right-0 flex justify-center">
				<button
					type="button"
					onclick={retake}
					class="win-btn text-sm"
				>
					Retake
				</button>
			</div>
		</div>
	{:else if cameraError}
		<!-- Camera error state -->
		<div class="flex flex-col items-center justify-center h-full p-4 text-center bg-win-bg">
			<div class="text-4xl mb-3">📷</div>
			<p class="text-win-text text-sm mb-4">{cameraError}</p>
			<label class="win-btn bg-win-title text-white cursor-pointer">
				Browse...
				<input type="file" accept="image/*" class="hidden" onchange={handleFileSelect} />
			</label>
		</div>
	{:else}
		<!-- Camera view -->
		<div class="relative w-full h-full">
			<video
				bind:this={videoElement}
				autoplay
				playsinline
				muted
				class="w-full h-full object-cover scale-x-[-1]"
			></video>

			<!-- Camera controls -->
			<div class="absolute bottom-2 left-0 right-0 flex justify-center items-center gap-2">
				<button
					type="button"
					onclick={switchCamera}
					class="win-btn text-xs px-2 min-w-0"
					aria-label="Switch camera"
				>
					🔄
				</button>

				<button
					type="button"
					onclick={capture}
					disabled={isCapturing}
					class="win-btn px-4 bg-win-title text-white"
					aria-label="Take photo"
				>
					📸 Capture
				</button>

				<label class="win-btn text-xs px-2 min-w-0 cursor-pointer" aria-label="Upload photo">
					📁
					<input type="file" accept="image/*" class="hidden" onchange={handleFileSelect} />
				</label>
			</div>

			<!-- Loading overlay -->
			{#if isStartingCamera}
				<div class="absolute inset-0 flex items-center justify-center bg-win-bg">
					<div class="text-center">
						<div class="text-2xl animate-pulse">⏳</div>
						<div class="text-sm mt-2">Starting camera...</div>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>
