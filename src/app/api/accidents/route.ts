import { connection, type NextRequest } from "next/server";
import { CRITERIA, getAccidentSpots } from "@/lib/server/accidents";
import { fail, latLngParams, numberParam, ok } from "@/lib/server/http";

// GET /api/accidents?lat=37.5444&lng=127.0374&radius=2000   (반경 내)
// GET /api/accidents?district=강남구                         (자치구별)
// GET /api/accidents                                         (서울 전체)
export async function GET(req: NextRequest) {
  await connection(); // 요청 시점에만 실행 (빌드 시 프리렌더 제외)
  try {
    const p = req.nextUrl.searchParams;
    const near = p.has("lat") || p.has("lng") ? latLngParams(p) : undefined;
    const radiusM = numberParam(p, "radius", { min: 100, max: 10000, fallback: 2000 });
    const district = p.get("district")?.trim() || undefined;
    const { accidentYear, checkedYears, spots } = await getAccidentSpots({ near, radiusM, district });
    return ok(spots, {
      source: "한국도로교통공단 자전거 교통사고 다발지역",
      accidentYear,
      checkedYears,
      criteria: CRITERIA,
      isHistorical: true,
    });
  } catch (err) {
    return fail(err);
  }
}
