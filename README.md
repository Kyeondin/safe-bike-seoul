# Safe Bike Seoul

서울 따릉이 대여소, 카카오 자전거 경로, 자전거 사고다발지역, 날씨를 지도 한 화면에서 보여 주는 웹앱입니다.
Next.js 16(App Router) · TypeScript · Tailwind CSS v4 · 카카오맵 JavaScript SDK.

> ⚠️ 이 앱은 경로의 안전성을 평가하거나 보장하지 않습니다.
> 사고다발지역은 **과거 통계**이며, 경로 주변 사고다발지역 수가 적다고 안전하다는 뜻은 아닙니다.

## 데이터 출처

| 기능 | 출처 | 성격 | 서버 캐시 |
|---|---|---|---|
| 따릉이 대여소·대여 가능 대수 | 서울 열린데이터광장 공공자전거 실시간 대여정보(`bikeList`) | 실시간 (최대 1분 지연) | 60초 |
| 장소 검색 | 카카오 로컬 키워드 검색 | 실시간 | 10분 |
| 현재 날씨 | 기상청 초단기실황(`getUltraSrtNcst`) | 매시 관측값 | 10분 |
| 시간별 기온·강수확률 | 기상청 단기예보(`getVilageFcst`) | 하루 8회 발표 예보 | 30분 |
| 자전거 사고다발지역 | 한국도로교통공단 자전거 교통사고 다발지역 | 연 단위 과거 통계 | 24시간 |
| 자전거 경로 | 카카오 자전거 경로(`dapi.kakao.com/v2/routing/bicycle`) ⚠️ 공개 문서 미확인 | 실시간 조회 | 10분 |

## 로컬 실행

Node.js 20.9 이상이 필요합니다.

```bash
npm install
cp .env.example .env.local   # 값을 채우세요
npm run dev                  # http://localhost:3000
```

검사: `npm run lint`, `npm run typecheck`, `npm run build`

## 환경변수

| 이름 | 공개 범위 | 용도 | 발급처 |
|---|---|---|---|
| `SEOUL_API_KEY` | 서버 전용 | 따릉이 실시간 대여정보 | [서울 열린데이터광장](https://data.seoul.go.kr) |
| `DATA_GO_KR_API_KEY` | 서버 전용 | 기상청 단기예보, 도로교통공단 사고다발지역 | [공공데이터포털](https://www.data.go.kr) (두 API 모두 활용신청 필요) |
| `KAKAO_REST_API_KEY` | 서버 전용 | 장소 검색, 자전거 경로 | [카카오 개발자](https://developers.kakao.com) → 앱 키 → REST API 키 |
| `SEOUL_ALLOW_HTTP` | 서버 전용 | `true`일 때만 서울시 OpenAPI(HTTP 전용) 호출 | - |
| `NEXT_PUBLIC_KAKAO_JS_KEY` | **브라우저에 공개** | 카카오 지도 표시 | 카카오 개발자 → 앱 키 → JavaScript 키 |

- `NEXT_PUBLIC_` 접두사가 없는 키는 서버(API Route)에서만 쓰이며 브라우저 번들에 포함되지 않습니다.
  `src/lib/server/*`는 `import "server-only"`로 보호되어 클라이언트에서 import하면 빌드가 실패합니다.
- `NEXT_PUBLIC_KAKAO_JS_KEY`는 구조상 브라우저에 노출됩니다. 카카오 콘솔의 **허용 도메인**으로 보호하세요.
- 서울 열린데이터광장 OpenAPI는 HTTP만 지원하므로 서버→서울시 구간에서 키가 암호화되지 않고 전송됩니다.
  이를 감수할 때만 `SEOUL_ALLOW_HTTP=true`로 설정하세요.
- `.env*` 파일은 `.gitignore`로 제외됩니다(`.env.example`만 커밋).

## Vercel 배포

1. GitHub 저장소를 Vercel에서 **Import**합니다. 프레임워크는 Next.js로 자동 인식됩니다.
2. **Settings → Environment Variables**에 위 5개 변수를 등록합니다.
   - Production과 Preview 모두 체크하세요. (Preview 지도를 쓰지 않으면 Production만 등록해도 됩니다.)
   - `NEXT_PUBLIC_KAKAO_JS_KEY`는 **빌드할 때 번들에 고정**됩니다. 값을 바꾸면 반드시 **Redeploy**하세요.
     서버 전용 키는 다음 배포부터 반영됩니다.
3. 배포 후 `https://<도메인>/api/health`에서 각 키의 설정 여부(true/false만 표시)를 확인합니다.
4. 서버 함수 리전은 `vercel.json`에서 **서울(`icn1`)**로 지정되어 있습니다. 호출하는 외부 API가 모두 국내 서버이기 때문입니다.

## 카카오 개발자 콘솔 설정

[developers.kakao.com](https://developers.kakao.com) → 내 애플리케이션 → 해당 앱

1. **제품 설정 → 카카오맵**: 사용 설정 **ON**
   (꺼져 있으면 지도와 장소 검색 모두 `OPEN_MAP_AND_LOCAL` 권한 오류가 납니다.)
2. **앱 설정 → 플랫폼 → Web → 사이트 도메인**에 지도가 열릴 주소를 모두 등록합니다.
   ```
   http://localhost:3000
   https://<프로젝트명>.vercel.app
   https://<연결한 커스텀 도메인>
   ```
   - 프로토콜(`https://`)까지 정확히 입력하고, 경로나 끝의 `/`는 넣지 않습니다.
   - Preview 배포 주소(`<프로젝트>-<해시>-<팀>.vercel.app`)는 배포마다 바뀌므로, Preview에서 지도를 확인하려면 그 주소를 따로 등록해야 합니다.
   - 등록되지 않은 도메인에서는 지도 대신 "카카오맵 SDK를 불러오지 못했습니다" 안내가 표시됩니다.
3. REST API 키는 서버에서만 사용하므로 사이트 도메인 등록과 관계없습니다.

## 프로젝트 구조

```
src/
  app/
    page.tsx                 메인 화면
    api/                     API Route (서버에서 외부 API 호출, 키 보관)
      stations/  weather/  forecast/  accidents/  search/  route/  health/
  components/                지도·검색·카드 UI
  hooks/                     API 호출 훅
  lib/
    server/                  서버 전용: 키 관리, 외부 API 클라이언트, 캐시
    types.ts                 서버·클라이언트 공용 타입
```

## 알려진 한계

- 자전거 경로 API(`dapi.kakao.com/v2/routing/bicycle`)는 카카오 개발자 공개 문서에서 확인되지 않은 엔드포인트입니다.
  예고 없이 바뀌거나 막힐 수 있고, 이용 조건을 확인해야 합니다. 실패하면 경로 카드에 실패 이유를 표시하며 임의의 경로는 만들지 않습니다.
- 이 API는 경로를 1개만 돌려주며, `priority` 등 옵션을 바꿔도 결과가 같았습니다(2026-11 실측).
  그래서 '자전거도로 우선'과 '최단 거리'를 구분할 수 없고, 옵션별 결과가 실제로 다를 때만 두 경로를 비교 표시합니다.
- 카카오모빌리티의 공식 자전거 길찾기 API(`apis-navi.kakaomobility.com/affiliate/bicycle`)는 제휴 전용이라 권한이 없어 사용하지 않습니다.
- 서버 캐시는 함수 인스턴스 메모리에 있어 인스턴스마다 따로 유지됩니다.
- `/api/*`에는 별도의 호출 제한(rate limit)이 없습니다. 공개 배포 시 외부 API 일일 호출 한도에 주의하세요.
