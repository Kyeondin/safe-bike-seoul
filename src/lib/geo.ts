export type LatLngLike = { lat: number; lng: number };

const M_PER_DEG_LAT = 111_320;

/** 점과 폴리라인 사이의 최단 거리(m). 서울 규모에서는 등장방형 근사로 충분히 정확 */
export function distanceToPathM(p: LatLngLike, path: LatLngLike[]): number {
  if (path.length === 0) return Infinity;
  const kx = M_PER_DEG_LAT * Math.cos((p.lat * Math.PI) / 180);
  const toXY = (q: LatLngLike) => [(q.lng - p.lng) * kx, (q.lat - p.lat) * M_PER_DEG_LAT] as const;

  let best = Infinity;
  for (let i = 0; i < path.length; i++) {
    const [ax, ay] = toXY(path[i]);
    if (i === path.length - 1) {
      best = Math.min(best, Math.hypot(ax, ay));
      break;
    }
    const [bx, by] = toXY(path[i + 1]);
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return Math.round(best);
}
