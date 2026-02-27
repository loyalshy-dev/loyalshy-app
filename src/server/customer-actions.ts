"use server"

import { z } from "zod"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { assertAuthenticated, getRestaurantForUser, assertRestaurantRole } from "@/lib/dal"
import { sanitizeText } from "@/lib/sanitize"
import type { Prisma } from "@prisma/client"
import type { EnrollmentDetail } from "@/types/enrollment"

// ─── Types ──────────────────────────────────────────────────

export type CustomerRow = {
  id: string
  fullName: string
  email: string | null
  phone: string | null
  totalVisits: number
  lastVisitAt: Date | null
  createdAt: Date
  hasAvailableReward: boolean
  enrollmentCount: number
  primaryEnrollment: {
    programName: string
    currentCycleVisits: number
    visitsRequired: number
  } | null
}

export type CustomerListResult = {
  customers: CustomerRow[]
  total: number
  pageCount: number
}

export type CustomerDetail = {
  id: string
  fullName: string
  email: string | null
  phone: string | null
  totalVisits: number
  lastVisitAt: Date | null
  createdAt: Date
  enrollments: EnrollmentDetail[]
  visits: {
    id: string
    visitNumber: number
    createdAt: Date
    registeredBy: string | null
    programName: string
  }[]
  rewards: {
    id: string
    status: string
    earnedAt: Date
    redeemedAt: Date | null
    expiresAt: Date
    description: string
    programName: string
  }[]
}

// ─── Validation Schemas ─────────────────────────────────────

const addCustomerSchema = z.object({
  fullName: z.string().min(1, "Name is required").max(100),
  email: z
    .string()
    .email("Invalid email")
    .max(255)
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .max(30)
    .optional()
    .or(z.literal("")),
})

const updateCustomerSchema = z.object({
  customerId: z.string().min(1),
  fullName: z.string().min(1, "Name is required").max(100),
  email: z
    .string()
    .email("Invalid email")
    .max(255)
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .max(30)
    .optional()
    .or(z.literal("")),
})

// ─── Helpers ────────────────────────────────────────────────

async function requireRestaurantId(): Promise<string> {
  await assertAuthenticated()
  const restaurant = await getRestaurantForUser()
  if (!restaurant) redirect("/register?step=2")
  return restaurant.id
}

// ─── Get Customers (Paginated, Searchable, Sortable) ────────

export type GetCustomersParams = {
  page?: number
  perPage?: number
  search?: string
  sort?: string
  order?: "asc" | "desc"
  hasReward?: string
}

export async function getCustomers(
  params: GetCustomersParams
): Promise<CustomerListResult> {
  const restaurantId = await requireRestaurantId()

  const page = params.page ?? 1
  const perPage = params.perPage ?? 20
  const skip = (page - 1) * perPage
  const search = params.search?.trim() ?? ""
  const sortField = params.sort ?? "createdAt"
  const sortOrder = params.order ?? "desc"
  const hasReward = params.hasReward ?? "all"

  // Build where clause (exclude soft-deleted)
  const where: Record<string, unknown> = { restaurantId, deletedAt: null }

  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { phone: { contains: search } },
    ]
  }

  // Map sortable fields
  const allowedSorts: Record<string, string> = {
    fullName: "fullName",
    totalVisits: "totalVisits",
    lastVisitAt: "lastVisitAt",
    createdAt: "createdAt",
  }
  const orderByField = allowedSorts[sortField] ?? "createdAt"

  const [customers, total] = await Promise.all([
    db.customer.findMany({
      where: where as Prisma.CustomerWhereInput,
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        totalVisits: true,
        lastVisitAt: true,
        createdAt: true,
        rewards: {
          where: { status: "AVAILABLE" },
          select: { id: true },
          take: 1,
        },
        enrollments: {
          where: { status: "ACTIVE" },
          select: {
            id: true,
            currentCycleVisits: true,
            loyaltyProgram: {
              select: {
                name: true,
                visitsRequired: true,
              },
            },
          },
          orderBy: { enrolledAt: "asc" },
        },
      },
      orderBy: { [orderByField]: sortOrder },
      skip,
      take: perPage,
    }),
    db.customer.count({
      where: where as Prisma.CustomerWhereInput,
    }),
  ])

  // Map to CustomerRow with enrollment data
  let filtered = customers.map((c) => {
    const activeEnrollments = c.enrollments
    const primary = activeEnrollments[0] ?? null

    return {
      id: c.id,
      fullName: c.fullName,
      email: c.email,
      phone: c.phone,
      totalVisits: c.totalVisits,
      lastVisitAt: c.lastVisitAt,
      createdAt: c.createdAt,
      hasAvailableReward: c.rewards.length > 0,
      enrollmentCount: activeEnrollments.length,
      primaryEnrollment: primary
        ? {
            programName: primary.loyaltyProgram.name,
            currentCycleVisits: primary.currentCycleVisits,
            visitsRequired: primary.loyaltyProgram.visitsRequired,
          }
        : null,
    }
  })

  if (hasReward === "yes") {
    filtered = filtered.filter((c) => c.hasAvailableReward)
  } else if (hasReward === "no") {
    filtered = filtered.filter((c) => !c.hasAvailableReward)
  }

  return {
    customers: filtered,
    total: hasReward !== "all" ? filtered.length : total,
    pageCount: Math.ceil(
      (hasReward !== "all" ? filtered.length : total) / perPage
    ),
  }
}

