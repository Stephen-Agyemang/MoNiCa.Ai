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
  }
})
