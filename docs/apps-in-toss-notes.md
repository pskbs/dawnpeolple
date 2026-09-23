# 앱인토스(Apps in Toss) 개발자센터 조사 노트

조사일: 2026-09-21
조사 대상: "새벽사람들 in 부천" (야간근무자 커뮤니티 + 오프라인 벙개모임 앱)을 앱인토스 미니앱(WebView)으로 만들기 위한 사전 조사.
조사 방법: `developers-apps-in-toss.toss.im`의 `.md` 원문 페이지를 WebFetch로 조회. 페이지가 길어 일부는 소형 모델 요약을 거쳤으므로, 법적/보안 관련 핵심 문구는 가능한 한 원문 인용(따옴표) 형태로 남김. 완전한 원문 그대로는 아닐 수 있음에 유의.

---

## 핵심 요약 10줄

1. **빌드 스택은 "아무 Vite+React SPA"가 아니라 앱인토스 전용 프레임워크가 필수**: `@apps-in-toss/web-framework` 패키지 + `ait` CLI(`@apps-in-toss/devtools`)를 써야 하며, 예제 저장소의 `package.json`은 `"build": "vite build && ait build"`, `"deploy": "ait deploy"`로 되어 있음. Vite는 내부적으로 쓰이지만 `ait build`/`ait deploy` 단계 없이 순수 정적 Vite 번들만 업로드하는 방식은 문서상 확인되지 않음.
2. **토스 로그인 서버 API는 mTLS(클라이언트 인증서) 필수**: "토스 로그인 API는 파트너 서버에서 앱인토스 서버로 호출하는 서버 간 통신이에요. 보안을 위해 서버에 mTLS 인증서를 설정한 뒤 호출해 주세요." 공식 문서 어디에도 서버리스/엣지 환경(Vercel, Supabase Edge Functions, Cloudflare Workers 등)을 위한 대안이나 예외는 언급되어 있지 않음. (아래 "불명확한 점" 참고)
3. **미니앱은 로그인 수단으로 토스 로그인만 허용**: "미니앱에서는 로그인 기능으로 토스 로그인만 쓸 수 있어요." 자체 회원가입/소셜 로그인 등 대체 로그인 수단은 금지.
4. **탭바는 커스텀 불가, 반드시 토스 공식 플로팅 탭바만 허용**: "반드시 토스에서 제공하는 플로팅 형태의 탭바를 사용해서 직접 구현해야 해요." (겹치면 사용자가 위치를 헷갈릴 수 있다는 이유). 탭바 자체는 선택사항이지만 쓴다면 이 형태를 따라야 함.
5. **라이트 모드 구현이 검수 체크리스트 항목**: 비게임 검수 체크리스트에 "미니앱 테마는 라이트 모드로 구현돼 있어요." 항목이 명시. 전면 다크 테마 앱은 이 체크리스트 기준으로 반려될 가능성이 높음 (디자인 가이드의 "다크/라이트 모드 모두에서 잘 보여야 한다"는 문구는 그래픽/브랜드 자산이 토스 앱의 다크모드 크롬 위에서도 잘 보이라는 취지로 읽히며, 앱 콘텐츠 자체를 다크 테마로 만들라는 뜻은 아님).
6. **"벙개모임(오프라인 만남)" 성격이 앱인토스의 "만남/소개팅 서비스" 정책과 충돌할 위험이 큼**: `intro/caution.md`는 만남 서비스를 "이용자 간의 교류와 인연 형성을 목적으로 연결해 주는 서비스"로 정의하고, "근처 사용자 탐색 기능", "랜덤 매칭 또는 모르는 사람과의 연결 기능" 등이 있으면 만남 서비스로 분류된다고 명시. 이 경우 만 19세 이상 전용, 실명 인증, 신고/차단, 24시간 대응 SLA 등 강한 규제가 적용됨. "새벽사람들"은 연애 목적이 아니지만, 낯선 사람과의 오프라인 벙개(지역 기반 매칭)라는 특성상 이 카테고리로 분류될 위험이 있어 반드시 사전에 앱인토스 검수팀에 확인 필요.
7. **광고는 반드시 테스트 ID 사용, 정책 위반 시 제재**: 배너 테스트 ID `ait-ad-test-banner-id`, 전면 `ait-ad-test-interstitial-id`, 보상형 `ait-ad-test-rewarded-id`. 실제 운영 ID로 테스트 시 제재 가능.
8. **번들 크기 제한 100MB(압축 해제 기준)**: "앱 번들은 압축 해제 기준 100MB 이하만 업로드할 수 있어요." 큰 리소스는 CDN/외부 저장 권장.
9. **로그인 사용자 정보(login-me) 응답의 이름/전화/생일 등은 AES-256-GCM으로 암호화되어 내려오며, 콘솔에서 발급/이메일로 전달되는 복호화 키 + AAD 값으로 복호화**. 생일은 동의 항목(USER_BIRTHDAY) 중 하나로 콘솔에서 어떤 항목을 요청할지 선택 가능해 보이나, 문서에서 "필수 vs 선택"을 항목별로 명확히 구분해 표로 제공하지는 않음 (아래 참고).
10. **연결 해제(UNLINK) 콜백은 웹훅 방식으로 3가지 사유(UNLINK/WITHDRAWAL_TERMS/WITHDRAWAL_TOSS)를 서버로 전달**하며, 서비스는 해지 시 사용자 데이터 삭제 및 재로그인 요구가 검수 체크리스트 항목으로 포함되어 있음.

