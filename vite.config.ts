import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		exclude: ['src/**/*.integration.{test,spec}.{js,ts}', 'node_modules'],
		environment: 'jsdom',
		globals: true
	}
});
