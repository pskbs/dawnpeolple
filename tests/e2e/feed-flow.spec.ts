import { createClient } from '@supabase/supabase-js'
import { expect, test, type Page } from '@playwright/test'
import { loadEnv } from './helpers/env'

loadEnv()

const STAMP = Date.now()
const TEST_EMAIL = `e2e-${STAMP}@example.com`
const TEST_PASSWORD = 'test-password-123'
const FRIEND_EMAIL = `e2e-friend-${STAMP}@example.com`
const FRIEND_NICKNAME = `친구${String(STAMP).slice(-6)}`

// 1x1 PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)
const image = (name: string) => ({ name, mimeType: 'image/png', buffer: PNG })

function adminClient() {
  return createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

let testUserId: string | undefined
let friendId: string | undefined

async function purgeUser(userId: string) {
  const admin = adminClient()
  // 탈퇴 테스트에서 이미 지워졌을 수도 있어요. 남은 데이터만 정리해요.
  await admin.from('comments').delete().eq('author_id', userId)
  await admin.from('posts').delete().eq('author_id', userId)
  await admin.from('bungae_comments').delete().eq('author_id', userId)
  await admin.from('bungaes').delete().eq('host_id', userId)
  await admin.from('conversations').delete().or(`user_a.eq.${userId},user_b.eq.${userId}`)
  const { data: files } = await admin.storage.from('media').list(userId)
  if (files?.length) await admin.storage.from('media').remove(files.map((f) => `${userId}/${f.name}`))
  await admin.auth.admin.deleteUser(userId).catch(() => {})
}

test.beforeAll(async () => {
  // 이메일 확인 절차는 건너뛰기 위해 관리자 API로 확인된 테스트 유저를 만들어요.
  const admin = adminClient()
  const { data, error } = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
  })
  if (error) throw error
  testUserId = data.user?.id

  // 팔로우·DM 상대: 온보딩까지 마친 상태로 바로 만들어요.
  const friend = await admin.auth.admin.createUser({ email: FRIEND_EMAIL, password: TEST_PASSWORD, email_confirm: true })
  if (friend.error) throw friend.error
  friendId = friend.data.user?.id
  const { error: profileError } = await admin.from('profiles').insert({
    id: friendId,
    nickname: FRIEND_NICKNAME,
    gender: 'male',
    birth_year: 1990,
    sido: '경기',
    sigungu: '부천시',
    bio: 'E2E 친구 계정이에요',
  })
  if (profileError) throw profileError
})

test.afterAll(async () => {
  if (testUserId) await purgeUser(testUserId)
  if (friendId) await purgeUser(friendId)
})

async function openMore(scope: ReturnType<Page['locator']>) {
  await scope.getByRole('button', { name: '더보기' }).first().click()
}