---

## 1. 개발 시작하기 / SDK / 로컬 테스트(샌드박스)

**출처**: `ai-vibe-coding/intro.md`, `ai-vibe-coding/tutorials/webview.md`, `documentation/integration/getting-started.md`, `documentation/sdk.md`, `development/test/sandbox.md`, `guide/operation/toss.md`

- 공식 "AI 바이브 코딩" 온보딩 흐름은 Claude Code/Codex 같은 MCP 클라이언트 + "apps-in-toss" 플러그인 설치를 전제로 하며, 대화형으로 앱을 만드는 방식을 안내함(비개발자 대상 마케팅 성격이 강함). 실제 코드 작업 시에는 표준 CLI 흐름이 있음:
  - 설치: `npm install @apps-in-toss/web-framework` (+ devtools), `npx ait init`
  - 설정 파일: `granite.config.ts` (앱 메타데이터, dev/build 커맨드, permissions 등 정의)
  - 개발: `npm run dev` (내부적으로 `vite dev`)
  - 빌드: `npm run build` (내부적으로 `vite build`), 그 다음 `ait build`로 `.ait` 번들 생성
  - 배포/테스트 업로드: `ait deploy`
- 예제 저장소(`toss-login` 폴더) `package.json` 확인 결과: React 19, Vite 6, TypeScript 5.7, `@apps-in-toss/web-framework` 3.0.4, `@apps-in-toss/devtools` 3.0.4. `scripts`: `"dev": "vite dev"`, `"build": "vite build && ait build"`, `"deploy": "ait deploy"`.
- SDK 패키지명: `@apps-in-toss/web-framework`. 두 가지 import 스타일 지원 — 도메인 인터페이스 방식(`import { Device } from '@apps-in-toss/web-framework'; Device.openCamera()`)과 v2 호환 플랫 함수 방식(`import { openCamera } from ...`).
- 로컬/디바이스 테스트는 별도의 "샌드박스 앱"(2.x)을 설치해 진행 — iOS 시뮬레이터 드래그앤드롭, iOS 실기기 QR, Android `adb install`. `adb reverse tcp:8081`, `tcp:5173` 포트 포워딩 필요. 로그인은 토스 비즈니스 계정, 앱 실행은 `intoss://{appName}` 스킴.
  - 샌드박스는 애널리틱스, 공유 리워드, 인앱 광고, 가로모드 게임, 내비게이션 바 공유 등을 지원하지 않음.
  - **주의**: 한 요약에서 "3.x 버전부터는 샌드박스 앱이 없고 내장 devtools로 브라우저 기반 개발을 한다"는 언급이 나왔는데, 다른 페이지(`guide/operation/toss.md`)에서는 콘솔 업로드 + QR 코드 테스트, 또는 CI/CD 명령으로 배포한다고 설명함. 두 설명이 버전(2.x vs 3.x)에 따라 갈리는 것으로 보이며, 정확한 최신 버전 기준 절차는 재확인 필요.
