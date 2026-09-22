// 토스 로그인 서버 연동 공용 헬퍼(api/ 서버 전용, CLAUDE.md 규칙 6·8).
// 토스 로그인 API는 파트너 서버 → 앱인토스 서버 mTLS 호출이 필수예요(서버리스 Edge 런타임 불가, Node 런타임 필요).
import { createDecipheriv } from 'node:crypto'
import { Agent, request as httpsRequest } from 'node:https'

const BASE_URL = 'https://apps-in-toss-api.toss.im'

let cachedAgent: Agent | null = null

function mtlsAgent() {
  if (cachedAgent) return cachedAgent
  const certB64 = process.env.TOSS_MTLS_CERT_BASE64
  const keyB64 = process.env.TOSS_MTLS_KEY_BASE64
  if (!certB64 || !keyB64) throw new Error('toss_mtls_not_configured')
  cachedAgent = new Agent({
    cert: Buffer.from(certB64, 'base64'),
    key: Buffer.from(keyB64, 'base64'),
    keepAlive: true,
  })
  return cachedAgent
}

// node:https는 fetch(undici)와 별개의 TLS 소켓 계층이라 mTLS(client cert)를 직접 넘길 수 있어요.
// (Vercel Edge 런타임의 global fetch는 이 옵션을 지원하지 않아 Node 런타임에서만 동작해요.)
function tossRequest<T>(method: 'GET' | 'POST', path: string, opts: { bearer?: string; body?: unknown }): Promise<T> {
  const body = opts.body ? JSON.stringify(opts.body) : undefined
  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      BASE_URL + path,
      {
        method,
        agent: mtlsAgent(),
        headers: {
          'content-type': 'application/json',
          ...(opts.bearer ? { authorization: `Bearer ${opts.bearer}` } : {}),
          ...(body ? { 'content-length': Buffer.byteLength(body) } : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          let json: unknown
          try {
            json = text ? JSON.parse(text) : {}
          } catch {
            reject(new Error(`toss_api_bad_response:${res.statusCode}`))
            return
          }
          if ((res.statusCode ?? 0) >= 400) {
            reject(new Error(`toss_api_error:${res.statusCode}:${text.slice(0, 300)}`))
            return
          }
          resolve(json as T)
        })
      },
    )
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

type GenerateTokenSuccess = {
  success: {
    tokenType: string
    accessToken: string
    refreshToken: string
    expiresIn: string
    scope: string
  }
}

export async function generateToken(authorizationCode: string, referrer: string) {
  const res = await tossRequest<GenerateTokenSuccess>('POST', '/api-partner/v1/apps-in-toss/user/oauth2/generate-token', {
    body: { authorizationCode, referrer },
  })
  return res.success
}

type LoginMeSuccess = {
  success: {
    userKey: number
    scope: string
    agreedTerms: string[]
    name?: string | null
    phone?: string | null
    birthday?: string | null
    ci?: string | null
    di?: string | null
    gender?: string | null
    nationality?: string | null
    email?: string | null
  }
}

export async function loginMe(accessToken: string) {
  const res = await tossRequest<LoginMeSuccess>('GET', '/api-partner/v1/apps-in-toss/user/oauth2/login-me', {
    bearer: accessToken,
  })
  return res.success
}

// login-me의 이름/전화/생일 등 동의 필드는 AES-256-GCM으로 암호화되어 내려와요.
// 앞 12바이트가 IV, 마지막 16바이트가 인증 태그, 그 사이가 암호문이에요.
// AAD는 콘솔에서 복호화 키와 별도로 전달되는 값이라 TOSS_DECRYPT_AAD로 채워야 해요.
// ⚠️ 아직 실제 데이터로 검증 못 했어요 — 실 계정으로 첫 로그인 테스트할 때 형식이 맞는지 확인 필요.
export function decryptTossField(encrypted: string): string {
  const key = process.env.TOSS_DECRYPTION_KEY
  const aad = process.env.TOSS_DECRYPT_AAD
  if (!key || !aad) throw new Error('toss_decrypt_not_configured')
  const buf = Buffer.from(encrypted, 'base64')
  const IV_LENGTH = 12
  const TAG_LENGTH = 16
  const iv = buf.subarray(0, IV_LENGTH)
  const tag = buf.subarray(buf.length - TAG_LENGTH)
  const ciphertext = buf.subarray(IV_LENGTH, buf.length - TAG_LENGTH)
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(key, 'base64'), iv)
  decipher.setAAD(Buffer.from(aad))
  decipher.setAuthTag(tag)
  return decipher.update(ciphertext, undefined, 'utf8') + decipher.final('utf8')
}
