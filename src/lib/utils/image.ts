// Client-side image handling utilities

const MAX_WIDTH = 1200;
const MAX_HEIGHT = 1200;
const JPEG_QUALITY = 0.85;
const TRANSPARENCY_FILL = '#C8D8F0'; // soft cornflower blue for PNG transparency

/**
 * Resize an image file/blob to max dimensions and return as data URL
 */
export async function resizeImage(file: File | Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		const url = URL.createObjectURL(file);

		img.onload = () => {
			URL.revokeObjectURL(url);

			let { width, height } = img;

			// Calculate new dimensions maintaining aspect ratio
			if (width > MAX_WIDTH || height > MAX_HEIGHT) {
				const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
				width = Math.round(width * ratio);
				height = Math.round(height * ratio);
			}

			// Create canvas and draw resized image
			const canvas = document.createElement('canvas');
			canvas.width = width;
			canvas.height = height;

			const ctx = canvas.getContext('2d');
			if (!ctx) {
				reject(new Error('Failed to get canvas context'));
				return;
			}

			// Fill with soft blue so PNG transparency doesn't become black
			ctx.fillStyle = TRANSPARENCY_FILL;
			ctx.fillRect(0, 0, width, height);
			ctx.drawImage(img, 0, 0, width, height);

			// Convert to data URL
			const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
			resolve(dataUrl);
		};

		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('Failed to load image'));
		};

		img.src = url;
	});
}

/**
 * Capture a frame from a video element and return as resized data URL
 */
export async function captureFromVideo(video: HTMLVideoElement): Promise<string> {
	const canvas = document.createElement('canvas');
	canvas.width = video.videoWidth;
	canvas.height = video.videoHeight;

	const ctx = canvas.getContext('2d');
	if (!ctx) {
		throw new Error('Failed to get canvas context');
	}

	ctx.fillStyle = TRANSPARENCY_FILL;
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	ctx.drawImage(video, 0, 0);

	// Create blob and resize
	return new Promise((resolve, reject) => {
		canvas.toBlob(
			async (blob) => {
				if (!blob) {
					reject(new Error('Failed to capture image'));
					return;
				}
				try {
					const resized = await resizeImage(blob);
					resolve(resized);
				} catch (e) {
					reject(e);
				}
			},
			'image/jpeg',
			JPEG_QUALITY
		);
	});
}

/**
 * Convert data URL to Blob for upload
 */
export function dataUrlToBlob(dataUrl: string): Blob {
	const parts = dataUrl.split(',');
	const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
	const bstr = atob(parts[1]);
	let n = bstr.length;
	const u8arr = new Uint8Array(n);
	while (n--) {
		u8arr[n] = bstr.charCodeAt(n);
	}
	return new Blob([u8arr], { type: mime });
}
