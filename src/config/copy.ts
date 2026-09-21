// 모든 화면 문구는 이 파일에서만 관리하세요. 컴포넌트에 문구를 직접 쓰지 마세요.
// 화면별 문구 목록은 docs/copy-list.md에서 함께 관리합니다.

export const TAB_LABELS = {
  feed: '수다방',
  bungae: '벙개모임',
  me: '내정보',
} as const

// 5-0. 컨셉 문구 후보 (1안 기본)
export const CONCEPT_COPY = {
  primary: '낮에만 모임 있나요? 새벽에 일하는 우리도 있어요!',
  tagline: '새벽에도 우리가 있어요',
  bungaeIntro: '퇴근이 새벽인 사람들, 여기 모여요',
} as const

export const REGION_NOTICE = '지금은 부천 지역 위주로 진행돼요. 곧 다른 지역도 열릴 거예요.'
export const FEED_NATIONWIDE_NOTICE = '수다방은 어디서나 이용할 수 있어요.'

export const AUTH_COPY = {
  loginTitle: '다시 만나서 반가워요',
  signupTitle: '새벽사람들에 오신 걸 환영해요',
  emailLabel: '이메일',
  passwordLabel: '비밀번호',
  loginSubmit: '로그인',
  signupSubmit: '가입하기',
  switchToSignup: '아직 계정이 없으신가요? 가입하기',
  switchToLogin: '이미 계정이 있으신가요? 로그인',
  signupSuccess: '가입 확인 메일을 보냈어요. 메일함을 확인해 주세요.',
} as const

export const ONBOARDING_COPY = {
  title: '반가워요! 몇 가지만 알려주세요',
  nicknameLabel: '닉네임',
  reroll: '다시 뽑기',
  genderLabel: '성별',
  birthYearLabel: '출생연도',
  under19Notice: '만 19세 이상만 가입할 수 있어요.',
  sidoLabel: '시/도',
  sigunguLabel: '시/군/구',
  workTypeLabel: '근무 유형 (선택)',
  offTimeBandLabel: '퇴근 시간대 (선택)',
  agreeTerms: '서비스 이용약관에 동의해요',
  agreePrivacy: '개인정보 처리방침에 동의해요',
  agree19: '만 19세 이상이에요',
  submit: '시작하기',
} as const

export const FEED_COMPOSER_PLACEHOLDER = '오늘 퇴근길은 어땠어요?'
