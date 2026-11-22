import { connection, type NextRequest } from "next/server";
import { BadRequestError, fail, ok } from "@/lib/server/http";
import { searchPlaces } from "@/lib/server/kakaoLocal";

// GET /api/search?q=서울숲
export async function GET(req: NextRequest) {
  await connection(); // 요청 시점에만 실행 (빌드 시 프리렌더 제외)
  try {
    const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
    if (!q) throw new BadRequestError("'q' 파라미터가 필요합니다.");
    if (q.length > 50) throw new BadRequestError("검색어는 50자 이하여야 합니다.");
    return ok(await searchPlaces(q), { source: "카카오 로컬" });
  } catch (err) {
    return fail(err);
  }
}
