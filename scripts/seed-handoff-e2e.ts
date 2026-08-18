import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { hashPassword } from "better-auth/crypto"
import { config } from "dotenv"

config({ path: "/Users/themorell99/Desktop/loyalshy/loyalshy-app/.env.local" })

async function ensureUser(
  db: PrismaClient,
  opts: { name: string; email: string; password: string; isPartner: boolean }
) {
  let user = await db.user.findUnique({ where: { email: opts.email } })
  if (!user) {
    user = await db.user.create({
      data: {
        name: opts.name,
        email: opts.email,
        emailVerified: true,
        isPartner: opts.isPartner,
      },
    })
    await db.account.create({
      data: {
        userId: user.id,
        providerId: "credential",
        accountId: user.id,
        password: await hashPassword(opts.password),
      },
    })
  } else {
    await db.user.update({
      where: { id: user.id },
      data: { isPartner: opts.isPartner, emailVerified: true },
    })
  }
  return user
}

async function main() {
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  })

  const rep = await ensureUser(db, {
    name: "Agency Rep",
    email: "rep@agency.test",
    password: "partner1234",
    isPartner: true,
  })

  await ensureUser(db, {
    name: "Café Owner",
    email: "owner@cafe.test",
    password: "cafeowner1234",
    isPartner: false,
  })

  // The rep needs a home org to reach the dashboard
  const homeMembership = await db.member.findFirst({ where: { userId: rep.id } })
  if (!homeMembership) {
    const org = await db.organization.create({
      data: {
        name: "Agency HQ",
        slug: `agency-hq-${Date.now().toString(36)}`,
        plan: "FREE",
        subscriptionStatus: "ACTIVE",
        settings: { onboardingComplete: true },
      },
    })
    await db.member.create({
      data: { userId: rep.id, organizationId: org.id, role: "owner" },
    })
    console.log("Created Agency HQ home org for rep")
  }

  console.log("E2E users ready: rep@agency.test / partner1234, owner@cafe.test / cafeowner1234")
  await db.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
