import "server-only";
import { getSecret } from "./env";
import { cached, encodeServiceKey, fetchJson, UpstreamError } from "./http";
import type { CurrentWeather, ForecastHour, ShortTermForecast } from "@/lib/types";

// 기상청 단기예보 조회서비스 (공공데이터포털 경유)
// - 초단기실황(getUltraSrtNcst): 매시 정각 관측값
// - 단기예보(getVilageFcst): 하루 8회 발표, 1시간 단위 예보 (기온·강수확률 등)

const SOURCE = "기상청 초단기실황";

type KmaResponse = {
  response: {
    header: { resultCode: string; resultMsg: string };
    body?: { items: { item: { category: string; obsrValue: string; baseDate: string; baseTime: string }[] } };
  };
};

const PTY: Record<string, string> = {
  "0": "없음",
  "1": "비",
  "2": "비/눈",
  "3": "눈",
  "5": "빗방울",
  "6": "빗방울눈날림",
  "7": "눈날림",
};

/** 위경도 → 기상청 격자(nx, ny) 변환 (Lambert Conformal Conic, 기상청 공식 파라미터) */
export function toKmaGrid(lat: number, lng: number) {
  const RE = 6371.00877 / 5.0; // 지구 반경 / 격자 간격(km)
  const DEG = Math.PI / 180;
  const slat1 = 30 * DEG, slat2 = 60 * DEG, olon = 126 * DEG, olat = 38 * DEG;
  const XO = 43, YO = 136;

  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;
  const ro = (RE * sf) / Math.pow(Math.tan(Math.PI * 0.25 + olat * 0.5), sn);
  const ra = (RE * sf) / Math.pow(Math.tan(Math.PI * 0.25 + lat * DEG * 0.5), sn);
  let theta = lng * DEG - olon;
  if (theta > Math.PI) theta -= 2 * Math.PI;
  if (theta < -Math.PI) theta += 2 * Math.PI;
  theta *= sn;
  return {
    nx: Math.floor(ra * Math.sin(theta) + XO + 0.5),
    ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5),
  };
}

/** 초단기실황은 매시 정각 관측, 약 40분 이후 제공 → 가장 최근 제공된 base_date/base_time (KST) */
function latestBase(now = new Date()) {
  const kst = new Date(now.getTime() + 9 * 3600_000);
  if (kst.getUTCMinutes() < 45) kst.setUTCHours(kst.getUTCHours() - 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    baseDate: `${kst.getUTCFullYear()}${pad(kst.getUTCMonth() + 1)}${pad(kst.getUTCDate())}`,
    baseTime: `${pad(kst.getUTCHours())}00`,
  };
}

export function getCurrentWeather(lat: number, lng: number): Promise<CurrentWeather> {
  const key = getSecret("DATA_GO_KR_API_KEY");
  const grid = toKmaGrid(lat, lng);
  const { baseDate, baseTime } = latestBase();

  return cached(`kma:${grid.nx},${grid.ny}:${baseDate}${baseTime}`, 10 * 60_000, async () => {
    const params = new URLSearchParams({
      pageNo: "1",
      numOfRows: "100",
      dataType: "JSON",
      base_date: baseDate,
      base_time: baseTime,
      nx: String(grid.nx),
      ny: String(grid.ny),
    });
    const url = `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst?serviceKey=${encodeServiceKey(key)}&${params}`;
    const json = await fetchJson<KmaResponse>(SOURCE, url);
    const { header, body } = json.response;
    if (header.resultCode !== "00" || !body) {
      throw new UpstreamError(SOURCE, `기상청 API 오류: ${header.resultCode} ${header.resultMsg}`);
    }

    const v: Record<string, string> = {};
    for (const it of body.items.item) v[it.category] = it.obsrValue;
    const num = (k: string) => (v[k] === undefined || Number(v[k]) <= -900 ? null : Number(v[k]));

    return {
      observedAt: `${baseDate.slice(0, 4)}-${baseDate.slice(4, 6)}-${baseDate.slice(6)}T${baseTime.slice(0, 2)}:00:00+09:00`,
      temperature: num("T1H"),
      humidity: num("REH"),
      windSpeed: num("WSD"),
      rain1h: num("RN1"),
      precipitationType: PTY[v.PTY ?? "0"] ?? "알 수 없음",
      grid,
    };
  });
}

// ───────────────────────── 단기예보 (getVilageFcst) ─────────────────────────

const FCST_SOURCE = "기상청 단기예보";

/** 단기예보 발표시각(KST). 각 발표는 약 10분 뒤부터 API로 제공됨 */
const ISSUE_HOURS = [2, 5, 8, 11, 14, 17, 20, 23];
const ISSUE_DELAY_MIN = 15; // 제공 지연(약 10분) + 여유

