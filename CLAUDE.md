# CLAUDE.md — 새벽사람들 in 부천

> 서비스명 `BRAND_NAME="새벽사람들"`, 지역 표기 `REGION_LABEL="부천"`. 코드에 하드코딩 금지(`src/config/brand.ts`, `regions.ts`).

## 무엇을 만드는가
- 저녁 출근·새벽 퇴근하는 야간근무자(만 19세 이상)를 위한 **커뮤니티 + 오프라인 벙개 모임** 서비스.
- 핵심 메시지: "낮에만 모임 있나요? 새벽에 일하는 우리도 있어요!" (문구는 전부 `src/config/copy.ts`, 목록은 `docs/copy-list.md`)
- 메뉴 3개: **벙개모임 / 수다방 / 내정보**. 회원 유형은 1가지(운영자는 role 플래그).
- 수다방: **카테고리 없는 스레드(Threads)형 SNS 피드**. 글 500자, 댓글(1단계 답글), 좋아요, 정렬 토글(지금/인기).
- 벙개모임: **누구나 개설**(신고·차단·개설 한도 필수). 개설 지역은 **부천 고정 바인딩**, 상세 위치는 선택(역·동 단위, 가게명까지 유도 안 함).
- 수익: 앱인토스 인앱 광고. 배포: 앱인토스 → 웹(Vercel) → (추후) 스토어 앱.
- 오프라인 시작 지역: 부천. **`OPEN_REGIONS` 설정값으로 관리.** 수다방은 전국 오픈. 부천 위주라는 안내를 곳곳에 표시.

## 절대 규칙 (비협상)
1. 앱인토스 **검수 기준**을 항상 우선: TDS(Navigation·플로팅 탭바), 해요체, 토스 로그인만(앱인토스 안), 광고 규칙, **라이트 모드만(다크모드 금지)**.
2. **테마 2종**: `hybrid`(앱인토스 제출 기본, 콘텐츠 면은 밝게 + 히어로에 밤하늘) / `night`(웹 기본, 전면 딥네이비). `VITE_THEME`로 전환, 색은 CSS 토큰만 사용, OS 다크모드 무시.
3. **소개팅·만남으로 보이지 않게**: 앱 문구에 소개팅/연애/짝/썸/이성/매칭 금지, 성별·연령 기반 매칭·필터 금지. 성별·연령대는 벙개 참석 현황 안내로만 사용.
4. **개인정보 최소 수집**: 실명·전화번호·이메일 원문·토스 CI 저장 금지. 닉네임 익명. 탈퇴/토스 연결 해제 시 데이터 삭제.
5. **비밀값 커밋 금지**: `.env*`, service role 키, mTLS 인증서/개인키, 복호화 키, Anthropic 키. `.env.example`만 커밋.
6. **Supabase service role 키는 서버(`api/`)에서만**. 모든 테이블 RLS 켜기.
7. 벙개 참석자 목록·댓글은 **참석자+리더+관리자만** 조회. 미참석자에게는 "남은 자리" 집계만.
8. 앱인토스 전용 코드는 `src/platform/toss/`에만. 나머지는 `src/platform/index.ts` 어댑터 경유.
9. 문서와 요청서가 다르면 **공식 문서가 우선**, 다르면 사용자에게 알리고 `docs/decisions.md`에 기록.

## 스택
Vite + React + TypeScript(SPA) · TDS · React Router · Supabase(Postgres/RLS/Auth) · Vercel(웹 + `api/` 서버리스) · Vitest + Playwright · Anthropic(배포) / `claude -p`(로컬)

## 명령어 (사용자 PC는 Windows, PowerShell 기준)
- `pnpm dev` / `pnpm build:web` / `pnpm build:toss` / `pnpm test` / `pnpm lint` / `pnpm typecheck`
- `VITE_PLATFORM=web|toss`, `VITE_THEME=night|hybrid`, `AI_PROVIDER=mock|claude-cli|anthropic`(`claude-cli`는 production 차단)

## 주요 결정
- 로그인: 1단계 Supabase Auth(웹), 2단계 토스 로그인. 토스 로그인은 **mTLS 필요** → Supabase Edge Function 불가 → `api/`(Vercel Node) PoC 후 구현, 안 되면 소형 서버(비용 발생 시 사용자 확인).
- 벙개: 누구나 개설(`bungae_create_role=all`), 하루 2건·동시 3건 한도, 신고 3건 누적 시 자동 비노출. 소통은 참석자 전용 댓글만(DM 없음). 리더 포함 최대 인원 2~10명.
- 참석자 표시: 닉네임 + 성별 + **연령대**(참석 신청 후에만). 미참석자는 "N자리 남았어요"만.
- 닉네임: 야간 테마 자동 생성(`nickname-words.ts`), 변경 가능(7일 1회).
- 광고: 글 작성 완료·벙개 개설 완료 시 전면형(빈도 제한, 실패해도 진행), 글·벙개 상세 하단 배너. 피드 목록 사이 광고 없음. 리워드 제외.
- AI: 비속어·불법·선정 1차 필터 + 위기 문구 감지(작성자에게만 안내). 규칙 필터 → AI 순. 텍스트만 전송.
- 디자인: 딥네이비 밤하늘 + 달·별 + 입체적·귀여운 캐릭터("새벽이들"). 참고: `C:\Users\PC\Desktop\claude code\2.dawnpeolple\design concept\`(→ `docs/design-reference/`로 복사). 참고 이미지의 캐릭터·구도는 복제 금지. 별 애니메이션·파티클 금지.
- 약관: 월백컴퍼니 / 책임자 김봉수 / psbongsoo@gmail.com. 초안은 출시 전 법률 검토 필요.

## Git
- GitHub `pskbs`, 서비스당 저장소 1개(저장소명 `dawnpeople`). 작업 단위마다 **자동 커밋·푸시**(Conventional Commits). `main` 기본, 큰 변경은 `feat/*`.
- 파괴적 명령(`push --force`, `reset --hard`, DB drop/truncate) 금지 — 필요하면 먼저 확인.

## 먼저 물어볼 것
유료 리소스 생성, 운영 DB 변경, 실서비스 배포, 외부 계정 설정, 새 API 키 필요 작업.

## 진행 방식
- Phase 0 조사·셋업 → 1 웹 MVP(로컬 테스트) → 2 앱인토스 연동 → 3 검수 대비 → 4 웹 배포·사전신청 → 5 스토어 대비.
- 각 단계 끝: 3~5줄 요약 + 사용자가 해야 할 일 + 다음 단계.

## 문서 위치
`docs/apps-in-toss-notes.md` · `docs/decisions.md` · `docs/review-checklist.md` · `docs/copy-list.md` · `docs/design-notes.md` · `docs/terms-review-points.md` · `docs/design-reference/`