// ─── Get Customer Detail ────────────────────────────────────

export async function getCustomerDetail(
  customerId: string
): Promise<CustomerDetail | null> {
  const restaurantId = await requireRestaurantId()

  const customer = await db.customer.findFirst({
    where: { id: customerId, restaurantId, deletedAt: null },
    include: {
      enrollments: {
        include: {
          loyaltyProgram: {
            select: {
              id: true,
              name: true,
              visitsRequired: true,
              rewardDescription: true,
              status: true,
            },
          },
        },
        orderBy: { enrolledAt: "asc" },
      },
      visits: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          visitNumber: true,
          createdAt: true,
          registeredBy: { select: { name: true } },
          loyaltyProgram: { select: { name: true } },
        },
      },
      rewards: {
        orderBy: { earnedAt: "desc" },
        select: {
          id: true,
          status: true,
          earnedAt: true,
          redeemedAt: true,
          expiresAt: true,
          loyaltyProgram: { select: { name: true, rewardDescription: true } },
        },
      },
    },
  })

  if (!customer) return null

  const enrollments: EnrollmentDetail[] = customer.enrollments.map((e) => ({
    enrollmentId: e.id,
    programId: e.loyaltyProgram.id,
    programName: e.loyaltyProgram.name,
    programStatus: e.loyaltyProgram.status,
    currentCycleVisits: e.currentCycleVisits,
    visitsRequired: e.loyaltyProgram.visitsRequired,
    totalVisits: e.totalVisits,
    totalRewardsRedeemed: e.totalRewardsRedeemed,
    rewardDescription: e.loyaltyProgram.rewardDescription,
    status: e.status,
    walletPassType: e.walletPassType,
    enrolledAt: e.enrolledAt,
    frozenAt: e.frozenAt,
  }))

  return {
    id: customer.id,
    fullName: customer.fullName,
    email: customer.email,
    phone: customer.phone,
    totalVisits: customer.totalVisits,
    lastVisitAt: customer.lastVisitAt,
    createdAt: customer.createdAt,
    enrollments,
    visits: customer.visits.map((v) => ({
      id: v.id,
      visitNumber: v.visitNumber,
      createdAt: v.createdAt,
      registeredBy: v.registeredBy?.name ?? null,
      programName: v.loyaltyProgram.name,
    })),
    rewards: customer.rewards.map((r) => ({
      id: r.id,
      status: r.status,
      earnedAt: r.earnedAt,
      redeemedAt: r.redeemedAt,
      expiresAt: r.expiresAt,
      description: r.loyaltyProgram.rewardDescription,
      programName: r.loyaltyProgram.name,
    })),
  }
}

// ─── Add Customer ───────────────────────────────────────────

export type AddCustomerResult = {
  success: boolean
  customerId?: string
  error?: string
  duplicateField?: "email" | "phone"
}

