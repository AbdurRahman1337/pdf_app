import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://192.168.0.115:8000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://192.168.0.115:8000',
        changeOrigin: true,
      },
      '/upload': {
        target: 'http://192.168.0.115:8000',
        changeOrigin: true,
      },
      '/documents': {
        target: 'http://192.168.0.115:8000',
        changeOrigin: true,
      },
      '/chat': {
        target: 'http://192.168.0.115:8000',
        changeOrigin: true,
      },
      '/quiz': {
        target: 'http://192.168.0.115:8000',
        changeOrigin: true,
      },
    },
  },
});