- `guide/operation/toss.md`(테스트 관련): `.ait` 번들 생성 → 콘솔 업로드 후 QR 테스트 또는 CI/CD 명령 사용. `intoss-private://` 스킴 + deploymentId로 검수 전 테스트 경로/쿼리파라미터 테스트 가능. iOS 흰 화면, CORS/ATS/쿠키 정책 문제 등 트러블슈팅 FAQ 있음. "검수 요청 전 최소 1회 이상 테스트 필수."

## 2. 토스 로그인 (Toss Login)

**출처**: `documentation/common/authentication.md`, `documentation/common/authentication/toss-login.md`, `guide/authentication/intro.md`, `documentation/common/authentication/hash-key.md`

### (a) 클라이언트 `appLogin()` 흐름
- 클라이언트에서 `appLogin()` SDK 함수 호출 → 1회용 인가 코드(authorization code) 발급, 유효기간 10분.

### (b) 서버의 AccessToken 발급
- Base URL: `https://apps-in-toss-api.toss.im`
- `POST /api-partner/v1/apps-in-toss/user/oauth2/generate-token` — 인가 코드를 access token(1시간)/refresh token(14일)으로 교환.
- `POST /api-partner/v1/apps-in-toss/user/oauth2/refresh-token` — 토큰 갱신.

### (c) 사용자 정보 조회 및 복호화
- `GET /api-partner/v1/apps-in-toss/user/oauth2/login-me` (Bearer 토큰) — 사용자 정보 조회.
- 이름, 전화번호, 생일 등 주요 필드는 **AES-256-GCM**으로 암호화되어 내려옴. 복호화에는 별도 키(이메일로 전달, "안전한 시크릿 관리 시스템에 보관" 권고) + AAD 값 필요. Kotlin/PHP/Java 복호화 예제 코드가 문서에 포함되어 있음(원문 코드는 이번 조사에서 직접 열람하지 못함 — 필요 시 재조회 필요).
- 동의 가능 항목(콘솔에서 설정): `USER_NAME`(이름), `USER_EMAIL`(이메일, null일 수 있음), `USER_GENDER`(성별, MALE/FEMALE), `USER_BIRTHDAY`(생일, yyyyMMdd), `USER_NATIONALITY`(국적, LOCAL/FOREIGNER), `USER_PHONE`(전화번호), `USER_CI`(CI/연계정보, 부정거래 방지용 암호화 식별자). `userKey`는 앱별 고유 식별자.
  - **불명확**: 이번 조사로는 "생일이 선택 항목인지, 필수로 강제할 수 있는지"를 항목별로 명시한 표를 찾지 못함. 문서는 "콘솔에서 선택한 항목 중 사용자가 동의한 값"이라고만 언급 — 즉 콘솔에서 어떤 스코프를 요청할지 서비스가 고를 수 있고, 사용자는 그 중 동의 여부를 선택하는 구조로 추정되나, 개별 항목의 "필수/선택" 토글 가능 여부는 원문에서 명확한 문구를 확보하지 못했음. **콘솔 화면에서 직접 확인 필요**.

### (d) mTLS 필요 여부
- **필수**. "토스 로그인 API는 파트너 서버에서 앱인토스 서버로 호출하는 서버 간 통신이에요. 보안을 위해 서버에 mTLS 인증서를 설정한 뒤 호출해 주세요." 인증서 발급 방법은 별도 문서(`documentation/integration/getting-started` 하위, 정확한 경로는 `mTLS 인증서 발급받기` 문서로 링크됨)로 안내. 인증서 + 개인키 파일이 발급되며 "안전하게 보관" 권고. **서버리스/엣지 환경 예외나 대안은 공식 문서 어디에도 없음**.
- `hash-key.md`(사용자 식별키, 게임용 `getUserKeyForGame`/비게임용 `getAnonymousKey`): 이 API는 서버 통합 없이 클라이언트에서 바로 키를 받을 수 있지만, 검증용 서버 API도 mTLS 인증이 필요하다고 언급됨.

### (e) 동의 항목
- 위 (c) 참고. 필수 약관: 서비스 이용약관, 제3자 제공 동의 등 법적 필수 약관 + 서비스 성격에 맞는 추가 약관을 콘솔에 등록해야 함("법적 요건을 충족해야 하는 부분"이라고 강조).

