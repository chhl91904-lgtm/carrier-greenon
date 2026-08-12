# Carrier GreenON

Carrier GreenON은 캐리어 에어컨 사용자를 위한 ESG 친환경 냉방 미션 + 리워드 모바일 웹앱입니다. 실제 에어컨 API 대신 가상 IoT 상태를 사용하며, 사용자 계정과 미션·포인트·구매 데이터는 Supabase에 저장합니다.

배포 URL: https://carrier-greenon-yieb.onrender.com

## 이메일 없는 데모 체험

별도 도메인을 구매하거나 회원가입하지 않아도 Render 기본 주소에서 바로 체험할 수 있습니다.

**데모 URL:** https://carrier-greenon-yieb.onrender.com/?demo=1

- 데모 사용자는 첫 접속 때 자동으로 로그인됩니다.
- 미션, GREEN POINT, 구매내역은 현재 브라우저의 localStorage에만 저장됩니다.
- 데모 상단의 `실제 계정 모드`를 누르면 Supabase 회원가입/로그인 화면으로 돌아갑니다.
- 데모 데이터와 실제 Supabase 사용자 데이터는 서로 섞이지 않습니다.

## 주요 사용자 흐름

1. Supabase 이메일 회원가입 또는 로그인
2. 서울 현재 날씨·습도·PM2.5와 가상 에어컨 상태 확인
3. 26°C 절전 냉방 GREEN MISSION 참여
4. 30분 단위 시간 시뮬레이션과 조건 판정
5. 성공 시 GREEN POINT 자동 적립
6. GREEN WALLET에서 잔액과 적립·사용 기록 확인
7. GREEN REWARD SHOP에서 포인트 구매
8. MY 화면에서 GREEN LEVEL과 GREEN REPORT 확인

## 기술 구성

- 정적 HTML, CSS, JavaScript
- Supabase Auth + Postgres + Row Level Security
- Open-Meteo 현재 날씨·Air Quality API
- Render Static Site
- 모바일 우선 Brown + Pink 디자인 시스템

## 로컬 실행

정적 파일 서버로 프로젝트 루트를 실행한 뒤 브라우저에서 `index.html`을 엽니다. Supabase를 연결하려면 다음 중 한 가지 방법을 사용합니다.

1. `config.example.js`를 `config.js`로 복사합니다.
2. Supabase 프로젝트 URL과 **publishable key**를 입력합니다.
3. `service_role`, secret key, 데이터베이스 비밀번호는 브라우저 파일에 넣지 않습니다.

Node.js가 있는 환경에서는 원하는 정적 서버를 사용할 수 있습니다.

```bash
npx serve .
```

## 환경변수

Render 빌드는 `scripts/generate-config.sh`를 실행해 아래 환경변수로 `config.js`를 생성합니다.

| 변수 | 설명 | 공개 가능 여부 |
|---|---|---|
| `SUPABASE_URL` | Supabase 프로젝트 API URL | 공개 가능 |
| `SUPABASE_PUBLISHABLE_KEY` | 브라우저용 publishable key | 공개 가능 |

필요한 값의 형식은 `.env.example`에 정리되어 있습니다. 실제 로컬 `config.js`와 `.env` 파일은 `.gitignore`에 포함됩니다.

## Supabase 보안 구조

- `profiles`, `user_missions`, `point_transactions`, `reward_orders`, `aircon_status`는 `auth.uid()` 소유자만 조회할 수 있습니다.
- 포인트 거래와 주문은 클라이언트에서 직접 INSERT할 수 없습니다.
- 미션 시작·진행과 상품 구매는 공개 `SECURITY INVOKER` RPC를 통과합니다.
- 실제 권한 상승이 필요한 로직은 Data API에 노출되지 않는 `private` 스키마에 있습니다.
- `anon`은 활성 미션과 활성 리워드 카탈로그만 읽을 수 있습니다.
- 모든 `public` 테이블에 RLS와 역할별 명시적 `GRANT`를 적용했습니다.

적용한 전체 스키마는 `supabase/schema.sql`에서 확인할 수 있습니다.

## Render 배포

루트의 `render.yaml`은 Render Blueprint 형식입니다.

- Runtime: Static
- Build command: `sh scripts/generate-config.sh`
- Publish path: `.`
- Auto deploy: Git commit
- SPA rewrite: `/*` → `/index.html`

Render에서 `SUPABASE_URL`과 `SUPABASE_PUBLISHABLE_KEY`를 등록한 뒤 Blueprint 또는 Static Site로 배포합니다. 배포 URL은 Supabase Dashboard의 Auth URL Configuration에 Site URL 및 Redirect URL로 추가해야 합니다.

## 개발 규칙

- 실제 Carrier 에어컨 API를 연결하지 않습니다.
- 정상 상태는 Brown/Pink, 성공 상태는 Pink/Green, 경고와 오류만 Red를 사용합니다.
- JavaScript에는 초보자가 흐름을 이해할 수 있도록 한글 주석을 유지합니다.
- 기능 완료 후 `CHECKLIST.md`를 갱신하고 기존 흐름을 회귀 검사합니다.
