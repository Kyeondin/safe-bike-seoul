import "server-only";
import { ConfigError, getSecret, seoulAllowHttp } from "./env";
import { cached, fetchJson, haversineM, seoulErrorMessage, UpstreamError } from "./http";
import type { BikeStation, NearbyStation } from "@/lib/types";

// 서울시 공공자전거 실시간 대여정보 (bikeList)
// 서울 열린데이터광장 OpenAPI(openapi.seoul.go.kr:8088)는 HTTP만 지원하므로
// 인증키가 평문으로 전송됩니다. SEOUL_ALLOW_HTTP=true일 때만 호출합니다. (서버→서울시 구간에만 해당)

type BikeListResponse = {
  rentBikeStatus?: {
    list_total_count: number;
    RESULT: { CODE: string; MESSAGE: string };
    row: {
      stationId: string;
      stationName: string;
      stationLatitude: string;
      stationLongitude: string;
      parkingBikeTotCnt: string;
      rackTotCnt: string;
      shared: string;
    }[];
  };
  RESULT?: { CODE: string; MESSAGE: string };
};

const PAGE = 1000;
const SOURCE = "서울시 따릉이";

async function fetchPage(key: string, start: number) {
  const url = `http://openapi.seoul.go.kr:8088/${encodeURIComponent(key)}/json/bikeList/${start}/${start + PAGE - 1}/`;
  const json = await fetchJson<BikeListResponse>(SOURCE, url);
  const result = json.rentBikeStatus?.RESULT ?? json.RESULT;
  if (result?.CODE === "INFO-200") return { rows: [], total: 0 }; // 해당 범위 데이터 없음
  if (!json.rentBikeStatus || result?.CODE !== "INFO-000") {
    throw new UpstreamError(SOURCE, seoulErrorMessage(result?.CODE ?? "UNKNOWN", result?.MESSAGE ?? ""));
  }
  return { rows: json.rentBikeStatus.row, total: json.rentBikeStatus.list_total_count };
}

export function getAllStations(): Promise<{ fetchedAt: string; stations: BikeStation[] }> {
  if (!seoulAllowHttp()) {
    throw new ConfigError("서울시 OpenAPI는 HTTP 전용입니다. 허용하려면 SEOUL_ALLOW_HTTP=true로 설정하세요.");
  }
  const key = getSecret("SEOUL_API_KEY");

  // 실시간 데이터지만 호출 한도를 고려해 60초 캐시
  return cached("seoul:bikeList", 60_000, async () => {
    const rows: NonNullable<BikeListResponse["rentBikeStatus"]>["row"] = [];
    // 전체 대여소(약 2,700~3,000개)를 1,000개씩 순차 조회
    for (let start = 1; start < 10_000; start += PAGE) {
      const page = await fetchPage(key, start);
      rows.push(...page.rows);
      if (page.rows.length < PAGE) break;
    }
    const stations = rows.map((r) => ({
      id: r.stationId,
      name: r.stationName.replace(/^\d+\.\s*/, ""),
      lat: Number(r.stationLatitude),
      lng: Number(r.stationLongitude),
      bikes: Number(r.parkingBikeTotCnt),
      docks: Number(r.rackTotCnt),
      sharedRate: Number(r.shared),
    }));
    // 좌표가 비정상인 대여소(0,0 등) 제외
    return {
      fetchedAt: new Date().toISOString(),
      stations: stations.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng) && s.lat > 33 && s.lng > 124),
    };
  });
}

export async function getNearbyStations(
  center: { lat: number; lng: number },
  radiusM: number,
  limit: number,
): Promise<{ fetchedAt: string; total: number; stations: NearbyStation[] }> {
  const { fetchedAt, stations } = await getAllStations();
  const nearby = stations
    .map((s) => ({ ...s, distanceM: haversineM(center, s) }))
    .filter((s) => s.distanceM <= radiusM)
    .sort((a, b) => a.distanceM - b.distanceM);
  return { fetchedAt, total: nearby.length, stations: nearby.slice(0, limit) };
}
