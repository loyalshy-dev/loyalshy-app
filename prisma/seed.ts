import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("Seeding database...")

  // Clean up existing data (order matters for FK constraints)
  await prisma.analyticsSnapshot.deleteMany()
  await prisma.walletPassLog.deleteMany()
  await prisma.deviceRegistration.deleteMany()
  await prisma.staffInvitation.deleteMany()
  await prisma.reward.deleteMany()
  await prisma.interaction.deleteMany()
  await prisma.passInstance.deleteMany()
  await prisma.passDesign.deleteMany()
  await prisma.contact.deleteMany()
  await prisma.passTemplate.deleteMany()
  await prisma.member.deleteMany()
  await prisma.invitation.deleteMany()
  await prisma.session.deleteMany()
  await prisma.account.deleteMany()
  await prisma.user.deleteMany()
  await prisma.organization.deleteMany()

  // ─── Demo Organization ────────────────────────────────────

  const org = await prisma.organization.create({
    data: {
      name: "Burger Palace",
      slug: "burger-palace",
      brandColor: "#FF6B35",
      secondaryColor: "#004E89",
      address: "123 Main Street, Downtown",
      phone: "+1234567890",
      website: "https://burgerpalace.example.com",
      timezone: "America/New_York",
      subscriptionStatus: "ACTIVE",
      plan: "GROWTH",
      settings: { onboardingComplete: true },
    },
  })

  // ─── Pass Templates (2 per org) ───────────────────────────

  const burgerTemplate = await prisma.passTemplate.create({
    data: {
      organizationId: org.id,
      name: "Burger Card",
      passType: "STAMP_CARD",
      status: "ACTIVE",
      startsAt: new Date("2026-01-01"),
      termsAndConditions:
        "Earn 1 stamp per visit. After 10 stamps, get a free burger. Reward expires after 90 days.",
      config: {
        stampsRequired: 10,
        rewardDescription: "Free Burger",
        rewardExpiryDays: 90,
      },
    },
  })

  const drinksTemplate = await prisma.passTemplate.create({
    data: {
      organizationId: org.id,
      name: "Drinks Card",
      passType: "STAMP_CARD",
      status: "ACTIVE",
      startsAt: new Date("2026-02-01"),
      termsAndConditions:
        "Earn 1 stamp per drink purchase. After 5 stamps, get a free drink. Reward expires after 30 days.",
      config: {
        stampsRequired: 5,
        rewardDescription: "Free Drink",
        rewardExpiryDays: 30,
      },
    },
  })

  // ─── Pass Designs (per template) ──────────────────────────

  await prisma.passDesign.create({
    data: {
      passTemplateId: burgerTemplate.id,
      cardType: "STAMP",
      showStrip: false,
      primaryColor: "#FF6B35",
      secondaryColor: "#004E89",
      textColor: "#ffffff",
      patternStyle: "NONE",
      progressStyle: "NUMBERS",
      fontFamily: "SANS",
      labelFormat: "UPPERCASE",
      designHash: "seed-burger-v1",
    },
  })

  await prisma.passDesign.create({
    data: {
      passTemplateId: drinksTemplate.id,
      cardType: "STAMP",
      showStrip: true,
      primaryColor: "#004E89",
      secondaryColor: "#48cae4",
      textColor: "#ffffff",
      patternStyle: "WAVES",
      progressStyle: "CIRCLES",
      fontFamily: "ROUNDED",
      labelFormat: "TITLE_CASE",
      designHash: "seed-drinks-v1",
    },
  })

  // ─── Sample Contacts ──────────────────────────────────────

  const alice = await prisma.contact.create({
    data: {
      organizationId: org.id,
      fullName: "Alice Johnson",
      email: "alice@example.com",
      phone: "+1111111111",
      memberNumber: 1,
      totalInteractions: 17,
      lastInteractionAt: new Date("2026-02-20"),
    },
  })

  const bob = await prisma.contact.create({
    data: {
      organizationId: org.id,
      fullName: "Bob Smith",
      email: "bob@example.com",
      phone: "+2222222222",
      memberNumber: 2,
      totalInteractions: 3,
      lastInteractionAt: new Date("2026-02-15"),
    },
  })

  const carol = await prisma.contact.create({
    data: {
      organizationId: org.id,
      fullName: "Carol White",
      email: "carol@example.com",
      phone: "+3333333333",
      memberNumber: 3,
      totalInteractions: 10,
      lastInteractionAt: new Date("2026-02-25"),
    },
  })

  // ─── Pass Instances ───────────────────────────────────────

  const aliceBurger = await prisma.passInstance.create({
    data: {
      contactId: alice.id,
      passTemplateId: burgerTemplate.id,
      status: "ACTIVE",
      data: { currentCycleStamps: 7, totalStamps: 17, totalRewardsEarned: 1 },
    },
  })

  const aliceDrinks = await prisma.passInstance.create({
    data: {
      contactId: alice.id,
      passTemplateId: drinksTemplate.id,
      status: "ACTIVE",
      data: { currentCycleStamps: 3, totalStamps: 5, totalRewardsEarned: 0 },
    },
  })

  const bobBurger = await prisma.passInstance.create({
    data: {
      contactId: bob.id,
      passTemplateId: burgerTemplate.id,
      status: "ACTIVE",
      data: { currentCycleStamps: 3, totalStamps: 3, totalRewardsEarned: 0 },
    },
  })

  const carolBurger = await prisma.passInstance.create({
    data: {
      contactId: carol.id,
      passTemplateId: burgerTemplate.id,
      status: "ACTIVE",
      data: { currentCycleStamps: 10, totalStamps: 10, totalRewardsEarned: 0 },
    },
  })

  const carolDrinks = await prisma.passInstance.create({
    data: {
      contactId: carol.id,
      passTemplateId: drinksTemplate.id,
      status: "ACTIVE",
      data: { currentCycleStamps: 2, totalStamps: 2, totalRewardsEarned: 0 },
    },
  })

  // ─── Interactions (stamps) ────────────────────────────────

  // Alice: 7 burger stamps in current cycle
  for (let i = 1; i <= 7; i++) {
    await prisma.interaction.create({
      data: {
        contactId: alice.id,
        organizationId: org.id,
        passTemplateId: burgerTemplate.id,
        passInstanceId: aliceBurger.id,
        type: "STAMP",
        metadata: { stampNumber: i, cycleStamps: i, totalStamps: 10 + i },
        createdAt: new Date(`2026-02-${String(i + 13).padStart(2, "0")}`),
      },
    })
  }

  // Alice: 3 drink stamps
  for (let i = 1; i <= 3; i++) {
    await prisma.interaction.create({
      data: {
        contactId: alice.id,
        organizationId: org.id,
        passTemplateId: drinksTemplate.id,
        passInstanceId: aliceDrinks.id,
        type: "STAMP",
        metadata: { stampNumber: i, cycleStamps: i, totalStamps: i },
        createdAt: new Date(`2026-02-${String(i + 17).padStart(2, "0")}`),
      },
    })
  }

  // Bob: 3 burger stamps
  for (let i = 1; i <= 3; i++) {
    await prisma.interaction.create({
      data: {
        contactId: bob.id,
        organizationId: org.id,
        passTemplateId: burgerTemplate.id,
        passInstanceId: bobBurger.id,
        type: "STAMP",
        metadata: { stampNumber: i, cycleStamps: i, totalStamps: i },
        createdAt: new Date(`2026-02-${String(i + 12).padStart(2, "0")}`),
      },
    })
  }

  // Carol: 10 burger stamps (completed cycle)
  for (let i = 1; i <= 10; i++) {
    await prisma.interaction.create({
      data: {
        contactId: carol.id,
        organizationId: org.id,
        passTemplateId: burgerTemplate.id,
        passInstanceId: carolBurger.id,
        type: "STAMP",
        metadata: { stampNumber: i, cycleStamps: i, totalStamps: i },
        createdAt: new Date(`2026-02-${String(i + 15).padStart(2, "0")}`),
      },
    })
  }

  // Carol: 2 drink stamps
  for (let i = 1; i <= 2; i++) {
    await prisma.interaction.create({
      data: {
        contactId: carol.id,
        organizationId: org.id,
        passTemplateId: drinksTemplate.id,
        passInstanceId: carolDrinks.id,
        type: "STAMP",
        metadata: { stampNumber: i, cycleStamps: i, totalStamps: i },
        createdAt: new Date(`2026-02-${String(i + 22).padStart(2, "0")}`),
      },
    })
  }

  // ─── Rewards ──────────────────────────────────────────────

  await prisma.reward.create({
    data: {
      contactId: alice.id,
      organizationId: org.id,
      passTemplateId: burgerTemplate.id,
      passInstanceId: aliceBurger.id,
      status: "REDEEMED",
      earnedAt: new Date("2026-01-15"),
      redeemedAt: new Date("2026-01-20"),
      expiresAt: new Date("2026-04-15"),
    },
  })

  await prisma.reward.create({
    data: {
      contactId: carol.id,
      organizationId: org.id,
      passTemplateId: burgerTemplate.id,
      passInstanceId: carolBurger.id,
      status: "AVAILABLE",
      earnedAt: new Date("2026-02-25"),
      expiresAt: new Date("2026-05-26"),
    },
  })

  // ─── Analytics Snapshots ──────────────────────────────────

  const today = new Date("2026-02-26")
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    await prisma.analyticsSnapshot.create({
      data: {
        organizationId: org.id,
        date,
        totalContacts: 3,
        newContacts: i === 6 ? 1 : i === 4 ? 1 : i === 2 ? 1 : 0,
        totalInteractions: Math.floor(Math.random() * 5) + 1,
        rewardsEarned: i === 0 ? 1 : 0,
        rewardsRedeemed: i === 5 ? 1 : 0,
      },
    })
  }

  console.log("Seed complete!")
  console.log(`  Organization: ${org.name} (${org.slug})`)
  console.log(`  Templates: ${burgerTemplate.name}, ${drinksTemplate.name}`)
  console.log(`  Contacts: 3 (Alice, Bob, Carol)`)
  console.log(`  Pass Instances: 5 (Alice x2, Bob x1, Carol x2)`)
  console.log(`  Interactions: 25 total`)
  console.log(`  Rewards: 2 (1 redeemed, 1 available)`)
  console.log(`  Pass Designs: 2 (one per template)`)
  console.log(`  Analytics Snapshots: 7 days`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