export async function addCustomer(
  formData: FormData
): Promise<AddCustomerResult> {
  const restaurantId = await requireRestaurantId()

  // Check plan customer limit
  const { checkCustomerLimit } = await import("@/server/billing-actions")
  const limitCheck = await checkCustomerLimit(restaurantId)
  if (!limitCheck.allowed) {
    return {
      success: false,
      error: `You've reached the ${limitCheck.limit} customer limit for your plan. Upgrade to add more customers.`,
    }
  }

  const raw = {
    fullName: formData.get("fullName") as string,
    email: formData.get("email") as string,
    phone: formData.get("phone") as string,
  }

  const parsed = addCustomerSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    }
  }

  const fullName = sanitizeText(parsed.data.fullName, 100)
  const cleanEmail = parsed.data.email ? sanitizeText(parsed.data.email, 255) || null : null
  const cleanPhone = parsed.data.phone ? sanitizeText(parsed.data.phone, 30) || null : null

  // Duplicate detection (exclude soft-deleted)
  if (cleanEmail) {
    const existing = await db.customer.findFirst({
      where: { restaurantId, email: cleanEmail, deletedAt: null },
      select: { id: true },
    })
    if (existing) {
      return {
        success: false,
        error: `A customer with email "${cleanEmail}" already exists.`,
        duplicateField: "email",
      }
    }
  }

  if (cleanPhone) {
    const existing = await db.customer.findFirst({
      where: { restaurantId, phone: cleanPhone, deletedAt: null },
      select: { id: true },
    })
    if (existing) {
      return {
        success: false,
        error: `A customer with phone "${cleanPhone}" already exists.`,
        duplicateField: "phone",
      }
    }
  }

  // Create customer and auto-enroll in all active programs
  const customer = await db.customer.create({
    data: {
      restaurantId,
      fullName,
      email: cleanEmail,
      phone: cleanPhone,
    },
    select: { id: true },
  })

  // Fetch all active loyalty programs for this restaurant
  const activePrograms = await db.loyaltyProgram.findMany({
    where: { restaurantId, status: "ACTIVE" },
    select: { id: true },
  })

  // Auto-enroll customer in all active programs
  if (activePrograms.length > 0) {
    await db.enrollment.createMany({
      data: activePrograms.map((program) => ({
        customerId: customer.id,
        loyaltyProgramId: program.id,
      })),
    })
  }

  revalidatePath("/dashboard/customers")
  revalidatePath("/dashboard")

  return { success: true, customerId: customer.id }
}

// ─── Update Customer ────────────────────────────────────────

export type UpdateCustomerResult = {
  success: boolean
  error?: string
  duplicateField?: "email" | "phone"
}

export async function updateCustomer(
  formData: FormData
): Promise<UpdateCustomerResult> {
  const restaurantId = await requireRestaurantId()

  const raw = {
    customerId: formData.get("customerId") as string,
    fullName: formData.get("fullName") as string,
    email: formData.get("email") as string,
    phone: formData.get("phone") as string,
  }

  const parsed = updateCustomerSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    }
  }

  const customerId = parsed.data.customerId
  const fullName = sanitizeText(parsed.data.fullName, 100)
  const cleanEmail = parsed.data.email ? sanitizeText(parsed.data.email, 255) || null : null
  const cleanPhone = parsed.data.phone ? sanitizeText(parsed.data.phone, 30) || null : null

  // Verify customer belongs to this restaurant (exclude soft-deleted)
  const existing = await db.customer.findFirst({
    where: { id: customerId, restaurantId, deletedAt: null },
    select: { id: true, email: true, phone: true },
  })

  if (!existing) {
    return { success: false, error: "Customer not found" }
  }

  // Duplicate detection (skip if unchanged, exclude soft-deleted)
  if (cleanEmail && cleanEmail !== existing.email) {
    const dup = await db.customer.findFirst({
      where: { restaurantId, email: cleanEmail, deletedAt: null, NOT: { id: customerId } },
      select: { id: true },
    })
    if (dup) {
      return {
        success: false,
        error: `A customer with email "${cleanEmail}" already exists.`,
        duplicateField: "email",
      }
    }
  }

  if (cleanPhone && cleanPhone !== existing.phone) {
    const dup = await db.customer.findFirst({
      where: { restaurantId, phone: cleanPhone, deletedAt: null, NOT: { id: customerId } },
      select: { id: true },
    })
    if (dup) {
      return {
        success: false,
        error: `A customer with phone "${cleanPhone}" already exists.`,
        duplicateField: "phone",
      }
    }
  }

  await db.customer.update({
    where: { id: customerId },
    data: { fullName, email: cleanEmail, phone: cleanPhone },
  })

  revalidatePath("/dashboard/customers")
  revalidatePath("/dashboard")

  return { success: true }
}

