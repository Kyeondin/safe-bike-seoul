import { connection, type NextRequest } from "next/server";
import { fail, latLngParams, ok } from "@/lib/server/http";
import { getCurrentWeather } from "@/lib/server/weather";

// GET /api/weather?lat=37.5444&lng=127.0374
export async function GET(req: NextRequest) {
  await connection(); // 요청 시점에만 실행 (빌드 시 프리렌더 제외)
  try {
    const { lat, lng } = latLngParams(req.nextUrl.searchParams);
    return ok(await getCurrentWeather(lat, lng), { source: "기상청 초단기실황" });
  } catch (err) {
    return fail(err);
  }
}
