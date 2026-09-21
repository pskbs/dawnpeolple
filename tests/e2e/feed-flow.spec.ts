import { createClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'
import { loadEnv } from './helpers/env'

loadEnv()

const TEST_EMAIL = `e2e-${Date.now()}@example.com`
const TEST_PASSWORD = 'test-password-123'

function adminClient() {
  return createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

let testUserId: string | undefined

test.beforeAll(async () => {
  // 이메일 확인 절차는 자동화 테스트에서 건너뛰기 위해, 서비스 역할 키의 관리자 API로
  // 미리 확인된(email_confirm: true) 테스트 유저를 만들어요. 프로젝트 전체의 이메일 확인 설정은 바꾸지 않아요.
  const admin = adminClient()
  const { data, error } = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
  })
  if (error) throw error
  testUserId = data.user?.id
})

test.afterAll(async () => {
  if (testUserId) {
    const admin = adminClient()
    await admin.auth.admin.deleteUser(testUserId)
  }
})

test('회원가입 로그인 → 온보딩 → 수다방 글쓰기', async ({ page }) => {
  await page.goto('/')

  // 로그인
  await page.getByLabel('이메일').fill(TEST_EMAIL)
  await page.getByLabel('비밀번호').fill(TEST_PASSWORD)
  await page.getByRole('button', { name: '로그인' }).click()

  // 온보딩 화면 대기 (자동 생성된 닉네임이 이미 채워져 있음)
  await expect(page.getByRole('heading', { name: '반가워요! 몇 가지만 알려주세요' })).toBeVisible({
    timeout: 10_000,
  })

  await page.screenshot({ path: 'docs/screenshots/onboarding.png', fullPage: true })

  await page.getByLabel('출생연도').fill('1995')
  await page.getByLabel('서비스 이용약관에 동의해요').check()
  await page.getByLabel('개인정보 처리방침에 동의해요').check()
  await page.getByLabel('만 19세 이상이에요').check()

  await page.getByRole('button', { name: '시작하기' }).click()

  // 수다방(피드) 화면 도달 확인 (글쓰기 입력창이 보이면 온보딩을 통과해 피드에 온 것)
  await expect(page.locator('.feed-composer textarea')).toBeVisible({ timeout: 10_000 })

  const message = `E2E 테스트 글 ${Date.now()}`
  await page.locator('.feed-composer textarea').fill(message)
  await page.getByRole('button', { name: '등록' }).click()

  const feedList = page.getByTestId('feed-list')
  await expect(feedList).toBeVisible({ timeout: 10_000 })
  await expect(feedList.getByText(message)).toBeVisible({ timeout: 10_000 })

  await page.screenshot({ path: 'docs/screenshots/feed-with-post.png', fullPage: true })
})
