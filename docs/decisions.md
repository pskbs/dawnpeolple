# 결정 기록 (Decisions Log)

날짜순으로 주요 기술/기획 결정과 근거를 기록합니다. 요청서(`design concept/Claude outputs/02_ClaudeCode_요청서_v2.md`)와 공식 문서가 다를 때는 여기 기록하고 사용자에게 알립니다.

## 2026-09-21 — Phase 0: 앱인토스 공식 문서 조사 결과 반영

출처: `docs/apps-in-toss-notes.md` (앱인토스 개발자센터 조사)

1. **빌드 스택**: 요청서는 "정적 Vite 번들 업로드"를 가정했으나, 공식 예제는 `@apps-in-toss/web-framework` SDK + `@apps-in-toss/devtools`(`ait` CLI)를 필수로 사용함(`ait init`/`ait build`/`ait deploy`, `granite.config.ts` 설정 파일 필요). **Phase 2(앱인토스 연동)에서 반영 예정.** Phase 0/1(로컬 웹 개발)에는 영향 없음 — 플랫폼 어댑터 구조(`src/platform/`)로 격리되어 있어 웹 개발에는 지장 없음.
2. **mTLS ↔ Supabase Edge Function**: 앱인토스 공식 문서는 토스 로그인 서버 API에 mTLS 클라이언트 인증서가 필수라고 명시. Supabase Edge Function이 mTLS를 지원하지 않는다는 정보는 이번 조사로 확인/반증하지 못함(앱인토스 문서 범위 밖). **Phase 2에서 Vercel Node.js 서버리스 함수 mTLS PoC로 별도 검증 예정**(요청서 7-3 그대로 진행).
3. **탭바**: 토스 공식 플로팅 탭바만 허용, 커스텀 탭바 금지 — 요청서 가정과 일치. 그대로 진행.
4. **테마(라이트/다크)**: 검수 체크리스트에 "미니앱 테마는 라이트 모드로 구현" 항목이 명시적으로 존재. 요청서의 `hybrid`(제출용)/`night`(웹용) 2테마 전략과 방향이 일치함 — **앱인토스 제출본은 `hybrid` 고정, `night` 허용 여부는 검수팀에 별도 확인 필요**(요청서 10-3 그대로).
5. **⚠️ 벙개모임 서비스 분류 리스크 (신규, 요청서에 없던 리스크)**: 앱인토스 `intro/caution.md`는 "근처 사용자 탐색", "모르는 사람과의 연결 기능"이 있으면 "만남/소개팅 서비스"로 분류될 수 있다고 명시. "새벽사람들"의 부천 지역 기반 오프라인 벙개(낯선 사람과의 오프라인 매칭)가 이 기준에 해당될 가능성이 있음. 연애 목적이 아니라는 점만으로 자동 면제되는지는 문서로 확인 불가.
   - **영향**: 이 카테고리로 분류되면 실명 인증, 24시간 신고 대응 SLA, 반복 위반자 영구 정지 등 훨씬 무거운 요건이 추가됨.
   - **대응**: 사용자가 앱인토스 채널톡으로 서비스 컨셉("연애 목적 아님, 커뮤니티+모임")을 설명하고 카테고리 분류를 사전 확인하기로 함(12장 "제가 직접 해야 하는 일"에 추가 필요).
   - **코드 영향**: 지금 단계에서는 요청서의 신고·차단·개설 제한 설계(5-3)를 그대로 진행하되, 혹시 모를 강화 요건(실명인증 등)에 대비해 확장 가능한 구조로 설계.
6. **동의 항목(생일) 필수 여부**: 콘솔에서 "생일을 필수 동의로 설정 가능한지"는 문서로 확인 못함 — 콘솔 화면에서 직접 확인 필요(요청서 12장에 이미 사용자 할 일로 존재).
7. **TDS 패키지명**: WebView용 정확한 npm 패키지명을 문서에서 확정하지 못함(추정: `@toss/tds-mobile`). Phase 2 진입 시 재확인.

