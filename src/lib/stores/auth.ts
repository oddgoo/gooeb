// Simplified authentication - just stores the mask code
import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

const STORAGE_KEY = 'gooeb_code';
const COOKIE_NAME = 'gooeb_code';

export type AuthState = {
	code: string | null;
	isRegistered: boolean;
};

// Helper to get cookie value
function getCookie(name: string): string | null {
	if (!browser) return null;
	const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
	return match ? match[2] : null;
}

// Helper to set cookie
function setCookie(name: string, value: string, days: number) {
	if (!browser) return;
	const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
	document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Strict`;
}

// Helper to delete cookie
function deleteCookie(name: string) {
	if (!browser) return;
	document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

function getInitialState(): AuthState {
	if (!browser) {
		return { code: null, isRegistered: false };
	}

	// Check localStorage first, then cookie as fallback
	const code = localStorage.getItem(STORAGE_KEY) || getCookie(COOKIE_NAME);
	return {
		code,
		isRegistered: !!code
	};
}

function createAuthStore() {
	const { subscribe, set } = writable<AuthState>(getInitialState());

	return {
		subscribe,

		// Set the code after registration
		setCode(code: string) {
			const upperCode = code.toUpperCase();
			if (browser) {
				localStorage.setItem(STORAGE_KEY, upperCode);
				setCookie(COOKIE_NAME, upperCode, 7); // 7 days
			}
			set({ code: upperCode, isRegistered: true });
		},

		// Clear (sign out)
		clear() {
			if (browser) {
				localStorage.removeItem(STORAGE_KEY);
				deleteCookie(COOKIE_NAME);
			}
			set({ code: null, isRegistered: false });
		},

		// Get current code (for API calls)
		getCode(): string | null {
			return get({ subscribe }).code;
		}
	};
}

export const auth = createAuthStore();
