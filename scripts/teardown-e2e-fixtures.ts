/* Removes the E2E test fixtures seeded on 2026-08-18 (partner/handoff/
 * referral/statement testing) from the dev DB.
 *
 * Safety: only deletes users with the known test emails, and only deletes
 * organizations whose ENTIRE membership consists of those test users (plus
 * a name sanity check) — so real dev data can never be swept up. Run with
 * --dry-run to preview without deleting.
 */
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { config } from "dotenv"

config({ path: "/Users/themorell99/Desktop/loyalshy/loyalshy-app/.env.local" })

const DRY_RUN = process.argv.includes("--dry-run")

const EXACT_TEST_EMAILS = [
  "rep@agency.test",
  "owner@cafe.test",
  "billing-admin@loyalshy.test",
  "rep2@agency.test",
]

const ORG_NAME_PATTERNS = [/^Agency HQ$/, /^Cafe E2E /, /^Cafe Ref E2E /]

async function main() {
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  })

  // 1. Test users: exact seeds + the dynamic owner-ref-*@cafe.test accounts
  const testUsers = await db.user.findMany({
    where: {
      OR: [
        { email: { in: EXACT_TEST_EMAILS } },
        { email: { startsWith: "owner-ref-", endsWith: "@cafe.test" } },
      ],
    },
    select: { id: true, email: true },
  })
  const testUserIds = new Set(testUsers.map((u) => u.id))
  console.log(`Test users (${testUsers.length}):`)
  for (const u of testUsers) console.log(`  - ${u.email}`)

  // 2. Candidate orgs: attributed to a test user OR name matches a fixture
  //    pattern — and, hard requirement, every member is a test user.
  const candidates = await db.organization.findMany({
    where: {
      OR: [
        { referredById: { in: [...testUserIds] } },
        ...ORG_NAME_PATTERNS.map((p) => ({
          name: { startsWith: p.source.replace(/^\^/, "").replace(/\$$/, "").replace(/ $/, " ") },
        })),
        { name: "Agency HQ" },
      ],
    },
    select: {
      id: true,
      name: true,
      members: { select: { userId: true, user: { select: { email: true } } } },
      _count: { select: { contacts: true, passTemplates: true } },
    },
  })

  const orgsToDelete: { id: string; name: string }[] = []
  for (const org of candidates) {
    const nameMatches = ORG_NAME_PATTERNS.some((p) => p.test(org.name))
    const allMembersAreTestUsers =
      org.members.every((m) => testUserIds.has(m.userId))
    if (!nameMatches) {
      console.log(`  !! skipping "${org.name}" — name doesn't match fixture patterns`)
      continue
    }
    if (!allMembersAreTestUsers) {
      const outsiders = org.members
        .filter((m) => !testUserIds.has(m.userId))
        .map((m) => m.user.email)
      console.log(`  !! skipping "${org.name}" — has non-test members: ${outsiders.join(", ")}`)
      continue
    }
    orgsToDelete.push({ id: org.id, name: org.name })
  }

  console.log(`\nOrganizations to delete (${orgsToDelete.length}):`)
  for (const o of orgsToDelete) console.log(`  - ${o.name}`)

  if (DRY_RUN) {
    console.log("\n--dry-run: nothing deleted.")
    await db.$disconnect()
    return
  }

  // 3. Delete orgs first (cascades templates/contacts/members/handoff
  //    tokens/audit logs), then users (cascades sessions/accounts/members).
  const orgResult = await db.organization.deleteMany({
    where: { id: { in: orgsToDelete.map((o) => o.id) } },
  })
  const userResult = await db.user.deleteMany({
    where: { id: { in: [...testUserIds] } },
  })
  console.log(`\nDeleted ${orgResult.count} organizations, ${userResult.count} users.`)

  // 4. Verify nothing test-flavored remains
  const leftoverUsers = await db.user.count({
    where: {
      OR: [
        { email: { in: EXACT_TEST_EMAILS } },
        { email: { startsWith: "owner-ref-", endsWith: "@cafe.test" } },
      ],
    },
  })
  const leftoverOrgs = await db.organization.count({
    where: {
      OR: [{ name: "Agency HQ" }, { name: { startsWith: "Cafe E2E " } }, { name: { startsWith: "Cafe Ref E2E " } }],
    },
  })
  const remainingPartners = await db.user.count({ where: { isPartner: true } })
  const remainingHandoffs = await db.orgHandoffToken.count()
  console.log(
    `Verification — leftover test users: ${leftoverUsers}, leftover test orgs: ${leftoverOrgs}, ` +
      `partner users remaining: ${remainingPartners}, handoff tokens remaining: ${remainingHandoffs}`
  )

  await db.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
