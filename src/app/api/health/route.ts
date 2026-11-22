import { connection } from "next/server";
import { isConfigured, seoulAllowHttp } from "@/lib/server/env";

// GET /api/health — 키 값은 절대 반환하지 않고 설정 여부만 알려 줌
export async function GET() {
  await connection(); // 빌드 시점 값이 아니라 실행 중인 서버의 설정을 보고
  return Response.json({
    ok: true,
    configured: {
      SEOUL_API_KEY: isConfigured("SEOUL_API_KEY"),
      DATA_GO_KR_API_KEY: isConfigured("DATA_GO_KR_API_KEY"),
      KAKAO_REST_API_KEY: isConfigured("KAKAO_REST_API_KEY"),
      NEXT_PUBLIC_KAKAO_JS_KEY: Boolean(process.env.NEXT_PUBLIC_KAKAO_JS_KEY),
      SEOUL_ALLOW_HTTP: seoulAllowHttp(),
    },
  });
}
