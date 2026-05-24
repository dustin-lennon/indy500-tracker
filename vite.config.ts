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
        target: 'https://api.foxsports.com/bifrost/v1/nascar/event/6052/data?apikey=jE7yBJVRNAwdDesMgTzTXUUSx1It41Fq',
        changeOrigin: true,
        rewrite: () => '',
      }
    }
  }
})
