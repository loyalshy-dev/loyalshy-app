// Apple Wallet pass constants — loaded from environment variables

export const PASS_TYPE_IDENTIFIER =
  process.env.APPLE_PASS_TYPE_IDENTIFIER ?? "pass.com.loyalshy.loyalty"

export const TEAM_IDENTIFIER = process.env.APPLE_TEAM_IDENTIFIER ?? ""

export const ORGANIZATION_NAME = "Loyalshy"

export const WEB_SERVICE_BASE_URL =
  process.env.BETTER_AUTH_URL ?? "http://localhost:3000"
