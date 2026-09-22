// 기능 스위치. 요청서와 다르게 추가된 기능은 여기서 끌 수 있게 해 두었어요(docs/decisions.md 2026-09-22).
// 앱인토스 검수에서 문제가 되면 false로 바꾸면 화면에서 진입점이 모두 사라져요.
export const FEATURES = {
  // 1:1 DM. 요청서 원안은 "DM 없음"이었지만 사용자 요청으로 추가했어요.
  dm: true,
  // 소모임 참석 전에도 성별·연령대 "집계"를 보여줘요(개인 식별 정보는 참석 후에만).
  preJoinDemographics: true,
  // 동영상 업로드. 저장·전송 비용 때문에 우선 끄고 사진·파일만 받아요(2026-09-22).
  // 다시 켜면 supabase storage 'media' 버킷 file_size_limit도 함께 올려야 해요.
  videoUpload: false,
  // 운영자 신고 관리 화면(/admin). profiles.role = 'admin'인 계정에만 보여요.
  admin: true,
} as const
