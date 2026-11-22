import "server-only";
import { getSecret } from "./env";
import { cached, fetchJson, UpstreamError } from "./http";
import type { BikeRoute, BikeRouteResult } from "@/lib/types";

// 카카오 자전거 경로 (dapi.kakao.com/v2/routing/bicycle)
// ⚠️ 카카오 개발자 공개 문서에서 확인되지 않은 엔드포인트입니다. (2026-11 실측 기준)
// - 파라미터: start_x, start_y, end_x, end_y (경도 x, 위도 y)
// - 응답 경로는 1개. priority 등 경로 옵션을 바꿔도 결과가 같아서
//   '자전거도로 우선'과 '최단' 경로를 구분할 수 없음 → 옵션별로 요청해 실제로 다를 때만 둘 다 반환.

const SOURCE = "카카오 자전거 경로";
const ENDPOINT = "https://dapi.kakao.com/v2/routing/bicycle";

type KakaoBikeResponse = {
  status?: string;
  route?: {
    properties?: { totalDistance: number; totalTime: number; landingUrl?: string };
    legs: {
      properties: { distance: number; time: number };
      steps: {
        path: { points: [number, number][] };
        properties: { distance: number; time: number; guidance: string };
      }[];
    }[];
  };
};

const OPTIONS = [
  { id: "BIKE_ROAD", label: "자전거도로 우선" },
  { id: "DISTANCE", label: "최단 거리" },
] as const;

async function request(from: { lat: number; lng: number }, to: { lat: number; lng: number }, priority: string) {
  const key = getSecret("KAKAO_REST_API_KEY");
  const params = new URLSearchParams({
    start_x: String(from.lng),
    start_y: String(from.lat),
    end_x: String(to.lng),
    end_y: String(to.lat),
    priority,
  });
  const json = await fetchJson<KakaoBikeResponse>(SOURCE, `${ENDPOINT}?${params}`, {
    headers: { Authorization: `KakaoAK ${key}` },
    timeoutMs: 10_000,
  });
  const route = json.route;
  if (!route?.legs?.length) {
    throw new UpstreamError(SOURCE, `경로를 찾지 못했습니다${json.status ? ` (status: ${json.status})` : ""}.`, 404);
  }

  const path: { lat: number; lng: number }[] = [];
  const steps: BikeRoute["steps"] = [];
  for (const leg of route.legs) {
    for (const step of leg.steps) {
      for (const [x, y] of step.path?.points ?? []) {
        const last = path.at(-1);
        if (!last || last.lat !== y || last.lng !== x) path.push({ lat: y, lng: x });
      }
      steps.push({ guidance: step.properties.guidance, distanceM: step.properties.distance, durationS: step.properties.time });
    }
  }
  const distanceM = route.properties?.totalDistance ?? route.legs.reduce((s, l) => s + l.properties.distance, 0);
  const durationS = route.properties?.totalTime ?? route.legs.reduce((s, l) => s + l.properties.time, 0);
  return { distanceM, durationS, path, steps, landingUrl: route.properties?.landingUrl ?? null };
}

/** 같은 경로인지: 거리·시간·좌표 수가 모두 같으면 동일로 봄 */
const sameRoute = (a: { distanceM: number; durationS: number; path: unknown[] }, b: typeof a) =>
  a.distanceM === b.distanceM && a.durationS === b.durationS && a.path.length === b.path.length;

export function getBikeRoutes(from: { lat: number; lng: number }, to: { lat: number; lng: number }): Promise<BikeRouteResult> {
  const r6 = (n: number) => n.toFixed(6);
  return cached(`kakao:bike:${r6(from.lat)},${r6(from.lng)}>${r6(to.lat)},${r6(to.lng)}`, 10 * 60_000, async () => {
    const results = await Promise.all(OPTIONS.map((o) => request(from, to, o.id)));
    const optionsDiffer = !sameRoute(results[0], results[1]);
    const toRoute = ({ distanceM, durationS, path, steps }: (typeof results)[number], id: string, label: string): BikeRoute => ({
      id,
      label,
      distanceM,
      durationS,
      path,
      steps,
    });
    const routes = optionsDiffer
      ? results.map((r, i) => toRoute(r, OPTIONS[i].id, OPTIONS[i].label))
      : [toRoute(results[0], "KAKAO", "카카오 자전거 경로")];
    return {
      from,
      to,
      routes,
      optionsDiffer,
      fetchedAt: new Date().toISOString(),
      landingUrl: results[0].landingUrl,
    };
  });
}
