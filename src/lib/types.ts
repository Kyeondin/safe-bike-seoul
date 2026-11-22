// 서버(API Route)와 브라우저가 함께 쓰는 타입. 키·서버 로직은 여기에 두지 마세요.

/** 서울시 공공자전거 실시간 대여정보 (bikeList) */
export type BikeStation = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** 현재 거치된 자전거 수 (대여 가능 대수) */
  bikes: number;
  /** 거치대 수 */
  docks: number;
  /** 거치율(%) — 자전거 수 / 거치대 수 × 100, 100 초과 가능 */
  sharedRate: number;
};

export type NearbyStation = BikeStation & { distanceM: number };

export type StationsResponse =
  | { ok: true; data: NearbyStation[]; source: string; fetchedAt: string; total: number; cacheSeconds: number }
  | { ok: false; error: string };

/** 기상청 초단기실황 */
export type CurrentWeather = {
  observedAt: string; // ISO (KST)
  temperature: number | null; // ℃
  humidity: number | null; // %
  windSpeed: number | null; // m/s
  rain1h: number | null; // mm
  precipitationType: string;
  grid: { nx: number; ny: number };
};

/** 한국도로교통공단 자전거 사고다발지역 */
export type AccidentSpot = {
  id: string;
  name: string;
  district: string;
  lat: number;
  lng: number;
  accidents: number;
  casualties: number;
  deaths: number;
  seriousInjuries: number;
  minorInjuries: number;
  /** 부상신고자 수 */
  injuryReports: number;
  severity: "high" | "medium" | "low";
  /** 다발지역 범위 폴리곤 외곽선 (반경 약 200m) */
  polygon: { lat: number; lng: number }[];
};

/** /api/accidents 응답 메타데이터 */
export type AccidentMeta = {
  /** 사고 발생 기준연도 (API searchYearCd) — 이 해 1년간 발생한 사고로 선정 */
  accidentYear: number;
  criteria: string;
  checkedYears: { year: number; spots: number }[];
};

/** API Route 공통 응답 형태 */
export type ApiResponse<T, Meta = object> = ({ ok: true; data: T; source: string } & Meta) | { ok: false; error: string };

/** 기상청 단기예보 — 한 예보시각의 값 */
export type ForecastHour = {
  /** 예보시각 (이 시각의 날씨를 예측한 값), ISO KST */
  forecastAt: string;
  temperature: number | null; // TMP ℃
  /** 강수확률 % (POP) */
  pop: number | null;
  precipitationType: string; // PTY
  /** 1시간 강수량 원문 (예: "강수없음", "1mm 미만", "2.0mm") */
  precipitation: string | null; // PCP
  sky: string | null; // SKY
  humidity: number | null; // REH
  windSpeed: number | null; // WSD
};

/** 기상청 단기예보 (getVilageFcst) */
export type ShortTermForecast = {
  /** 발표시각 (기상청이 예보를 낸 시각), ISO KST */
  issuedAt: string;
  grid: { nx: number; ny: number };
  hours: ForecastHour[];
};
