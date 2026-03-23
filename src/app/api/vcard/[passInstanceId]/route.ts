import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { generateVCard } from "@/lib/vcard"
import { parseBusinessCardConfig } from "@/lib/pass-config"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ passInstanceId: string }> }
) {
  const { passInstanceId } = await params

  const passInstance = await db.passInstance.findUnique({
    where: { id: passInstanceId },
    select: {
      id: true,
      passTemplate: {
        select: {
          passType: true,
          config: true,
          organization: {
            select: { name: true },
          },
        },
      },
    },
  })

  if (!passInstance || passInstance.passTemplate.passType !== "BUSINESS_CARD") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const config = parseBusinessCardConfig(passInstance.passTemplate.config)
  if (!config) {
    return NextResponse.json({ error: "Invalid config" }, { status: 500 })
  }

  const vcf = generateVCard({
    config,
    organizationName: passInstance.passTemplate.organization.name,
  })

  const filename = `${config.contactName.replace(/[^a-zA-Z0-9]/g, "_")}.vcf`

  return new NextResponse(vcf, {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
