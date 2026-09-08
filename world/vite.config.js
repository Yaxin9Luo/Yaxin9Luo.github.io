import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
import {reviewCapturePlugin} from './review-capture-plugin.js';
export default defineConfig({plugins:[reviewCapturePlugin()],build:{rolldownOptions:{input:{main:fileURLToPath(new URL('./index.html',import.meta.url)),studio:fileURLToPath(new URL('./asset-studio.html',import.meta.url)),review:fileURLToPath(new URL('./quality-review.html',import.meta.url)),exhibit:fileURLToPath(new URL('./exhibit-studio.html',import.meta.url))}}}});
