import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// .env를 Node 테스트 컨텍스트에도 읽어들여요(dotenv 패키지 없이 최소 구현).
export function loadEnv() {
  const path = resolve(process.cwd(), '.env')
  const content = readFileSync(path, 'utf8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    const value = trimmed.slice(idx + 1).trim()
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}
