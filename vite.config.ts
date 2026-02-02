import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
    server: {
        host: true,
        port: 5173,
        allowedHosts: true,
        proxy: {
            '/api/auth': {
                target: 'http://localhost:8080',
                changeOrigin: true,
                secure: false
            },
            '/api/tidal': {
                target: 'http://localhost:8080',
                changeOrigin: true,
                secure: false
            },
            '/api/playlists': {
                target: 'http://localhost:8080',
                changeOrigin: true,
                secure: false
            },
            '/api/genres': {
                target: 'http://localhost:8080',
                changeOrigin: true,
                secure: false
            },
            '/api/analysis': {
                target: 'http://localhost:8080',
                changeOrigin: true,
                secure: false
            },
            '/api/pms': {
                target: 'http://localhost:8080',
                changeOrigin: true,
                secure: false
            },
            '/api/ems': {
                target: 'http://localhost:8080',
                changeOrigin: true,
                secure: false
            },
            '/api/itunes': {
                target: 'http://localhost:8080',
                changeOrigin: true,
                secure: false
            },
            '/api/spotify': {
                target: 'http://localhost:8080',
                changeOrigin: true,
                secure: false
            },
            '/api/youtube': {
                target: 'http://localhost:8080',
                changeOrigin: true,
                secure: false
            },
            '/api/youtube-music': {
                target: 'http://localhost:8080',
                changeOrigin: true,
                secure: false
            },

            '/api/training': {
                target: 'http://localhost:8080',
                changeOrigin: true,
                secure: false
            },
            '/api': {
                target: 'http://localhost:3001',
                changeOrigin: true,
                secure: false
            },
            '/images': {
                target: 'http://localhost:3001',
                changeOrigin: true,
                secure: false
            },
            '/apple-proxy': {
                target: 'https://amp-api-edge.music.apple.com/v1',
                changeOrigin: true,
                secure: true,
                rewrite: (path) => path.replace(/^\/apple-proxy/, ''),
                headers: {
                    'Origin': 'https://music.apple.com',
                    'Referer': 'https://music.apple.com/'
                }
            }
        }
    },
    build: {
        target: 'esnext' // Allow top-level await
    },
    esbuild: {
        target: 'esnext' // Allow top-level await
    },
    optimizeDeps: {
        esbuildOptions: {
            target: 'esnext' // Allow top-level await
        }
    }
})
