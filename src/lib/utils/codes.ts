// 3-digit numeric mask code utilities

/**
 * Format a code input, keeping only digits
 */
export function formatCode(input: string): string {
	return input.replace(/[^0-9]/g, '').slice(0, 3);
}

/**
 * Validate a 3-digit code
 */
export function validateCode(code: string): boolean {
	return /^[0-9]{3}$/.test(code);
}

/**
 * Generate a random 3-digit code (with leading zeros)
 */
export function generateCode(): string {
	return Math.floor(Math.random() * 1000)
		.toString()
		.padStart(3, '0');
}

/**
 * Format code for display
 */
export function displayCode(code: string): string {
	return code.padStart(3, '0');
}