// ─── Delete Customer ────────────────────────────────────────

export async function deleteCustomer(
  customerId: string
): Promise<{ success: boolean; error?: string }> {
  const restaurantId = await requireRestaurantId()

  const customer = await db.customer.findFirst({
    where: { id: customerId, restaurantId, deletedAt: null },
    select: { id: true },
  })

  if (!customer) {
    return { success: false, error: "Customer not found" }
  }

  // Soft delete — set deletedAt instead of destroying data
  await db.customer.update({
    where: { id: customerId },
    data: { deletedAt: new Date() },
  })

  revalidatePath("/dashboard/customers")
  revalidatePath("/dashboard")

  return { success: true }
}

// ─── Export Customers CSV ───────────────────────────────────

export async function exportCustomersCSV(): Promise<string> {
  const restaurantId = await requireRestaurantId()

  const customers = await db.customer.findMany({
    where: { restaurantId, deletedAt: null },
    select: {
      fullName: true,
      email: true,
      phone: true,
      totalVisits: true,
      lastVisitAt: true,
      createdAt: true,
      enrollments: {
        where: { status: "ACTIVE" },
        select: { id: true },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  const headers = [
    "Name",
    "Email",
    "Phone",
    "Total Visits",
    "Active Enrollments",
    "Last Visit",
    "Joined",
  ]

  const rows = customers.map((c) => [
    `"${c.fullName.replace(/"/g, '""')}"`,
    c.email ?? "",
    c.phone ?? "",
    c.totalVisits.toString(),
    c.enrollments.length.toString(),
    c.lastVisitAt?.toISOString() ?? "",
    c.createdAt.toISOString(),
  ])

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")
}

// ─── Export Customer Data (GDPR) ────────────────────────────

export async function exportCustomerData(customerId: string) {
  const restaurantId = await requireRestaurantId()

  // Owner-only for GDPR data export
  await assertRestaurantRole(restaurantId, "owner")

  const customer = await db.customer.findFirst({
    where: { id: customerId, restaurantId },
    include: {
      enrollments: {
        include: {
          loyaltyProgram: {
            select: {
              id: true,
              name: true,
              visitsRequired: true,
              rewardDescription: true,
              status: true,
            },
          },
        },
        orderBy: { enrolledAt: "asc" },
      },
      visits: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          visitNumber: true,
          createdAt: true,
          loyaltyProgram: { select: { name: true } },
        },
      },
      rewards: {
        orderBy: { earnedAt: "desc" },
        select: {
          id: true,
          status: true,
          earnedAt: true,
          redeemedAt: true,
          expiresAt: true,
          loyaltyProgram: { select: { name: true } },
        },
      },
    },
  })

  if (!customer) {
    return { error: "Customer not found" }
  }

  return {
    customer: {
      id: customer.id,
      fullName: customer.fullName,
      email: customer.email,
      phone: customer.phone,
      totalVisits: customer.totalVisits,
      lastVisitAt: customer.lastVisitAt,
      deletedAt: customer.deletedAt,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    },
    enrollments: customer.enrollments.map((e) => ({
      id: e.id,
      programName: e.loyaltyProgram.name,
      programStatus: e.loyaltyProgram.status,
      currentCycleVisits: e.currentCycleVisits,
      totalVisits: e.totalVisits,
      totalRewardsRedeemed: e.totalRewardsRedeemed,
      walletPassType: e.walletPassType,
      status: e.status,
      enrolledAt: e.enrolledAt,
      frozenAt: e.frozenAt,
    })),
    visits: customer.visits.map((v) => ({
      id: v.id,
      visitNumber: v.visitNumber,
      createdAt: v.createdAt,
      programName: v.loyaltyProgram.name,
    })),
    rewards: customer.rewards.map((r) => ({
      id: r.id,
      status: r.status,
      earnedAt: r.earnedAt,
      redeemedAt: r.redeemedAt,
      expiresAt: r.expiresAt,
      programName: r.loyaltyProgram.name,
    })),
  }
}
