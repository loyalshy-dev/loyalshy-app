import { NextResponse } from "next/server"
import { buildOpenApiSpec } from "@/lib/api-openapi"

export async function GET() {
  const spec = buildOpenApiSpec()
  return NextResponse.json(spec, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  })
}
