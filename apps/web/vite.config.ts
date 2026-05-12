import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  server: {
    proxy: {
      '/api': {
        target: 'https://contrail-api.vercel.app',
        changeOrigin: true,
      },
    },
  },

  preview: {
    allowedHosts: ['ssh.gsmsv.site'],
  },
});