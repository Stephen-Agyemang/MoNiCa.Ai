import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  envDir: '../',
  optimizeDeps: {
    include: [
      '@clerk/clerk-react',
      '@livekit/components-react',
      '@vladmandic/face-api',
      'axios',
      'framer-motion',
      'livekit-client',
      'lucide-react',
      'react',
      'react-dom',
      'react-markdown',
      'rehype-raw',
      'remark-gfm'
    ],
    exclude: ['pdfjs-dist']
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@vladmandic/face-api'))                                      return 'vendor-face-api';
          if (id.includes('@livekit/components-react') || id.includes('livekit-client')) return 'vendor-livekit';
          if (id.includes('@clerk/clerk-react'))                                         return 'vendor-clerk';
          if (id.includes('react-markdown') || id.includes('rehype-raw') || id.includes('remark-gfm')) return 'vendor-markdown';
          if (id.includes('framer-motion'))                                              return 'vendor-motion';
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/')) return 'vendor-react';
        },
      },
    },
  },
})
