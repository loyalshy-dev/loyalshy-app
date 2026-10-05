// Checks every src/messages/<locale>.json against en.json:
//   - same key tree (nothing missing, nothing extra, same leaf types)
//   - same {argument} names (plain, plural and select arguments)
//   - same <tag> set (rich-text tags such as <b>, <link>)
//   - same array lengths for list leaves
//   - no em dash the source does not have (the house style bans them)
//   - metadata.<page>.title ≤ 60 and .description ≤ 160 characters (SERP limits)
// Run with `pnpm i18n:check`. Exit code 1 on any finding.
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

const dir = join(process.cwd(), "src/messages")
type Tree = { [key: string]: Tree | string | string[] }
const load = (locale: string) => JSON.parse(readFileSync(join(dir, `${locale}.json`), "utf8")) as Tree

const en = load("en")
const locales = readdirSync(dir)
  .filter((f) => f.endsWith(".json") && f !== "en.json")
  .map((f) => f.slice(0, -5))

function* walk(tree: Tree, path: string[] = []): Generator<[string, string | string[]]> {
  for (const [key, value] of Object.entries(tree)) {
    if (value && typeof value === "object" && !Array.isArray(value)) yield* walk(value, [...path, key])
    else yield [[...path, key].join("."), value]
  }
}

const ARG = /\{(\w+)(?=\s*[},])/g
const TAG = /<\/?([a-zA-Z]+)>/g
const names = (s: string, re: RegExp) => new Set(Array.from(s.matchAll(re), (m) => m[1]))
const same = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((x) => b.has(x))

const problems: string[] = []
const enLeaves = new Map(walk(en))

for (const locale of locales) {
  const leaves = new Map(walk(load(locale)))
  for (const key of enLeaves.keys()) if (!leaves.has(key)) problems.push(`${locale}: missing ${key}`)
  for (const key of leaves.keys()) if (!enLeaves.has(key)) problems.push(`${locale}: extra ${key}`)

  for (const [key, source] of enLeaves) {
    const target = leaves.get(key)
    if (target === undefined) continue
    if (Array.isArray(source)) {
      if (!Array.isArray(target) || target.length !== source.length) problems.push(`${locale}: ${key} must be a list of ${source.length}`)
      continue
    }
    if (typeof target !== "string") { problems.push(`${locale}: ${key} must be a string`); continue }
    if (!same(names(source, ARG), names(target, ARG))) problems.push(`${locale}: ${key} arguments differ from en`)
    if (!same(names(source, TAG), names(target, TAG))) problems.push(`${locale}: ${key} tags differ from en`)
    if (target.includes("—") && !source.includes("—")) problems.push(`${locale}: ${key} has an em dash the source does not`)
  }

  const metadata = (leaves.size ? [...leaves] : []).filter(([k]) => k.startsWith("metadata."))
  for (const [key, value] of metadata) {
    if (typeof value !== "string") continue
    if (key.endsWith(".title") && value.length > 60) problems.push(`${locale}: ${key} is ${value.length} chars (max 60)`)
    if (key.endsWith(".description") && value.length > 160) problems.push(`${locale}: ${key} is ${value.length} chars (max 160)`)
  }
}

if (problems.length) {
  console.error(problems.join("\n"))
  console.error(`\n${problems.length} problem(s) across ${locales.length} locale(s)`)
  process.exit(1)
}
console.log(`messages ok: ${locales.length} locales, ${enLeaves.size} keys each`)
