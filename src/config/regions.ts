// 지역명을 코드에 직접 쓰지 마세요. 이 파일의 값만 참조하세요.
import { REGION_LABEL } from './brand'

// 벙개 개설이 열려 있는 지역 코드. 여기 추가되면 개설 화면에서 선택형으로 전환돼요(요청서 5-3).
export const OPEN_REGIONS = ['bucheon'] as const
export type OpenRegionCode = (typeof OPEN_REGIONS)[number]

export const REGION_CODE_LABELS: Record<OpenRegionCode, string> = {
  bucheon: REGION_LABEL,
}

// 벙개 개설 화면의 "탭 한 번으로 채우는 칩" (요청서 5-3)
export const BUCHEON_PLACE_CHIPS = ['부천역', '상동역', '중동역', '송내역', '역곡역', '소사역'] as const
