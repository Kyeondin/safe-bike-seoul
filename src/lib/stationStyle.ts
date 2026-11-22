// 대여 가능 대수에 따른 표시 등급 (목록과 지도 마커가 같은 기준을 쓰도록 공유)
export type Availability = "none" | "low" | "ok";

export function availabilityOf(bikes: number): Availability {
  if (bikes <= 0) return "none";
  if (bikes <= 2) return "low";
  return "ok";
}

export const AVAILABILITY_STYLE: Record<Availability, { label: string; text: string; marker: string; markerSelected: string }> = {
  none: {
    label: "대여 불가",
    text: "text-slate-400",
    marker: "border-slate-400 bg-slate-100 text-slate-500",
    markerSelected: "border-white bg-slate-600 text-white",
  },
  low: {
    label: "잔여 적음",
    text: "text-amber-600",
    marker: "border-amber-500 bg-white text-amber-700",
    markerSelected: "border-white bg-amber-600 text-white",
  },
  ok: {
    label: "대여 가능",
    text: "text-emerald-600",
    marker: "border-emerald-600 bg-white text-emerald-700",
    markerSelected: "border-white bg-emerald-700 text-white",
  },
};

export function formatDistance(m: number) {
  return m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`;
}
