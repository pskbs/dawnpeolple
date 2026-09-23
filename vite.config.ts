import react from '@vitejs/plugin-react'
import type { IncomingMessage } from 'node:http'
import { defineConfig, loadEnv, type Plugin } from 'vite'

import aitDevtools from "@apps-in-toss/devtools/unplugin";

async function readBody(req: IncomingMessage) {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks)
}

// 로컬 개발(pnpm dev)에서도 api/ 서버리스 함수를 쓸 수 있게 해요. 배포(Vercel)에서는 Vercel이 직접 실행해요.
// api/auth/reset-password.ts의 `export async function POST(request: Request)` 같은 웹 표준 형식만 지원해요.
function localApi(): Plugin {
  return {
    name: 'local-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api', async (req, res) => {
        try {
          const url = new URL(req.url ?? '/', 'http://localhost')
          const route = url.pathname.replace(/^\/+|\/+$/g, '')
          if (!/^[a-z0-9/-]+$/.test(route)) {
            res.statusCode = 404
            res.end()
            return
          }
          const mod = (await server.ssrLoadModule(`/api/${route}.ts`)) as Record<
            string,
            ((request: Request) => Promise<Response>) | undefined
          >
          const handler = mod[req.method ?? 'GET']
          if (!handler) {
            res.statusCode = 405
            res.end()
            return
          }
          const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req)
          const response = await handler(
            new Request(url, {
              method: req.method,
              headers: req.headers as Record<string, string>,
              body,
            }),
          )
          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (err) {
          server.config.logger.error(`[local-api] ${err instanceof Error ? err.message : String(err)}`)
          res.statusCode = 500
          res.end()
        }
      })
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 서버 함수가 process.env로 .env 값을 읽을 수 있게 넣어줘요(VITE_ 접두사 없는 값은 브라우저 번들에 들어가지 않아요).
  for (const [key, value] of Object.entries(loadEnv(mode, process.cwd(), ''))) process.env[key] ??= value
  return {
    plugins: [aitDevtools.vite(), react(), localApi()],
  };
})
