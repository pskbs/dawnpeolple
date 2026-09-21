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

function datetimeLocalIn(hours: number) {
  const d = new Date(Date.now() + hours * 60 * 60 * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
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

test('비회원 열람 → 로그인/온보딩 → 수다방(글쓰기·좋아요·답글) → 소모임 개설', async ({ page }) => {
  await page.goto('/')

  // 1) 비회원도 수다방을 볼 수 있어요. 글쓰기 입력창은 없고 로그인 유도 문구만 보여요.
  await expect(page).toHaveURL(/\/feed$/)
  await expect(page.locator('.feed-composer textarea')).toHaveCount(0)
  await expect(page.getByText('로그인하고 참여하기')).toBeVisible()
  await page.screenshot({ path: 'docs/screenshots/feed-guest.png', fullPage: true })

  // 2) 비회원도 소모임 목록을 볼 수 있어요.
  await page.getByRole('link', { name: '소모임', exact: true }).click()
  await expect(page.getByRole('heading', { name: '소모임', exact: true })).toBeVisible()
  await expect(page.locator('.loading-dots')).toHaveCount(0, { timeout: 10_000 })
  await page.screenshot({ path: 'docs/screenshots/bungae-list.png', fullPage: true })

  // 3) 내정보 탭 = 로그인 진입점
  await page.getByRole('link', { name: '내정보', exact: true }).click()
  await expect(page.getByLabel('이메일')).toBeVisible()
  await page.screenshot({ path: 'docs/screenshots/login.png', fullPage: true })

  await page.getByLabel('이메일').fill(TEST_EMAIL)
  await page.getByLabel('비밀번호').fill(TEST_PASSWORD)
  await page.getByRole('button', { name: '로그인' }).click()

  // 4) 온보딩 (닉네임/성별/연령대는 자동 생성 닉네임 + 기본값 사용, 출생연도만 입력)
  await expect(page.getByRole('heading', { name: '반가워요! 몇 가지만 알려주세요' })).toBeVisible({
    timeout: 10_000,
  })
  await page.getByLabel('출생연도').fill('1995')
  await page.getByLabel('서비스 이용약관에 동의해요').check()
  await page.getByLabel('개인정보 처리방침에 동의해요').check()
  await page.getByLabel('만 19세 이상이에요').check()
  await page.screenshot({ path: 'docs/screenshots/onboarding.png', fullPage: true })
  await page.getByRole('button', { name: '시작하기' }).click()

  // 온보딩 완료 → 내정보 화면(닉네임 표시)
  await expect(page.locator('.me-card h1')).toBeVisible({ timeout: 10_000 })

  // 5) 수다방: 컴포저 바 → 글쓰기 화면 → 게시 → 좋아요 → 스레드 상세에서 답글
  await page.getByRole('link', { name: '수다방', exact: true }).click()
  await page.locator('.feed-composer-trigger').click()
  await expect(page.locator('.feed-composer textarea')).toBeVisible({ timeout: 10_000 })

  const message = `E2E 테스트 글 ${Date.now()}`
  await page.locator('.feed-composer textarea').fill(message)
  await page.getByRole('button', { name: '게시', exact: true }).click()

  const feedList = page.getByTestId('feed-list')
  await expect(feedList).toBeVisible({ timeout: 10_000 })
  const post = feedList.getByTestId('feed-post').filter({ hasText: message })
  await expect(post).toBeVisible({ timeout: 10_000 })

  await post.getByRole('button', { name: /좋아요/ }).click()
  await expect(post.getByRole('button', { name: '좋아요 1' })).toBeVisible()
  await page.screenshot({ path: 'docs/screenshots/feed-with-post.png', fullPage: true })

  await post.getByRole('button', { name: /댓글/ }).click()
  await expect(page).toHaveURL(/\/feed\/\d+$/)
  const commentText = `댓글 테스트 ${Date.now()}`
  await page.locator('.feed-comment-form input').fill(commentText)
  await page.locator('.feed-comment-form button[type="submit"]').click()
  await expect(page.getByText(commentText)).toBeVisible({ timeout: 10_000 })
  await page.screenshot({ path: 'docs/screenshots/thread-detail.png', fullPage: true })

  // 내정보: 프로필 통계·내가 쓴 글
  await page.goto('/me')
  await expect(page.locator('.me-card h1')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(message)).toBeVisible({ timeout: 10_000 })
  await page.screenshot({ path: 'docs/screenshots/me.png', fullPage: true })

  // 6) 소모임 개설(탭바 + 버튼) → 상세 화면(리더 배지, 참석 취소 버튼) 확인
  await page.getByRole('link', { name: '소모임', exact: true }).click()
  await page.locator('.tab-fab').click()

  const bungaeTitle = `E2E 소모임 ${Date.now()}`
  await page.getByLabel('제목').fill(bungaeTitle)
  await page.getByLabel('소개').fill('테스트로 만든 소모임이에요')
  await page.locator('input[type="datetime-local"]').fill(datetimeLocalIn(3))
  await page.getByLabel('정원 (리더 포함 2~10명)').fill('4')
  await page.screenshot({ path: 'docs/screenshots/bungae-create.png', fullPage: true })
  await page.getByRole('button', { name: '만들기', exact: true }).click()

  await expect(page.getByRole('heading', { name: bungaeTitle })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('리더', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '참석 취소' })).toBeVisible()

  await page.screenshot({ path: 'docs/screenshots/bungae-detail.png', fullPage: true })
})