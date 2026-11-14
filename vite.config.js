import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Static SPA → dist/. Vendor chunks keep the app bundle small and cacheable.
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          d3: ['d3'],
          motion: ['framer-motion'],
        },
      },
    },
  },
});
