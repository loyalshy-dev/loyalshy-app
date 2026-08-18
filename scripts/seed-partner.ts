import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { hashPassword } from "better-auth/crypto"
import { config } from "dotenv"

config({ path: "/Users/themorell99/Desktop/loyalshy/loyalshy-app/.env.local" })

async function main() {
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  })

  const email = "rep@agency.test"
  const password = "partner1234"

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    await db.user.update({ where: { id: existing.id }, data: { isPartner: true } })
    console.log("Partner rep already exists — ensured isPartner=true:", email)
    await db.$disconnect()
    return
  }

  const user = await db.user.create({
    data: {
      name: "Agency Rep",
      email,
      emailVerified: true,
      isPartner: true,
    },
  })

  await db.account.create({
    data: {
      userId: user.id,
      providerId: "credential",
      accountId: user.id,
      password: await hashPassword(password),
    },
  })

  console.log("Seeded partner rep:")
  console.log("  email:   ", email)
  console.log("  password:", password)
  console.log("  isPartner: true (no org yet — sign in and complete org step, or use New client setup)")
  await db.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
