import { connection, type NextRequest } from "next/server";
import { fail, latLngParams, numberParam, ok } from "@/lib/server/http";
import { getNearbyStations } from "@/lib/server/seoulBike";

// GET /api/stations?lat=37.5444&lng=127.0374&radius=800&limit=20
export async function GET(req: NextRequest) {
  await connection(); // 요청 시점에만 실행 (빌드 시 프리렌더 제외)
  try {
    const p = req.nextUrl.searchParams;
    const center = latLngParams(p);
    const radius = numberParam(p, "radius", { min: 50, max: 3000, fallback: 800 });
    const limit = numberParam(p, "limit", { min: 1, max: 100, fallback: 20 });
    const { fetchedAt, total, stations } = await getNearbyStations(center, radius, limit);
    return ok(stations, { source: "서울시 공공자전거 실시간 대여정보", fetchedAt, total, cacheSeconds: 60 });
  } catch (err) {
    return fail(err);
  }
}