### (f) 연결 해제(UNLINK) 콜백
- 사용자가 토스 앱에서 연동 해제 시 웹훅(콜백) 전송. 사유 3종: `UNLINK`(사용자 직접 해제), `WITHDRAWAL_TERMS`(약관 동의 철회), `WITHDRAWAL_TOSS`(토스 계정 탈퇴).
- 로그아웃 API도 별도 존재: `POST /api-partner/v1/apps-in-toss/user/oauth2/access/remove-by-access-token`, `POST /api-partner/v1/apps-in-toss/user/oauth2/access/remove-by-user-key`.
- 검수 체크리스트: 연동 해제 시 재로그인 요구, 사용자 데이터 삭제 필요.

### 기타
- "미니앱에서는 로그인 기능으로 토스 로그인만 쓸 수 있어요." — 자체 로그인/소셜 로그인 등 대체 수단 불가 (검수 체크리스트에도 "대체 로그인 수단 없음"이 항목으로 있음).
- 이미 앱인토스를 쓰는 파트너는 자사 별도 웹/앱에도 토스 로그인 확장 가능 — `cert.support@toss.im`으로 서비스 종류, 사용자 식별 방식, 필요 개인정보 항목, 콜백 URI 제출.
- `documentation/common/authentication.md`는 인증 관련 하위 3문서를 링크: 사용자 식별키 발급(`hash-key.md`), 토스 로그인(`toss-login.md`), 토스 인증(`toss-auth.md`, 본인인증 서비스로 로그인과는 별개 — 계약 절차 별도, 영업일 7~14일 소요, client_id/secret 발급받는 방식. 요청서와 직접 관련 없어 이번 조사에서는 상세 확인 생략).

## 3. 인앱 광고 (Monetization / In-App Ads)

**출처**: `guide/monetization/in-app-ad.md`, `documentation/common/monetization/iaa.md`, `documentation/common/monetization/iaa/web-banner.md`, `documentation/common/monetization/iaa/interstitial-rewarded-ad.md`

- 광고 3종: 배너(상/하단 고정, eCPM 낮음·노출 많음), 전면형(화면 전환 시, 레벨업/예약완료 등 자연스러운 흐름 지점 권장), 보상형(사용자가 직접 시청 선택, eCPM 가장 높음).
- **테스트 ID**: 배너 `ait-ad-test-banner-id`, 네이티브 피드 `ait-ad-test-native-image-id`, 전면형 `ait-ad-test-interstitial-id`, 보상형 `ait-ad-test-rewarded-id`. "운영 ID로 테스트하면 제재를 받을 수 있어요."
- **웹뷰 배너 연동**: `TossAds` 객체 사용. `TossAds.initialize({ callbacks: { onInitialized, onInitializationFailed } })` → 초기화 후 `TossAds.attachBanner(adGroupId, containerRef, { theme: 'auto', tone, variant, callbacks: { onAdRendered, onAdImpression, onAdViewable, onAdClicked, onNoFill, onAdFailedToRender } })`. 컨테이너는 width 100%, height 96px 권장, 동일 화면에 같은 포맷 광고 중복 배치 금지. 언마운트 시 `attached.destroy()` 호출. 토스 앱 버전 5.241.0+ 필요, 이하 버전은 버전 체크로 예외처리.
- **전면형/보상형**: `loadFullScreenAd({ options: { adGroupId }, onEvent, onError })` 형태. 로드 실패는 `onError`/`onNoFill` 콜백으로 처리, `isSupported()`로 지원 여부 사전 체크 권장. 토스 광고는 로드 1~2초(최대 10초), Google AdMob 경유는 5~20초(최대 60초) 소요 — 미리 로드 권장. 앱 버전 5.227.0+ 필요. iOS ATT(App Tracking Transparency) 설정이 일부 광고 로드를 막을 수 있음.
- **정책 금지사항**: 광고를 "팁/추천" 등 콘텐츠로 위장 금지, 광고 UI(색상/폰트/버튼) 임의 변경 금지, 클릭 유도형 배치(인터랙션 요소 옆) 금지, 동일 포맷 광고 중복 배치 금지, 사용자를 가두는(dead-end) 구조 금지, SDK 이벤트 조작/우회 금지, 인위적 트래픽/반복 새로고침 금지, 광고 클릭 시 즉시 보상 제공 금지.
- 예상 수익 = (노출수 × eCPM) ÷ 1000. 매월 1일 전월 정산 확정, 월말 지급. 구체적 정산 %/단가는 문서에 없음.
- 검수 체크리스트 관련 항목: 광고 재생 시 오디오 일시정지, 실제 광고 노출 시 크래시 없어야 함, 실시간이 아닌 사전로드 방식이어야 함, 광고 종료 후 앱 정상 복귀 및 음악 재개, 보상형 리워드 정상 지급, 배너는 스크롤 가능한 화면에만 배치.

