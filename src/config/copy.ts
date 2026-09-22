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

export const AUTH_ERROR_COPY = {
  emailRateLimit: '지금은 가입 메일을 보낼 수 없어요. 잠시 후 다시 시도해 주세요.',
  requestRateLimit: '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.',
  alreadyRegistered: '이미 가입된 이메일이에요. 로그인해 주세요.',
  invalidCredentials: '이메일 또는 비밀번호가 맞지 않아요.',
  emailNotConfirmed: '메일함에서 가입 확인을 먼저 완료해 주세요.',
  weakPassword: '비밀번호가 너무 쉬워요. 더 길고 복잡하게 만들어 주세요.',
  invalidEmail: '이메일 주소를 다시 확인해 주세요.',
  unknown: '문제가 발생했어요. 잠시 후 다시 시도해 주세요.',
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

export const FEED_COPY = {
  greetingGuest: '새벽에 깨어 있는 당신께',
  greeting: (nickname: string) => `${nickname}님, 오늘도 수고했어요`,
  storiesTitle: '다가오는 소모임',
  storiesCreate: '만들기',
  storiesAll: '전체보기',
  empty: '아직 글이 없어요. 첫 글을 남겨볼까요?',
  composeTitle: '새 글',
  composeCancel: '취소',
  composeSubmit: '게시',
  threadTitle: '스레드',
  repliesTitle: '답글',
  viewReplies: (n: number) => `답글 ${n}개`,
  replyPlaceholder: (nickname: string) => `${nickname}님에게 답글 남기기`,
  notFound: '글을 찾을 수 없어요.',
  submitError: '글을 올리지 못했어요',
  doubleTapHint: '두 번 톡 치면 좋아요',
} as const

export const SORT_COPY = {
  latest: '지금',
  popular: '인기',
} as const

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
  createTitle: '소모임 만들기',
  fabLabel: '소모임 만들기',
  seatsTitle: '참석 현황',
  seatsCount: (joined: number, capacity: number) => `${joined} / ${capacity}명`,
  chatTitle: '참석자 대화',
  chatEmpty: '첫 인사를 남겨보세요.',
  hostedBy: (nickname: string) => `${nickname}님이 열었어요`,
  notFound: '존재하지 않는 소모임이에요.',
  startsAtHint: '지금부터 1시간 이후로 정할 수 있어요.',
} as const

export const ME_COPY = {
  title: '내정보',
  statPosts: '게시글',
  statLikes: '받은 좋아요',
  statBungaes: '소모임',
  myPostsTitle: '내가 쓴 글',
  myPostsEmpty: '아직 쓴 글이 없어요.',
  infoTitle: '내 정보',
  workType: '근무 유형',
  region: '지역',
  logout: '로그아웃',
} as const

export const AUTH_EXTRA_COPY = {
  subtitle: '새벽에 일하는 사람들의 수다방',
  emailPlaceholder: '이메일 주소',
  passwordPlaceholder: '비밀번호 (6자 이상)',
} as const

export const FAB_COPY = {
  post: '새 글 쓰기',
} as const
