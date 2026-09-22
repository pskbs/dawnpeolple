import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

// vite.config는 mode에 따라 .env를 읽는 함수 형태라 호출해서 합쳐요.
export default defineConfig((env) =>
  mergeConfig(
    viteConfig(env),
    defineConfig({
      test: {
        environment: 'jsdom',
        globals: true,
        exclude: ['**/node_modules/**', 'tests/e2e/**'],
      },
    }),
  ),
)
