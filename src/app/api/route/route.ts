import { connection, type NextRequest } from "next/server";
import { fail, numberParam } from "@/lib/server/http";
import { buildMockRoute } from "@/lib/mockData";

// GET /api/route?fromLat=..&fromLng=..&toLat=..&toLng=..
// ⚠️ 카카오 공개 API에는 자전거 길찾기가 없어 현재는 가상 경로를 반환합니다 (isSample: true).
export async function GET(req: NextRequest) {
  await connection(); // 요청 시점에만 실행 (빌드 시 프리렌더 제외)
  try {
    const p = req.nextUrl.searchParams;
    const lat = { min: 37.2, max: 37.92 };
    const lng = { min: 126.55, max: 127.4 };
    const from = { lat: numberParam(p, "fromLat", lat), lng: numberParam(p, "fromLng", lng) };
    const to = { lat: numberParam(p, "toLat", lat), lng: numberParam(p, "toLng", lng) };
    return Response.json({
      ok: true,
      isSample: true,
      source: "가상 경로 (예시 데이터)",
      data: buildMockRoute(from, to),
    });
  } catch (err) {
    return fail(err);
  }
}
