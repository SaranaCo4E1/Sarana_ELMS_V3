import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.tsx'],
            refresh: true,
        }),
        react(),
        tailwindcss(),
    ],
    server: {
        host: process.env.VITE_HOST ?? '127.0.0.1',
        hmr: process.env.VITE_HMR_HOST
            ? {
                  host: process.env.VITE_HMR_HOST,
              }
            : undefined,
        watch: {
            ignored: ['**/storage/framework/views/**'],
        },
    },
});
