import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['src/**/*.integration.{test,spec}.{js,ts}'],
		environment: 'node',
		globals: true,
		testTimeout: 30000, // Longer timeout for API calls
		hookTimeout: 30000,
		// Run integration tests sequentially to avoid race conditions
		fileParallelism: false
	}
});