## 2026-09-21 — Phase 0: 초기 설정

- 저장소명: `dawnpeolple` (GitHub `pskbs` 계정, https://github.com/pskbs/dawnpeolple) — 최초 논의 시 `dawnpeople`로 제안했으나 실제 생성된 저장소명(및 로컬 프로젝트 폴더명)에 맞춰 `dawnpeolple`로 통일
- 패키지 매니저: pnpm (사용자 PC에 corepack 활성화가 관리자 권한 문제로 실패해 `npm install -g pnpm`으로 대체 설치)
- Vite 스캐폴드: `create-vite` 최신 버전이 기본적으로 ESLint 대신 **oxlint**를 사용함 — 요청서에 특정 린터 지정이 없어 그대로 채택. 문제 발생 시 ESLint로 교체 가능.
- `build:toss` 스크립트는 현재 `build:web`과 동일한 placeholder임. Phase 2에서 `ait build`/`ait deploy`를 반영해 교체 예정.

## 2026-09-21 — Supabase DB 접근 방식 확정

- Supabase Personal Access Token(`sbp_...`)을 받아 **Supabase Management API**(`https://api.supabase.com/v1/projects/{ref}/database/query`)로 마이그레이션을 직접 적용하는 방식으로 확정. anon/service role key는 DDL(테이블 생성 등)을 못 하지만, Management API는 Postgres에 직접 SQL을 실행할 수 있음.
- Supabase MCP 서버도 `claude mcp add`로 등록해둠(local scope, git에 안 올라감) — 다음 세션부터 도구로 사용 가능. 이번 세션은 Management API로 직접 처리.
- `0001_init.sql` 마이그레이션 적용 완료 확인: 테이블 18개, RLS 정책 43개, 함수 5개, `app_settings` 4행.
- **주의**: Personal Access Token은 Supabase 계정 전체에 대한 강력한 권한이라 각별히 조심. `.env`/커밋에 절대 포함하지 않음, 대화 기록에도 남기지 않도록 이후부터는 값 자체를 반복 출력하지 않기로 함.

## 2026-09-21 — 인증/온보딩/수다방 1차 구현, 단순화한 부분

- **이메일 자동 확인은 프로젝트 전체 설정으로 켜지 않음**(보안 완화이므로 harness가 자동 차단). 대신 자동화 테스트는 서비스 역할 키의 관리자 API(`auth.admin.createUser({ email_confirm: true })`)로 테스트 전용 유저를 만들어 우회. 실제 사용자 가입은 여전히 이메일 확인 절차를 거침.
- **profiles RLS가 본인/관리자만 조회 가능**해서(0001_init.sql) 수다방에서 다른 사람 닉네임이 안 보이는 문제 발견 → `profile_cards` 뷰(0003)로 닉네임·근무유형만 공개, 성별·출생연도는 여전히 비공개.
- **온보딩 지역 선택 단순화**: 시/도는 경기/서울/인천/기타 4개만 드롭다운, 시/군/구는 자유 텍스트 입력. 요청서 5-7의 "전국 행정구역 공공데이터 JSON"은 아직 미반영 — **TODO**.
- **로그인 방식은 이메일+비밀번호**로 구현(요청서는 매직링크 우선이었으나, 비밀번호 방식이 자동 테스트에 더 적합해 우선 채택. 매직링크 전환은 추후 검토).
- 테스트: `tests/e2e/feed-flow.spec.ts` (Playwright) — 회원가입→로그인→온보딩→수다방 글쓰기 전체 플로우 통과 확인. 스크린샷 `docs/screenshots/`.
- 다음으로 이어갈 것: 벙개모임 실동작(목록/개설/참석), 신고·차단 UI, 좋아요·댓글, AI 필터 연동, 전국 행정구역 데이터, 매직링크 전환 여부 결정.
