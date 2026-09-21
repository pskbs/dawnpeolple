// 닉네임 자동 생성용 단어 목록 (요청서 5-2). "형용사 + 명사" 조합, 야간·새벽 감성.
// 비속어·은어·특정 인물·상표 금지. 새 단어 추가 시 banned_words 필터를 반드시 거쳐야 해요.

export const NICKNAME_ADJECTIVES = [
  '졸린',
  '느긋한',
  '배고픈',
  '따끈한',
  '든든한',
  '포근한',
  '말똥말똥한',
  '나른한',
  '씩씩한',
  '다정한',
  '조용한',
  '반짝이는',
] as const

export const NICKNAME_NOUNS = [
  '올빼미',
  '달토끼',
  '별똥별',
  '해장국',
  '가로등',
  '첫차',
  '야식',
  '부엉이',
  '고양이',
  '새벽공기',
  '커피',
  '달빛',
] as const

export const NICKNAME_MIN_LENGTH = 2
export const NICKNAME_MAX_LENGTH = 12
