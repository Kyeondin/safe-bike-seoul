import "server-only";
import { getSecret } from "./env";
import { cached, encodeServiceKey, fetchJson, haversineM, UpstreamError } from "./http";
import type { AccidentSpot } from "@/lib/types";

// 한국도로교통공단 - 자전거 교통사고 다발지역 정보 (공공데이터포털 B552061/frequentzoneBicycle)

const SOURCE = "도로교통공단 자전거 사고다발지역";

// 서울특별시(siDo=11) 자치구 코드 (TAAS 코드 체계)
export const SEOUL_GUGUN: Record<string, string> = {
  종로구: "110", 중구: "140", 용산구: "170", 성동구: "200", 광진구: "215",
  동대문구: "230", 중랑구: "260", 성북구: "290", 강북구: "305", 도봉구: "320",
  노원구: "350", 은평구: "380", 서대문구: "410", 마포구: "440", 양천구: "470",
  강서구: "500", 구로구: "530", 금천구: "545", 영등포구: "560", 동작구: "590",
  관악구: "620", 서초구: "650", 강남구: "680", 송파구: "710", 강동구: "740",
};

type KoroadItem = {
  afos_fid: string;
  spot_nm: string;
  sido_sgg_nm: string;
  occrrnc_cnt: number;
  caslt_cnt: number;
  dth_dnv_cnt: number;
  se_dnv_cnt: number;
  sl_dnv_cnt: number;
  wnd_dnv_cnt: number;
  la_crd: string;
  lo_crd: string;
  geom_json?: string;
};

type KoroadResponse = {
  resultCode: string;
  resultMsg: string;
  totalCount?: number;
  items?: { item: KoroadItem[] | KoroadItem } | "";
};


function severityOf(it: KoroadItem): AccidentSpot["severity"] {
  if (it.dth_dnv_cnt > 0 || it.se_dnv_cnt >= 3 || it.occrrnc_cnt >= 8) return "high";
  if (it.se_dnv_cnt > 0 || it.occrrnc_cnt >= 5) return "medium";
  return "low";
}

async function fetchGu(key: string, year: number, gugun: string): Promise<KoroadItem[]> {
  const params = new URLSearchParams({
    searchYearCd: String(year),
    siDo: "11",
    guGun: gugun,
    type: "json",
    numOfRows: "100",
    pageNo: "1",
  });
  const url = `https://apis.data.go.kr/B552061/frequentzoneBicycle/getRestFrequentzoneBicycle?serviceKey=${encodeServiceKey(key)}&${params}`;
  const json = await fetchJson<KoroadResponse>(SOURCE, url, { timeoutMs: 10_000 });
  if (json.resultCode === "03") return []; // NODATA
  if (json.resultCode !== "00") throw new UpstreamError(SOURCE, `도로교통공단 API 오류: ${json.resultCode} ${json.resultMsg}`);
  const item = json.items ? json.items.item : [];
  return Array.isArray(item) ? item : [item];
}

export const CRITERIA = "1년간 발생한 자전거 관련 사고 중 반경 200m 내 4건 이상(사망사고 포함 시 3건 이상) 발생 지점";

function parsePolygon(geom?: string): { lat: number; lng: number }[] {
  if (!geom) return [];
  try {
    const g = JSON.parse(geom) as { type: string; coordinates: number[][][] };
    if (g.type !== "Polygon" || !g.coordinates?.[0]) return [];
    // 원형(반경 200m) 폴리곤이라 점을 절반으로 줄이고 좌표는 소수 6자리(≈0.1m)로 반올림해 응답 크기 축소
    const r6 = (n: number) => Math.round(n * 1e6) / 1e6;
    return g.coordinates[0].filter((_, i, arr) => i % 2 === 0 || i === arr.length - 1).map(([lng, lat]) => ({ lat: r6(lat), lng: r6(lng) }));
  } catch {
    return [];
  }
}

function toSpot(it: KoroadItem): AccidentSpot {
  return {
    id: String(it.afos_fid),
    name: it.spot_nm,
    district: it.sido_sgg_nm.replace(/\d+$/, ""), // "서울 강남구1" → "서울 강남구"
    lat: Number(it.la_crd),
    lng: Number(it.lo_crd),
    accidents: it.occrrnc_cnt,
    casualties: it.caslt_cnt,
    deaths: it.dth_dnv_cnt,
    seriousInjuries: it.se_dnv_cnt,
    minorInjuries: it.sl_dnv_cnt,
    injuryReports: it.wnd_dnv_cnt,
    severity: severityOf(it),
    polygon: parsePolygon(it.geom_json),
  };
}

type SeoulAccidents = { accidentYear: number; checkedYears: { year: number; spots: number }[]; spots: AccidentSpot[] };

/**
 * 서울 전체 자치구의 사고다발지역. 올해부터 거꾸로 조회해 데이터가 있는 가장 최근 기준연도를 사용.
 * (2026-11 확인: searchYearCd 2026은 NODATA, 2025가 최신 — 전년도 사고를 이듬해 분석·공개)
 * 연 단위 통계라 하루 캐시.
 */
export function getSeoulAccidentSpots(): Promise<SeoulAccidents> {
  const key = getSecret("DATA_GO_KR_API_KEY");
  return cached("koroad:seoul:v3", 24 * 3600_000, async () => {
    const thisYear = new Date().getFullYear();
    const checkedYears: SeoulAccidents["checkedYears"] = [];
    for (let year = thisYear; year >= thisYear - 4; year--) {
      const perGu = await Promise.all(Object.values(SEOUL_GUGUN).map((code) => fetchGu(key, year, code)));
      const items = perGu.flat();
      checkedYears.push({ year, spots: items.length });
      if (items.length > 0) return { accidentYear: year, checkedYears, spots: items.map(toSpot) };
    }
    throw new UpstreamError(SOURCE, `최근 5년(${thisYear - 4}~${thisYear}) 서울 자전거 사고다발지역 데이터가 없습니다.`);
  });
}

export async function getAccidentSpots(filter: { district?: string; near?: { lat: number; lng: number }; radiusM?: number }) {
  const { spots, ...meta } = await getSeoulAccidentSpots();
  let out: (AccidentSpot & { distanceM?: number })[] = spots;
  if (filter.district) out = out.filter((s) => s.district.includes(filter.district!));
  if (filter.near) {
    const near = filter.near;
    out = out
      .map((s) => ({ ...s, distanceM: haversineM(near, s) }))
      .filter((s) => s.distanceM <= (filter.radiusM ?? 2000))
      .sort((a, b) => a.distanceM - b.distanceM);
  }
  return { ...meta, spots: out };
}
