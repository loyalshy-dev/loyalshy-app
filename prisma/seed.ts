import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("Seeding database...")

  // Clean up existing data (order matters for FK constraints)
  await prisma.analyticsSnapshot.deleteMany()
  await prisma.walletPassLog.deleteMany()
  await prisma.deviceRegistration.deleteMany()
  await prisma.staffInvitation.deleteMany()
  await prisma.reward.deleteMany()
  await prisma.visit.deleteMany()
  await prisma.enrollment.deleteMany()
  await prisma.cardDesign.deleteMany()
  await prisma.customer.deleteMany()
  await prisma.loyaltyProgram.deleteMany()
  await prisma.session.deleteMany()
  await prisma.account.deleteMany()
  await prisma.user.deleteMany()
  await prisma.restaurant.deleteMany()

  // ─── Demo Restaurant ────────────────────────────────────────

  const restaurant = await prisma.restaurant.create({
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
      plan: "PRO",
      settings: { onboardingComplete: true },
    },
  })

  // ─── Loyalty Programs (2 per restaurant) ───────────────────

  const burgerProgram = await prisma.loyaltyProgram.create({
    data: {
      restaurantId: restaurant.id,
      name: "Burger Card",
      visitsRequired: 10,
      rewardDescription: "Free Burger",
      rewardExpiryDays: 90,
      status: "ACTIVE",
      startsAt: new Date("2026-01-01"),
      termsAndConditions:
        "Earn 1 stamp per visit. After 10 stamps, get a free burger. Reward expires after 90 days.",
    },
  })

  const drinksProgram = await prisma.loyaltyProgram.create({
    data: {
      restaurantId: restaurant.id,
      name: "Drinks Card",
      visitsRequired: 5,
      rewardDescription: "Free Drink",
      rewardExpiryDays: 30,
      status: "ACTIVE",
      startsAt: new Date("2026-02-01"),
      termsAndConditions:
        "Earn 1 stamp per drink purchase. After 5 stamps, get a free drink. Reward expires after 30 days.",
    },
  })

  // ─── Card Designs (per program) ────────────────────────────

  await prisma.cardDesign.create({
    data: {
      loyaltyProgramId: burgerProgram.id,
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

  await prisma.cardDesign.create({
    data: {
      loyaltyProgramId: drinksProgram.id,
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

  // ─── Sample Customers ───────────────────────────────────────

  const alice = await prisma.customer.create({
    data: {
      restaurantId: restaurant.id,
      fullName: "Alice Johnson",
      email: "alice@example.com",
      phone: "+1111111111",
      totalVisits: 17,
      lastVisitAt: new Date("2026-02-20"),
    },
  })

  const bob = await prisma.customer.create({
    data: {
      restaurantId: restaurant.id,
      fullName: "Bob Smith",
      email: "bob@example.com",
      phone: "+2222222222",
      totalVisits: 3,
      lastVisitAt: new Date("2026-02-15"),
    },
  })

  const carol = await prisma.customer.create({
    data: {
      restaurantId: restaurant.id,
      fullName: "Carol White",
      email: "carol@example.com",
      phone: "+3333333333",
      totalVisits: 10,
      lastVisitAt: new Date("2026-02-25"),
    },
  })

  // ─── Enrollments ───────────────────────────────────────────

  // Alice: enrolled in both programs
  const aliceBurger = await prisma.enrollment.create({
    data: {
      customerId: alice.id,
      loyaltyProgramId: burgerProgram.id,
      currentCycleVisits: 7,
      totalVisits: 17,
      totalRewardsRedeemed: 1,
      status: "ACTIVE",
    },
  })

  const aliceDrinks = await prisma.enrollment.create({
    data: {
      customerId: alice.id,
      loyaltyProgramId: drinksProgram.id,
      currentCycleVisits: 3,
      totalVisits: 5,
      totalRewardsRedeemed: 0,
      status: "ACTIVE",
    },
  })

  // Bob: enrolled in burger program only
  const bobBurger = await prisma.enrollment.create({
    data: {
      customerId: bob.id,
      loyaltyProgramId: burgerProgram.id,
      currentCycleVisits: 3,
      totalVisits: 3,
      totalRewardsRedeemed: 0,
      status: "ACTIVE",
    },
  })

  // Carol: enrolled in burger program (completed cycle)
  const carolBurger = await prisma.enrollment.create({
    data: {
      customerId: carol.id,
      loyaltyProgramId: burgerProgram.id,
      currentCycleVisits: 10,
      totalVisits: 10,
      totalRewardsRedeemed: 0,
      status: "ACTIVE",
    },
  })

  const carolDrinks = await prisma.enrollment.create({
    data: {
      customerId: carol.id,
      loyaltyProgramId: drinksProgram.id,
      currentCycleVisits: 2,
      totalVisits: 2,
      totalRewardsRedeemed: 0,
      status: "ACTIVE",
    },
  })

  // ─── Visits ─────────────────────────────────────────────────

  // Alice: 7 burger visits in current cycle
  for (let i = 1; i <= 7; i++) {
    await prisma.visit.create({
      data: {
        customerId: alice.id,
        restaurantId: restaurant.id,
        loyaltyProgramId: burgerProgram.id,
        enrollmentId: aliceBurger.id,
        visitNumber: i,
        createdAt: new Date(`2026-02-${String(i + 13).padStart(2, "0")}`),
      },
    })
  }

  // Alice: 3 drinks visits
  for (let i = 1; i <= 3; i++) {
    await prisma.visit.create({
      data: {
        customerId: alice.id,
        restaurantId: restaurant.id,
        loyaltyProgramId: drinksProgram.id,
        enrollmentId: aliceDrinks.id,
        visitNumber: i,
        createdAt: new Date(`2026-02-${String(i + 17).padStart(2, "0")}`),
      },
    })
  }

  // Bob: 3 burger visits
  for (let i = 1; i <= 3; i++) {
    await prisma.visit.create({
      data: {
        customerId: bob.id,
        restaurantId: restaurant.id,
        loyaltyProgramId: burgerProgram.id,
        enrollmentId: bobBurger.id,
        visitNumber: i,
        createdAt: new Date(`2026-02-${String(i + 12).padStart(2, "0")}`),
      },
    })
  }

  // Carol: 10 burger visits (completed cycle)
  for (let i = 1; i <= 10; i++) {
    await prisma.visit.create({
      data: {
        customerId: carol.id,
        restaurantId: restaurant.id,
        loyaltyProgramId: burgerProgram.id,
        enrollmentId: carolBurger.id,
        visitNumber: i,
        createdAt: new Date(`2026-02-${String(i + 15).padStart(2, "0")}`),
      },
    })
  }

  // Carol: 2 drinks visits
  for (let i = 1; i <= 2; i++) {
    await prisma.visit.create({
      data: {
        customerId: carol.id,
        restaurantId: restaurant.id,
        loyaltyProgramId: drinksProgram.id,
        enrollmentId: carolDrinks.id,
        visitNumber: i,
        createdAt: new Date(`2026-02-${String(i + 22).padStart(2, "0")}`),
      },
    })
  }

  // ─── Rewards ────────────────────────────────────────────────

  // Alice: redeemed burger reward from previous cycle
  await prisma.reward.create({
    data: {
      customerId: alice.id,
      restaurantId: restaurant.id,
      loyaltyProgramId: burgerProgram.id,
      enrollmentId: aliceBurger.id,
      status: "REDEEMED",
      earnedAt: new Date("2026-01-15"),
      redeemedAt: new Date("2026-01-20"),
      expiresAt: new Date("2026-04-15"),
    },
  })

  // Carol: available burger reward (just completed cycle)
  await prisma.reward.create({
    data: {
      customerId: carol.id,
      restaurantId: restaurant.id,
      loyaltyProgramId: burgerProgram.id,
      enrollmentId: carolBurger.id,
      status: "AVAILABLE",
      earnedAt: new Date("2026-02-25"),
      expiresAt: new Date("2026-05-26"),
    },
  })

  // ─── Analytics Snapshots ────────────────────────────────────

  const today = new Date("2026-02-26")
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    await prisma.analyticsSnapshot.create({
      data: {
        restaurantId: restaurant.id,
        date,
        totalCustomers: 3,
        newCustomers: i === 6 ? 1 : i === 4 ? 1 : i === 2 ? 1 : 0,
        totalVisits: Math.floor(Math.random() * 5) + 1,
        rewardsEarned: i === 0 ? 1 : 0,
        rewardsRedeemed: i === 5 ? 1 : 0,
      },
    })
  }

  console.log("Seed complete!")
  console.log(`  Restaurant: ${restaurant.name} (${restaurant.slug})`)
  console.log(`  Programs: ${burgerProgram.name}, ${drinksProgram.name}`)
  console.log(`  Customers: 3 (Alice, Bob, Carol)`)
  console.log(`  Enrollments: 5 (Alice×2, Bob×1, Carol×2)`)
  console.log(`  Visits: 25 total`)
  console.log(`  Rewards: 2 (1 redeemed, 1 available)`)
  console.log(`  Card Designs: 2 (one per program)`)
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
