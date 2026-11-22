import { connection, type NextRequest } from "next/server";
import { BadRequestError, fail, numberParam, ok } from "@/lib/server/http";
import { getBikeRoutes } from "@/lib/server/kakaoBike";

// GET /api/route?fromLat=..&fromLng=..&toLat=..&toLng=..
// 카카오 자전거 경로. 실패 시 { ok:false, error, upstream:{status,message} } — 가상 경로를 만들지 않음
export async function GET(req: NextRequest) {
  await connection(); // 요청 시점에만 실행 (빌드 시 프리렌더 제외)
  try {
    const p = req.nextUrl.searchParams;
    const lat = { min: 37.2, max: 37.92 };
    const lng = { min: 126.55, max: 127.4 };
    const from = { lat: numberParam(p, "fromLat", lat), lng: numberParam(p, "fromLng", lng) };
    const to = { lat: numberParam(p, "toLat", lat), lng: numberParam(p, "toLng", lng) };
    if (from.lat === to.lat && from.lng === to.lng) throw new BadRequestError("출발지와 목적지가 같습니다.");
    return ok(await getBikeRoutes(from, to), { source: "카카오 자전거 경로" });
  } catch (err) {
    return fail(err);
  }
}
