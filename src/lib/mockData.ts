// ⚠️ 가상(예시) 자전거 경로.
// 카카오모빌리티 자전거 길찾기 API는 제휴 전용이라 권한이 없어, 출발·도착을 잇는 곡선을 임의로 만든다.
// 실제 도로·자전거도로를 따르지 않으며, 거리·시간도 이 곡선 기준의 참고값이다.
// 안전성(자전거도로 비율, 안전 점수 등)은 근거 데이터가 없으므로 만들지 않는다.

export type LatLng = { lat: number; lng: number };

export type RouteInfo = {
  isSample: true;
  path: LatLng[];
  /** 예시 곡선 경로 길이 */
  distanceKm: number;
  /** 출발·도착 직선거리 */
  straightKm: number;
  /** 예시 경로 길이 ÷ 평균 15km/h */
  durationMin: number;
};

export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// 같은 입력에는 항상 같은 값을 주는 간단한 의사난수 (렌더링마다 경로가 바뀌지 않도록)
function seeded(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function seedOf(a: LatLng, b: LatLng) {
  return Math.floor((a.lat * 1000 + a.lng * 100 + b.lat * 10 + b.lng) * 1000);
}

/** 직선 대신 살짝 휘어진 가상 경로 */
export function buildMockRoute(origin: LatLng, dest: LatLng): RouteInfo {
  const steps = 24;
  const rand = seeded(seedOf(origin, dest));
  const dLat = dest.lat - origin.lat;
  const dLng = dest.lng - origin.lng;
  const bend = 0.18 * (rand() > 0.5 ? 1 : -1);

  const path: LatLng[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const curve = Math.sin(Math.PI * t) * bend;
    const jitter = i === 0 || i === steps ? 0 : (rand() - 0.5) * 0.0015;
    path.push({
      lat: origin.lat + dLat * t - dLng * curve + jitter,
      lng: origin.lng + dLng * t + dLat * curve + jitter,
    });
  }

  let total = 0;
  for (let i = 1; i < path.length; i++) total += distanceKm(path[i - 1], path[i]);

  return {
    isSample: true,
    path,
    distanceKm: round(total, 1),
    straightKm: round(distanceKm(origin, dest), 1),
    durationMin: Math.max(1, Math.round((total / 15) * 60)),
  };
}

function round(n: number, digits: number) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
