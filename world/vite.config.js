import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
export default defineConfig({build:{rolldownOptions:{input:{main:fileURLToPath(new URL('./index.html',import.meta.url)),studio:fileURLToPath(new URL('./asset-studio.html',import.meta.url))}}}});
