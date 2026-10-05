// ─── The company behind Loyalshy ─────────────────────────────
// One source for the legal notice (Impressum / aviso legal) and the
// Organization JSON-LD. German law (§ 5 DDG) and Spanish law (art. 10
// LSSI) both ask for the representative and the commercial register
// entry; the legal notice shows those rows only once they are filled in.
// ─────────────────────────────────────────────────────────────

export const LEGAL_ENTITY = {
  name: "HEX CONCEPTS STUDIO, S.L.",
  /** NIF (Spanish tax ID). */
  taxId: "B27646645",
  /** EU VAT ID (VIES). */
  vatId: "ESB27646645",
  street: "Av. Convent 11",
  postalCode: "25123",
  locality: "Torrefarrera",
  region: "Lleida",
  country: "ES",
  email: "hello@loyalshy.com",
  /** Person(s) authorised to represent the company, e.g. the administrador único. */
  representative: null as string | null,
  /** Registro Mercantil entry, e.g. "Registro Mercantil de Lleida, Tomo …, Folio …, Hoja L-…". */
  register: null as string | null,
} as const
