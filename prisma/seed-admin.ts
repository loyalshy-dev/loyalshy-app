import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

async function main() {
  const email = process.env.ADMIN_EMAIL

  if (!email) {
    console.error("Error: ADMIN_EMAIL environment variable is required.")
    console.error("Usage: ADMIN_EMAIL=you@example.com npx tsx prisma/seed-admin.ts")
    process.exit(1)
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, role: true },
  })

  if (!user) {
    console.error(`Error: No user found with email "${email}".`)
    console.error("The user must register an account first, then run this script.")
    process.exit(1)
  }

  if (user.role === "SUPER_ADMIN") {
    console.log(`User "${user.name}" (${user.email}) is already a SUPER_ADMIN.`)
    return
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { role: "SUPER_ADMIN" },
  })

  console.log(`Promoted "${user.name}" (${user.email}) to SUPER_ADMIN.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
