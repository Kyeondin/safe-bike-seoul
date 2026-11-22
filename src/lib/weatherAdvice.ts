import type { CurrentWeather, ForecastHour } from "@/lib/types";

/** 기상청 겨울철 체감온도(Wind Chill). 기온 10℃ 이하·풍속 1.3m/s 이상일 때만 적용 */
export function feelsLike(tempC: number | null, windMs: number | null): number | null {
  if (tempC === null) return null;
  if (windMs === null || tempC > 10 || windMs < 1.3) return tempC;
  const v = Math.pow(windMs * 3.6, 0.16);
  return Math.round((13.12 + 0.6215 * tempC - 11.37 * v + 0.3965 * v * tempC) * 10) / 10;
}

export function weatherIcon(w: CurrentWeather) {
  const t = w.precipitationType;
  if (t.includes("눈")) return "🌨️";
  if (t.includes("비") || t.includes("빗방울")) return "🌧️";
  return "🌡️"; // 초단기실황에는 하늘 상태가 없어 강수 여부만 표시
}

export type Advice = { level: "good" | "caution" | "danger"; text: string };

/** 단기예보 하늘상태·강수형태 아이콘 */
export function forecastIcon(h: ForecastHour) {
  const t = h.precipitationType;
  if (t.includes("눈")) return "🌨️";
  if (t !== "없음") return "🌧️";
  if (h.sky === "흐림") return "☁️";
  // 예보시각(KST)이 밤(19~06시)이면 달 아이콘
  const hour = Number(h.forecastAt.slice(11, 13));
  const night = hour >= 19 || hour < 7;
  if (h.sky === "구름많음") return night ? "☁️" : "⛅";
  return night ? "🌙" : "☀️";
}

/** 자전거 주행 관점의 간단한 안내 (앱 자체 기준, 기상청 공식 특보 아님) */
export function ridingAdvice(w: CurrentWeather, upcoming: ForecastHour[] = []): Advice[] {
  const out: Advice[] = [];
  // 앞으로 3시간 예보 중 강수확률이 가장 높은 시각
  const soon = upcoming.slice(0, 3).reduce<ForecastHour | null>((m, h) => ((h.pop ?? 0) > (m?.pop ?? -1) ? h : m), null);
  if (soon?.pop !== null && soon?.pop !== undefined && soon.pop >= 60 && w.precipitationType === "없음") {
    out.push({ level: "caution", text: `3시간 안에 비·눈 가능성이 높아요(강수확률 ${soon.pop}%). 우비를 챙기세요.` });
  } else if (soon?.pop !== null && soon?.pop !== undefined && soon.pop >= 30 && w.precipitationType === "없음") {
    out.push({ level: "caution", text: `3시간 안에 강수확률 ${soon.pop}% — 하늘을 살피며 이동하세요.` });
  }
  const t = w.temperature;
  const wind = w.windSpeed ?? 0;
  const rain = w.rain1h ?? 0;

  if (w.precipitationType !== "없음" || rain > 0) {
    out.push({ level: "danger", text: `${w.precipitationType} — 노면이 미끄럽고 시야가 나빠요. 가급적 주행을 피하세요.` });
  }
  if (wind >= 9) out.push({ level: "danger", text: `강풍(${wind}m/s) — 자전거가 크게 흔들릴 수 있어요.` });
  else if (wind >= 5) out.push({ level: "caution", text: `바람이 강해요(${wind}m/s). 한강변·교량 구간 맞바람에 주의하세요.` });
  if (t !== null && t <= 0) out.push({ level: "danger", text: "영하권 — 그늘진 곳·교량 노면 결빙에 주의하세요." });
  else if (t !== null && t <= 5) out.push({ level: "caution", text: "쌀쌀해요. 장갑과 방풍 재킷을 챙기세요." });
  if (t !== null && t >= 33) out.push({ level: "danger", text: "폭염 수준 — 장시간 주행을 피하고 수분을 보충하세요." });
  else if (t !== null && t >= 28) out.push({ level: "caution", text: "더워요. 물을 챙기고 그늘에서 자주 쉬세요." });

  if (out.length === 0) out.push({ level: "good", text: "자전거 타기 좋은 날씨예요." });
  return out;
}
