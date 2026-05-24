import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/live-blog': {
        target: 'https://www.foxsports.com/live-blog/motor/indy-500-live-updates-lineup-leaderboard-highlights',
        changeOrigin: true,
        rewrite: () => '',
      },
      '/api/racetrax': {
        target: 'https://www.foxsports.com/motor/110th-running-of-the-indianapolis-500-ntt-indycar-series-may-24-2026-racetrax-6052',
        changeOrigin: true,
        rewrite: () => '',
      }
    }
  }
})
