// 모든 화면 문구는 이 파일에서만 관리하세요. 컴포넌트에 문구를 직접 쓰지 마세요.
// 화면별 문구 목록은 docs/copy-list.md에서 함께 관리합니다.

// 표시 라벨은 "소모임"이에요. 내부 코드/테이블/라우트 명칭(bungae)은 그대로 유지해요(docs/decisions.md 참고).
export const TAB_LABELS = {
  feed: '수다방',
  bungae: '소모임',
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

export const GUEST_COPY = {
  browseNotice: '둘러보는 중이에요. 글쓰기·좋아요·소모임 참여는 로그인 후 이용할 수 있어요.',
  ctaLogin: '로그인하고 참여하기',
  meLoggedOut: '로그인하고 내 정보를 확인해보세요',
} as const

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

export const COMMENT_COPY = {
  toggleShow: '댓글 보기',
  toggleHide: '댓글 접기',
  placeholder: '댓글을 남겨보세요',
  submit: '등록',
  empty: '아직 댓글이 없어요.',
} as const

export const BUNGAE_COPY = {
  listTitle: '소모임',
  createButton: '+ 소모임 만들기',
  empty: '아직 열린 소모임이 없어요. 첫 소모임을 만들어볼까요?',
  titleLabel: '제목',
  bodyLabel: '소개',
  startsAtLabel: '모이는 시각',
  placeHintLabel: '만나는 장소 (선택, 역·동 단위)',
  capacityLabel: '정원 (리더 포함 2~10명)',
  submit: '만들기',
  remainingSlots: (n: number) => (n > 0 ? `${n}자리 남았어요` : '정원이 가득 찼어요'),
  joinButton: '참석 신청',
  leaveButton: '참석 취소',
  hostBadge: '리더',
  participantsRestricted: '참석하면 참석자 명단과 대화를 볼 수 있어요.',
  backToList: '목록으로',
} as const