const pad = (n: number) => String(n).padStart(2, "0");

/** 지금 받을 수 있는 가장 최근 발표시각부터 과거 순으로 후보 n개 */
export function issueCandidates(now = new Date(), n = 3) {
  // KST 벽시계를 UTC 필드로 다루기 위해 +9h 이동
  const kst = new Date(now.getTime() + 9 * 3600_000 - ISSUE_DELAY_MIN * 60_000);
  const out: { baseDate: string; baseTime: string }[] = [];
  const d = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate(), kst.getUTCHours()));
  while (out.length < n) {
    if (ISSUE_HOURS.includes(d.getUTCHours())) {
      out.push({
        baseDate: `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`,
        baseTime: `${pad(d.getUTCHours())}00`,
      });
    }
    d.setUTCHours(d.getUTCHours() - 1);
  }
  return out;
}

const toIso = (date: string, time: string) =>
  `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${time.slice(0, 2)}:${time.slice(2, 4)}:00+09:00`;

const SKY: Record<string, string> = { "1": "맑음", "3": "구름많음", "4": "흐림" };

type FcstItem = { category: string; fcstDate: string; fcstTime: string; fcstValue: string; baseDate: string; baseTime: string };
type FcstResponse = {
  response: {
    header: { resultCode: string; resultMsg: string };
    body?: { totalCount: number; items: { item: FcstItem[] } };
  };
};

async function fetchForecast(key: string, grid: { nx: number; ny: number }, base: { baseDate: string; baseTime: string }) {
  const params = new URLSearchParams({
    pageNo: "1",
    // 항목 12종 × 1시간 간격 → 300행이면 발표 후 약 24시간 분량
    numOfRows: "300",
    dataType: "JSON",
    base_date: base.baseDate,
    base_time: base.baseTime,
    nx: String(grid.nx),
    ny: String(grid.ny),
  });
  const url = `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst?serviceKey=${encodeServiceKey(key)}&${params}`;
  const json = await fetchJson<FcstResponse>(FCST_SOURCE, url);
  const { header, body } = json.response;
  if (header.resultCode === "03") return null; // NO_DATA: 아직 발표 전 → 이전 발표로
  if (header.resultCode !== "00" || !body) {
    throw new UpstreamError(FCST_SOURCE, `기상청 API 오류: ${header.resultCode} ${header.resultMsg}`);
  }
  return body.items.item;
}

/** 출발지 좌표 → 격자 변환 → 최신 단기예보에서 현재 시각 이후 hoursAhead시간 */
export async function getShortTermForecast(lat: number, lng: number, hoursAhead = 12): Promise<ShortTermForecast> {
  const full = await getLatestForecast(toKmaGrid(lat, lng));
  // 현재 '시' 이후 예보만 (지난 예보시각 제외) — 캐시 밖에서 매 요청마다 계산
  const nowHour = Math.floor(Date.now() / 3600_000) * 3600_000;
  return {
    ...full,
    hours: full.hours.filter((h) => new Date(h.forecastAt).getTime() >= nowHour).slice(0, hoursAhead),
  };
}

/** 격자별 최신 발표분 전체(약 24시간). 발표 단위로 캐시 */
function getLatestForecast(grid: { nx: number; ny: number }): Promise<ShortTermForecast> {
  const key = getSecret("DATA_GO_KR_API_KEY");
  const candidates = issueCandidates();

  return cached(`kma:fcst:${grid.nx},${grid.ny}:${candidates[0].baseDate}${candidates[0].baseTime}`, 30 * 60_000, async () => {
    for (const base of candidates) {
      const items = await fetchForecast(key, grid, base);
      if (!items || items.length === 0) continue;

      // 예보시각별로 항목 묶기
      const byTime = new Map<string, Record<string, string>>();
      for (const it of items) {
        const t = toIso(it.fcstDate, it.fcstTime);
        const row = byTime.get(t) ?? {};
        row[it.category] = it.fcstValue;
        byTime.set(t, row);
      }

      const num = (v: string | undefined) => (v === undefined || v === "" || Number(v) <= -900 ? null : Number(v));
      const hours: ForecastHour[] = [...byTime.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([t, v]) => ({
          forecastAt: t,
          temperature: num(v.TMP),
          pop: num(v.POP),
          precipitationType: PTY[v.PTY ?? "0"] ?? "알 수 없음",
          precipitation: v.PCP ?? null,
          sky: v.SKY ? (SKY[v.SKY] ?? null) : null,
          humidity: num(v.REH),
          windSpeed: num(v.WSD),
        }));

      return { issuedAt: toIso(base.baseDate, base.baseTime), grid, hours };
    }
    throw new UpstreamError(FCST_SOURCE, "최근 발표된 단기예보를 찾지 못했습니다.");
  });
}
