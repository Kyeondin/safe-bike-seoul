import { connection, type NextRequest } from "next/server";
import { fail, latLngParams, numberParam, ok } from "@/lib/server/http";
import { getShortTermForecast } from "@/lib/server/weather";

// GET /api/forecast?lat=37.5444&lng=127.0374&hours=12
// 출발지 좌표 → 기상청 격자(nx, ny) 변환 → 최신 단기예보의 시간별 기온·강수확률
export async function GET(req: NextRequest) {
  await connection(); // 요청 시점에만 실행 (빌드 시 프리렌더 제외)
  try {
    const p = req.nextUrl.searchParams;
    const { lat, lng } = latLngParams(p);
    const hours = numberParam(p, "hours", { min: 1, max: 24, fallback: 12 });
    return ok(await getShortTermForecast(lat, lng, hours), { source: "기상청 단기예보" });
  } catch (err) {
    return fail(err);
  }
}