test('비회원 열람 → 가입/온보딩(약관 팝업·사진) → 수다방(첨부·대댓글·수정·삭제) → 프로필 → 팔로우·DM·차단 → 소모임 → 탈퇴', async ({
  page,
}) => {
  test.setTimeout(180_000)
  await page.goto('/')

  // 1) 비회원 수다방: 상단 한 줄 소개, 인사·컨셉 문구·컴포저·다가오는 소모임·정렬 탭 없음
  await expect(page).toHaveURL(/\/feed$/)
  await expect(page.getByText('새벽에 일하는 우리끼리의 공간')).toBeVisible()
  await expect(page.getByText('낮에만 모임 있나요?')).toHaveCount(0)
  await expect(page.getByText('오늘 퇴근길은 어땠어요?')).toHaveCount(0)
  await expect(page.getByText('다가오는 소모임')).toHaveCount(0)
  await expect(page.getByRole('tab', { name: '인기' })).toHaveCount(0)
  await expect(page.getByText('로그인하고 참여하기')).toBeVisible()
  await page.screenshot({ path: 'docs/screenshots/feed-guest.png', fullPage: true })

  // 2) 소모임 탭에 "다가오는 소모임"이 있어요.
  await page.getByRole('link', { name: '소모임', exact: true }).click()
  await expect(page.getByRole('heading', { name: '다가오는 소모임' })).toBeVisible()
  await expect(page.locator('.loading-dots')).toHaveCount(0, { timeout: 10_000 })
  // 오른쪽 위에는 메시지 아이콘 대신 지역 배지(비회원은 "활동지역 설정")
  await expect(page.locator('.app-bar .bungae-region-badge')).toHaveText('활동지역 설정')
  await expect(page.locator('.app-bar a[href="/dm"]')).toHaveCount(0)
  await page.screenshot({ path: 'docs/screenshots/bungae-list.png', fullPage: true })

  // 3) 내정보 = 로그인 진입점. 가입 유도 카드·비밀번호 찾기
  await page.getByRole('link', { name: '내정보', exact: true }).click()
  await expect(page.getByText('처음 오셨나요?')).toBeVisible()
  await expect(page.locator('.auth-signup-cta').getByRole('button', { name: '가입하기' })).toBeVisible()
  await page.getByRole('button', { name: '비밀번호를 잊으셨나요?' }).click()
  await expect(page.getByText('아이디는 가입할 때 쓴 이메일 주소예요.')).toBeVisible()
  await page.screenshot({ path: 'docs/screenshots/reset-password.png' })
  await page.keyboard.press('Escape')
  await page.screenshot({ path: 'docs/screenshots/login.png', fullPage: true })
  // 로컬 API 라우팅 확인(잘못된 이메일은 메일 발송 없이 400)
  const resetRes = await page.request.post('/api/auth/reset-password', { data: { email: 'not-an-email' } })
  expect(resetRes.status()).toBe(400)
  await page.getByLabel('이메일').fill(TEST_EMAIL)
  await page.getByLabel('비밀번호').fill(TEST_PASSWORD)
  await page.getByRole('button', { name: '로그인' }).click()

  // 4) 온보딩: 사진·한줄소개, 약관 ">" 팝업, 전체 동의
  await expect(page.getByRole('heading', { name: '반가워요! 몇 가지만 알려주세요' })).toBeVisible({ timeout: 10_000 })
  await page.locator('.onboarding-photo input[type="file"]').setInputFiles(image('me.png'))
  await expect(page.locator('.onboarding-photo img.avatar--photo')).toBeVisible()
  await page.getByLabel('한줄소개 (선택)').fill('새벽 4시에 퇴근해요')
  await page.getByLabel('출생연도').fill('1995')

  await page.getByRole('button', { name: '서비스 이용약관 보기' }).click()
  await expect(page.getByRole('dialog', { name: '서비스 이용약관' })).toBeVisible()
  await expect(page.getByText('제1조 (목적)')).toBeVisible()
  await page.screenshot({ path: 'docs/screenshots/terms-modal.png' })
  await page.getByRole('dialog').getByRole('button', { name: '닫기' }).click()
  await page.getByRole('button', { name: '개인정보 처리방침 보기' }).click()
  await expect(page.getByText('제2조 (처리하는 개인정보 항목)')).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: '닫기' }).click()

  await page.getByLabel('모두 동의해요').check()
  await expect(page.getByLabel('[필수] 서비스 이용약관에 동의해요')).toBeChecked()
  await page.screenshot({ path: 'docs/screenshots/onboarding.png', fullPage: true })
  await page.getByRole('button', { name: '시작하기' }).click()

  // 온보딩 완료 → 내 프로필(스레드식)
  await expect(page.locator('.profile-head__nickname')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('새벽 4시에 퇴근해요')).toBeVisible()
  await expect(page.locator('.profile-head img.avatar--photo')).toBeVisible()
  await expect(page.getByText('프로필 완성하기')).toBeVisible()
  const myNickname = (await page.locator('.profile-head__nickname').textContent())!.trim()

  // 5) 글쓰기: + 버튼 → 사진 2장 + 500자 넘는 글(글자수 제한 없음)
  await page.locator('.tab-fab').click()
  const composer = page.getByLabel('새벽에 우리끼리 공유해요')
  await expect(composer).toBeVisible()
  const marker = `E2E 긴 글 ${STAMP}`
  const longText = `${marker}\n${'새벽 근무 이야기 '.repeat(60)}끝`
  await composer.fill(longText)
  await page.getByTestId('compose-media-input').setInputFiles([image('a.png'), image('b.png')])
  await expect(page.locator('.attach-tray__item')).toHaveCount(2)
  await page.screenshot({ path: 'docs/screenshots/compose.png', fullPage: true })
  await page.getByRole('button', { name: '게시', exact: true }).click()

  const post = page.getByTestId('feed-post').filter({ hasText: marker }).first()
  await expect(post).toBeVisible({ timeout: 15_000 })
  await expect(post.locator('.media-strip img')).toHaveCount(2)
  await expect(post.getByRole('button', { name: '더 보기' })).toBeVisible()
  await post.getByRole('button', { name: '좋아요 0' }).click()
  await expect(post.getByRole('button', { name: '좋아요 1' })).toBeVisible()
  await page.screenshot({ path: 'docs/screenshots/feed-with-post.png', fullPage: true })

  // 6) 스레드 상세: 답글 → 대댓글 → 수정 → 대댓글 삭제
  await post.getByRole('button', { name: /댓글/ }).click()
  await expect(page).toHaveURL(/\/feed\/\d+$/)
  const input = page.getByLabel('답글을 남겨보세요')
  const rootText = `첫 답글 ${STAMP}`
  await input.fill(rootText)
  await page.getByRole('button', { name: '등록' }).click()
  const root = page.getByTestId('comment').filter({ hasText: rootText }).first()
  await expect(root).toBeVisible({ timeout: 10_000 })

  await root.getByRole('button', { name: '답글 달기' }).click()
  await expect(page.getByText(`${myNickname}님에게 답글 남기는 중`)).toBeVisible()
  const replyText = `대댓글 ${STAMP}`
  await input.fill(replyText)
  await page.locator('.comment-composer input[type="file"]').setInputFiles(image('c.png'))
  await page.getByRole('button', { name: '등록' }).click()
  const reply = page.locator('.comment--reply').filter({ hasText: replyText })
  await expect(reply).toBeVisible({ timeout: 10_000 })
  await expect(reply.locator('.media img')).toHaveCount(1)

  await openMore(root)
  await page.getByRole('button', { name: '수정하기' }).click()
  await page.locator('.comment-edit textarea').fill(`${rootText} (수정)`)
  await page.getByRole('button', { name: '저장' }).click()
  await expect(page.getByText(`${rootText} (수정)`)).toBeVisible()
  await expect(root.getByText(/수정됨/)).toBeVisible()
  await page.screenshot({ path: 'docs/screenshots/thread-detail.png', fullPage: true })

  await openMore(reply)
  await page.getByRole('button', { name: '삭제하기' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '삭제하기' }).click()
  await expect(reply).toHaveCount(0)

  // 7) 프로필 편집 → 소개 변경
  await page.goto('/me')
  await page.getByRole('link', { name: '프로필 편집' }).click()
  await page.getByLabel('한줄소개').fill('프로필 편집 테스트예요')
  await page.getByRole('button', { name: '완료' }).click()
  await expect(page.getByText('프로필 편집 테스트예요')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('feed-post').filter({ hasText: marker })).toBeVisible()
  await page.screenshot({ path: 'docs/screenshots/me.png', fullPage: true })

  // 8) 설정(작은 버튼): 약관·로그아웃·회원탈퇴
  await page.getByRole('link', { name: '설정' }).click()
  await expect(page.getByRole('button', { name: '로그아웃' })).toBeVisible()
  await expect(page.getByRole('button', { name: '회원탈퇴' })).toBeVisible()
  await page.screenshot({ path: 'docs/screenshots/settings.png', fullPage: true })
  await page.getByRole('link', { name: '서비스 이용약관' }).click()
  await expect(page.getByText('제13조 (소모임 안전 안내와 회사의 지위)')).toBeVisible()
  await expect(page.getByText('사업자등록번호')).toHaveCount(0)
  await expect(page.getByText(/wol100st2@gmail\.com/).first()).toBeVisible()

  // 8-1) 비밀번호 변경(메일로 받은 임시 비밀번호를 바꾸는 곳)
  await page.goto('/me/settings')
  await page.getByRole('link', { name: '비밀번호 변경' }).click()
  await page.getByLabel('지금 비밀번호').fill(TEST_PASSWORD)
  await page.getByLabel('새 비밀번호 (6자 이상)').fill(`${TEST_PASSWORD}-new`)
  await page.getByLabel('새 비밀번호 확인').fill(`${TEST_PASSWORD}-new`)
  await page.getByRole('button', { name: '변경하기' }).click()
  await expect(page.getByText('비밀번호를 바꿨어요.')).toBeVisible({ timeout: 10_000 })
  await expect(page).toHaveURL(/\/me\/settings$/)

  // 9) 다른 사람 프로필 → 팔로우 → 메시지 → 차단/해제
  await page.goto(`/u/${friendId}`)
  await expect(page.getByRole('heading', { name: FRIEND_NICKNAME })).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: '팔로우', exact: true }).click()
  await expect(page.getByRole('button', { name: '팔로잉', exact: true })).toBeVisible()
  await expect(page.getByText('팔로워 1명')).toBeVisible()
  await page.screenshot({ path: 'docs/screenshots/profile-other.png', fullPage: true })

  await page.getByRole('button', { name: '메시지 보내기' }).click()
  await expect(page).toHaveURL(/\/dm\/\d+$/)
  const dmText = `안녕하세요 ${STAMP}`
  await page.getByLabel('메시지 보내기…').fill(dmText)
  await page.getByRole('button', { name: '보내기' }).click()
  await expect(page.locator('.chat-row--mine').filter({ hasText: dmText })).toBeVisible({ timeout: 10_000 })
  await page.screenshot({ path: 'docs/screenshots/dm-chat.png', fullPage: true })
  // 뒤로가기: 메시지를 보낸 뒤 뒤로 → 처음 왔던 프로필
  await page.getByRole('button', { name: '뒤로' }).click()
  await expect(page).toHaveURL(new RegExp(`/u/${friendId}$`))

  // 메시지함 → 채팅방 → 뒤로(메시지함) → 뒤로(프로필). 채팅방으로 다시 가면 안 돼요.
  // 설정 화면의 메시지 아이콘으로 메시지함에 들어가요.
  await page.goto('/me')
  await page.locator('.app-bar a[href="/dm"]').click()
  await expect(page.getByText(`나: ${dmText}`)).toBeVisible({ timeout: 10_000 })
  await page.getByText(`나: ${dmText}`).click()
  await expect(page).toHaveURL(/\/dm\/\d+$/)
  await page.getByRole('button', { name: '뒤로' }).click()
  await expect(page).toHaveURL(/\/dm$/)
  await page.getByRole('button', { name: '뒤로' }).click()
  await expect(page).toHaveURL(/\/me$/)

  // 신고 "직접 입력" → reports.detail에 저장
  await page.goto(`/u/${friendId}`)
  await expect(page.getByRole('heading', { name: FRIEND_NICKNAME })).toBeVisible({ timeout: 10_000 })
  const customReason = `직접 입력 신고 ${STAMP}`
  await openMore(page.locator('.app-bar'))
  await page.getByRole('button', { name: '신고하기' }).click()
  await page.getByRole('button', { name: '직접 입력' }).click()
  await page.getByLabel('신고 사유를 적어주세요').fill(customReason)
  await page.getByRole('dialog').getByRole('button', { name: '신고하기' }).click()
  await expect(page.getByText('신고가 접수됐어요.', { exact: false })).toBeVisible()
  const { data: reportRows } = await adminClient().from('reports').select('reason, detail').eq('reporter_id', testUserId!)
  expect(reportRows).toContainEqual({ reason: '직접 입력', detail: customReason })

  // 어드민: role=admin 계정만 신고 관리 화면을 볼 수 있어요.
  await adminClient().from('profiles').update({ role: 'admin' }).eq('id', testUserId!)
  await page.reload()
  await page.goto('/admin')
  const adminCard = page.locator('.admin-card').filter({ hasText: customReason })
  await expect(adminCard).toBeVisible({ timeout: 10_000 })
  await expect(adminCard).toContainText(FRIEND_NICKNAME)
  await page.screenshot({ path: 'docs/screenshots/admin-reports.png', fullPage: true })
  await adminCard.getByRole('button', { name: '기각' }).click()
  await expect(adminCard).toHaveCount(0)
  await adminClient().from('profiles').update({ role: 'member' }).eq('id', testUserId!)

  // 상대방이 나를 차단했을 때: 팔로우·메시지 시도 시 안내
  await adminClient().from('blocks').insert({ blocker_id: friendId, blocked_id: testUserId })
  await page.goto(`/u/${friendId}`)
  await expect(page.getByRole('heading', { name: FRIEND_NICKNAME })).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: '팔로우', exact: true }).click()
  await expect(page.getByText('상대방이 차단했어요').first()).toBeVisible()
  await page.getByRole('button', { name: '메시지 보내기' }).click()
  await expect(page.getByText('상대방이 차단했어요').first()).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/u/${friendId}$`))
  await adminClient().from('blocks').delete().eq('blocker_id', friendId!).eq('blocked_id', testUserId!)

  await page.goto(`/u/${friendId}`)
  await openMore(page.locator('.app-bar'))
  await page.getByRole('button', { name: '차단하기' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '차단하기' }).click()
  await expect(page.getByText('차단한 사용자예요.', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: '차단 해제' }).click()
  await expect(page.getByRole('button', { name: '팔로우', exact: true })).toBeVisible()

  // 10) 소모임 만들기: 기본 시각은 새벽 6시
  await page.goto('/bungae/new')
  await expect(page.locator('input[type="datetime-local"]')).toHaveValue(/T06:00$/)
  const bungaeTitle = `E2E 소모임 ${String(STAMP).slice(-5)}`
  await page.getByLabel('제목').fill(bungaeTitle)
  await page.getByLabel('소개').fill('테스트로 만든 소모임이에요')
  await page.getByLabel('동/읍/면').fill('중동')
  await page.screenshot({ path: 'docs/screenshots/bungae-create.png', fullPage: true })
  await page.getByRole('button', { name: '만들기', exact: true }).click()

  await expect(page.getByRole('heading', { name: bungaeTitle })).toBeVisible({ timeout: 10_000 })
  const demographics = page.getByTestId('bungae-demographics')
  await expect(demographics).toContainText('여성(30대)')
  await expect(page.locator('.participant__meta').first()).toHaveText(/^여성\(30대/)
  await expect(page.locator('.participant').filter({ hasText: myNickname })).toBeVisible()
  const chatText = `참석자 대화 ${STAMP}`
  await page.getByLabel('답글을 남겨보세요').fill(chatText)
  await page.getByRole('button', { name: '등록' }).click()
  await expect(page.getByTestId('comment').filter({ hasText: chatText })).toBeVisible({ timeout: 10_000 })
  await page.screenshot({ path: 'docs/screenshots/bungae-detail.png', fullPage: true })

  // 11) 회원탈퇴: 계정·글·사진이 모두 삭제돼요.
  await page.goto('/me/settings')
  await page.getByRole('button', { name: '회원탈퇴' }).click()
  await page.getByLabel('안내를 모두 확인했어요').check()
  await page.getByRole('button', { name: '탈퇴하기' }).click()
  await expect(page).toHaveURL(/\/feed$/, { timeout: 20_000 })

  const admin = adminClient()
  const { data: gone } = await admin.auth.admin.getUserById(testUserId!)
  expect(gone.user).toBeNull()
  const { count: leftPosts } = await admin.from('posts').select('id', { count: 'exact', head: true }).eq('author_id', testUserId!)
  expect(leftPosts).toBe(0)
  const { data: leftFiles } = await admin.storage.from('media').list(testUserId!)
  expect(leftFiles ?? []).toHaveLength(0)
})