## 4. 디자인 / TDS (Toss Design System)

**출처**: `design/components.md`, `design/consumer-ux-guide.md`

- TDS는 디자이너/개발자/기획자가 공통 언어로 협업하기 위한 디자인 시스템. `design/components.md`에는 Appintoss(비게임) 서비스용 컴포넌트 11종 나열: Badge, Border, BottomCTA, Button, Asset, ListRow, ListHeader, Navigation, Paragraph, Tab, Top.
  - **불명확**: 이번 조사에서 WebView(React)용 실제 npm 패키지명(예: `@toss/tds-mobile` 등 추정만 나왔고 공식 확인은 못 함)과 설치/사용 예제 코드를 확정적으로 확보하지 못했음. `ai-vibe-coding/tutorials/webview.md` 요약에서 "TDS Mobile (@toss/tds-mobile)"이 스택 후보로 언급되었으나, 이는 튜토리얼 요약에서 나온 것으로 `design/components.md` 자체에서 패키지명을 직접 확인하지는 못했음 — **재검증 필요**.
- **다크모드/라이트모드**: `design/consumer-ux-guide.md`는 "다크 모드와 라이트 모드 모두에서 잘 보여야 해요"라고 안내하지만 이는 주로 그래픽/브랜드 자산(아이콘, 로고 등)이 토스 앱의 시스템 다크모드 위에서도 잘 보이라는 취지로 보임. 반면 **`checklist/app-nongame.md`(검수 체크리스트)에는 "미니앱 테마는 라이트 모드로 구현돼 있어요."라는 항목이 명시**되어 있어, 앱 콘텐츠 자체는 라이트 모드로 구현해야 검수 통과가 쉬움. 즉 "전면 다크 테마 앱"은 이 체크리스트 문구상 반려 가능성이 있음 — 이는 요청서가 다크 테마 위주 디자인을 가정했다면 충돌 지점.
- **탭바**: "반드시 토스에서 제공하는 플로팅 형태의 탭바를 사용해서 직접 구현해야 해요." 커스텀 탭바(자체 디자인) 명시적으로 금지. 이유: "토스 메인 화면의 기본 하단 탭과 형태가 겹치면, 사용자가 현재 위치를 헷갈릴 수 있기" 때문. 탭바 사용 자체는 선택이지만, 쓴다면 이 규격을 따라야 함.
- 내비게이션 바: 별도 게임/비게임 가이드에서 다룬다고만 언급되고 이 페이지 자체에는 상세 패턴이 부족함 — 체크리스트(`checklist/app-nongame.md`)의 "내비게이션 바" 섹션 참고(토스 내비게이션 바 사용, 뒤로가기 일관 동작, 브랜드 로고/한글 앱명 일치, 홈 버튼(선택), 기능 버튼 최대 1개(선택), 중복 뒤로가기 버튼 금지, 더보기(⋯) 메뉴에 표준 토스 기능 포함, 첫 화면 뒤로가기는 앱 종료).

## 5. 검수 / 출시 (Checklist, Caution, Deploy)

**출처**: `checklist/app-nongame.md`, `intro/caution.md`, `intro/guide.md`, `guide/operation/deploy.md`

