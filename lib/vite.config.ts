export default {
        test: {
        environment: 'jsdom',
        globals: true,
        include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
        setupFiles: ['@vitest/web-worker'],
        coverage: {
            provider: 'v8'
        }
    }
}