### 검수 체크리스트 (비게임) 주요 항목
- 접근/실행, 내비게이션 바 규격(위 4번 참고), 사용자 식별자 저장/유지, 보안(eval 등 외부 코드 실행 금지, 토스 도메인 내 렌더링만 허용, **CSR 또는 SSG만 허용**(SSR 명시적 언급 없음 — SPA 빌드 방식과 부합), wss:// 암호화, HTTPS만 허용), 서비스 동작(안드로이드 백버튼 처리, 제스처 줌 비활성화, **라이트 모드 테마**, 2초 내 반응, 세션 간 데이터 유지, 외부링크 정상 동작, 공유는 `intoss://` 스킴(비공개용 `intoss-private://` 아님), 비속어/불법/음란 콘텐츠 금지, 권한 요청은 사용 시점에, 권한 거부해도 기능 유지), UX(진입 시 자동 바텀시트 금지, 강제 액션 금지, 모든 화면에 명확한 종료 방법, 자사 앱 설치 유도 금지), 토스 로그인 항목(서비스 소개 페이지 제공, 약관 URL 정상 노출, 연동 해제 시 재로그인 요구, 데이터 삭제, 대체 로그인 수단 없음), 인앱결제/토스페이/인앱광고/공유리워드 각각의 세부 체크리스트.

### `intro/caution.md` — 서비스별 주의사항 (요청서와 관련해 매우 중요)
- **만남/소개팅 서비스 정의**: "이용자 간의 교류와 인연 형성을 목적으로 연결해 주는 서비스예요." 트리거 조건 예시로 "프로필 기반 매칭, 채팅, 추천 알고리즘", "랜덤 매칭 또는 모르는 사람과의 연결 기능", "근처 사용자 탐색 기능", "공개 프로필 기반 메시지 발송", "이성 추천" 등이 언급됨.
- 이 카테고리로 분류되면: 만 19세 이상만 이용 가능(미성년자 접근 시 즉시 서비스 중단), 실명 기반 인증, AI+수동 검수로 허위 프로필/도용 사진 차단, 원클릭 신고/차단 기능 및 24시간 이내 대응 SLA, 반복 위반자 영구 정지, 분쟁 대응용 메시지 저장, 조건 만남/성매매/보이스피싱/사기/스토킹 방지 조치, 신고 시스템·모니터링·수사기관 협조 체계, 사업자 등록 완료·콘텐츠 모니터링 체계·민감정보 최소화·침해 대응 체계 등 12개+ 항목 사전 확인.
- 채팅 서비스(일반)는 별도로 신고/차단, 계정 제재, 운영자 검토, 메시지 암호화·삭제 정책 요구.
- **"랜덤 매칭, 위치 기반 탐색, 수익화 기능이 있으면 만남 서비스로 분류될 수 있다"**는 문구가 확인되어, "새벽사람들 in 부천"의 지역(부천) 기반 오프라인 벙개 매칭 기능이 이 기준에 해당할 가능성이 있음. **연애 목적이 아니라는 이유만으로 이 카테고리를 자동으로 벗어난다고 단정할 수 없으며, 실제 서비스 기획 확정 전 앱인토스 검수팀(채널톡 등)에 사전 문의를 강력히 권장**.
- `intro/guide.md`(정책 가이드 개요): 콘텐츠 표현 기준(성적 콘텐츠·폭력·불법행위 조장·혐오·마약/도박 언급 금지, 민감도 1~3단계 경고 화면 체계), 서비스 운영 기준(동일 워크스페이스 내 중복 앱 금지, 외부 앱 설치 유도 금지, 로그인/결제 수단은 토스 승인 방식만, 생성형 AI 기능은 명시적 고지 필요), 금지 서비스(암호화폐/NFT, 자금세탁 위험, 대출/보험/증권 등 금융업, 정치 콘텐츠, 무면허 의료, 부동산(임시) 등), 조건부 서비스(보드게임, 만남/매칭 앱, AI 챗봇, 채팅 서비스, 중고거래 등 — 각각 세부 체크리스트 존재).

### 배포 (`guide/operation/deploy.md`)
- **번들 크기 제한**: "앱 번들은 압축 해제 기준 100MB 이하만 업로드할 수 있어요."
- 절차: 사전 체크리스트 확인 → 콘솔에서 검수 요청 버튼 클릭(영업일 기준 최대 3일, 일부 카테고리는 7일+) → 승인 시 이메일 통보 → "출시" 버튼 클릭 시 즉시 전체 사용자에게 배포 → 업데이트는 새 번들 업로드 후 동일한 검수→승인→출시 사이클 반복, 이전 버전으로 롤백 가능, 긴급 오류는 채널톡으로 핫픽스 요청.
- 리소스는 CDN/외부 저장 또는 지연 로딩 권장(번들엔 필수 자산만 포함).

## 6. 예제 저장소 (`github.com/toss/apps-in-toss-examples`)

**출처**: GitHub 저장소 (`gh` CLI는 이 환경에서 인증되지 않아 사용 불가, WebFetch로 대체 확인. `toss-login/package.json`은 raw.githubusercontent.com에서 직접 조회 성공)

- 최상위 예제 폴더: `common-apis`(파일/네트워크/런타임), `growth`(프로모션, 리뷰 요청, 스마트 메시징, 공유 리워드, 애널리틱스), `in-app-payments`, `in-app-ads`(전면/보상/웹뷰배너), `assets`, `data-sdk`, `device-apis`, `toss-login`, `user-identification`.
- `toss-login/package.json` 확인 결과(원문 그대로):
  - `"dev": "vite dev"`, `"build": "vite build && ait build"`, `"deploy": "ait deploy"`, lint: `eslint .`, format: `prettier --write .`
  - 의존성: `react@^19.0.0`, `react-dom`, `@apps-in-toss/web-framework@3.0.4`
  - devDependencies: `@apps-in-toss/devtools@3.0.4`, `vite@6.2.0`, `typescript@~5.7.2`, `eslint@9.21.0`(+ react 플러그인), `prettier@3.4.2`
- 즉 스택은 **React 19 + TypeScript + Vite 6**이 맞지만, 반드시 `@apps-in-toss/web-framework` SDK를 사용하고 `ait build`/`ait deploy`(즉 `@apps-in-toss/devtools`가 제공하는 CLI)로 빌드/배포해야 함. README 자체에서 프레임워크명을 명확히 밝히진 않았으나 실제 `package.json`이 이를 증명함.

---

## 요청서와 다르거나 불명확한 점

1. **"Vite+React+TypeScript(SPA)로 순수 정적 번들을 만들면 된다"는 가정은 절반만 맞음.** 실제로는 Vite+React+TS가 내부 빌드 도구로 쓰이는 것은 맞지만, **`@apps-in-toss/web-framework` SDK와 `@apps-in-toss/devtools`가 제공하는 `ait` CLI(`ait init` / `ait build` / `ait deploy`)를 반드시 사용**해야 하며, `granite.config.ts` 같은 전용 설정 파일이 필요함. "그냥 아무 Vite 프로젝트를 빌드해서 zip으로 올리면 끝"이라는 식의 접근은 문서/예제 어디서도 확인되지 않음. → **요청서에 이 전용 CLI/프레임워크 의존성이 빠져 있다면 반드시 반영 필요.**

2. ~~**"Supabase Edge Function이 mTLS를 지원하지 않는다"는 커뮤니티 정보 자체를 공식 문서로 확인/반증하지 못함.**~~ **[2026-09-23 해소]** 실제 mTLS 인증서 발급받아 `api/`(Vercel Node 런타임)에서 `node:https`의 `Agent({cert, key})`로 토스 API에 요청 → TLS 핸드셰이크 성공 확인(PoC 통과, `docs/decisions.md` 2026-09-23 참고). Vercel Node 런타임이면 되고, 별도 mTLS 지원 서버는 필요 없음. (Supabase Edge Function을 쓸지 여부는 애초에 무관해짐 — `api/`로 충분.)

3. **"미니앱에서는 토스 로그인만 허용된다"는 제약은 문서로 확인됨** — "미니앱에서는 로그인 기능으로 토스 로그인만 쓸 수 있어요."로 명시. 요청서가 이 전제를 갖고 있었다면 일치함.

4. **탭바는 커스텀 불가, 토스 공식 플로팅 탭바만 허용** — 명시적으로 확인됨. 요청서가 커스텀 탭바 디자인을 가정했다면 반드시 토스 플로팅 탭바 컴포넌트로 교체 필요.

5. **다크모드 관련 잠재적 충돌**: 요청서가 다크 테마(야간근무자 대상 서비스 특성상 다크 UI를 기본으로 가정했을 가능성 높음) 중심 디자인이라면, 검수 체크리스트의 "미니앱 테마는 라이트 모드로 구현돼 있어요." 항목과 충돌할 수 있음. 디자인 가이드 자체는 "다크/라이트 모드 모두 잘 보여야 한다"고 하지만 이는 브랜드 자산에 대한 이야기로 보이며, 앱 콘텐츠를 다크 테마로 전면 구현해도 되는지는 이 조사만으로는 100% 확정할 수 없음 — **콘솔/검수팀에 직접 확인 필요**. (다크 테마를 아예 반려한다는 명시적 문구까지는 확인 못했으나, 라이트 모드 구현이 체크리스트 항목으로 존재하는 것은 확실.)

6. **"새벽사람들 in 부천"의 오프라인 벙개모임 기능이 앱인토스의 "만남/소개팅 서비스" 정책 적용 대상이 될 위험이 있음** — 요청서에는 아마 이 리스크가 반영되어 있지 않을 가능성이 있음. `intro/caution.md`의 만남 서비스 트리거 조건("근처 사용자 탐색", "모르는 사람과의 연결 기능")에 지역 기반 오프라인 벙개가 해당될 수 있어, 만 19세 이상 제한/실명 인증/신고 SLA 등 무거운 요건이 부과될 가능성이 있음. **이 부분은 반드시 실제 앱인토스 담당자(채널톡)에게 서비스 컨셉을 설명하고 카테고리 분류를 사전 확인해야 함.**

7. ~~**동의 항목 중 "생일이 선택인지 필수로 강제 설정 가능한지"는 이번 조사로 명확한 답을 얻지 못함.**~~ **[2026-09-23 콘솔 확인]** "이름(user_name)"은 **콘솔에서 필수 동의로 고정되어 있고 바꿀 수 없음**(다른 옵션이 회색 비활성화). 나머지(이메일·성별·생년월일·국적·전화번호·CI)는 서비스가 필수/선택/사용안함을 자유롭게 고를 수 있음. 새벽사람들은 이름 외 전부 "사용 안함"으로 설정 — `userKey`는 동의 항목과 무관하게 항상 내려오므로 로그인 자체는 문제없음. 서버(`api/auth/toss/login.ts`)는 이름 필드를 복호화·저장하지 않고 폐기해 CLAUDE.md 규칙 4(실명 저장 금지)를 지킴 — "동의는 토스 정책상 강제로 받지만 실제로 쓰지 않는다"는 구조.

8. **TDS(Toss Design System)의 WebView용 정확한 npm 패키지명을 문서 원문에서 직접 확정하지 못함.** 튜토리얼 요약에서 "TDS Mobile(@toss/tds-mobile)"이라는 이름이 언급되었으나 `design/components.md` 자체에서는 컴포넌트 목록만 확인했고 패키지명/설치법 문구를 직접 인용하지 못함 — 재검증 필요.

### 접근하지 못했거나 불완전하게 확인한 URL
- `https://developers-apps-in-toss.toss.im/documentation/integration/server-api.md` — 존재는 하지만(링크만 확인) mTLS 인증서 "발급 절차"의 구체적 단계(콘솔 위치, 파일 형식, CLI 명령 등)는 확보하지 못함. 요약 응답이 "문서에 상세 내용 없음/별도 조회 필요"로 회신되어, 원문에 있는데 못 가져온 것인지 실제로 이 페이지가 다른 경로로 이동한 것인지 불확실.
- `https://developers-apps-in-toss.toss.im/documentation/common/authentication/toss-login.md`의 Kotlin/PHP/Java 복호화 예제 코드 — 존재는 확인했으나 원문 코드 자체는 이번 조사에서 직접 인용하지 못함(요약만 확보).
- `https://developers-apps-in-toss.toss.im/design/components.md`의 TDS 패키지명/설치 코드 — 컴포넌트 목록은 확보했으나 npm 패키지명과 설치 예제는 확인 못함.
- GitHub CLI(`gh`)가 이 환경에서 인증되지 않아(`gh auth login` 필요) 예제 저장소는 WebFetch(웹 렌더링) + `raw.githubusercontent.com` 직접 조회로 대체함. 각 예제 폴더의 개별 README는 시간 관계상 `toss-login` 폴더의 `package.json`만 확인했고 나머지 폴더(`in-app-ads`, `growth` 등)의 README는 열람하지 못함.
- `guide/authentication/contract.md`는 URL 추정이 실제로는 "토스 인증(본인인증)" 계약 절차 페이지로 연결되어, 원래 찾으려던 "토스 로그인 mTLS 계약/설정" 내용과는 다른 페이지였을 가능성이 있음 — 경로가 정확히 맞는지 재확인 필요.
