/**
 * Vendors one logo per known company into public/logos/<slug>.png and writes
 * public/logos/manifest.json listing the slugs that have one.
 *
 * Fetched once, here, rather than hot-linked at runtime: the app then has no
 * third-party image request on any page, works offline in a demo room, and a
 * company whose icon service goes away keeps its logo. Source is Google's
 * favicon service at 128px; it returns a generic globe for domains it does
 * not know, which is detected by hash and skipped so the UI falls back to a
 * monogram instead of showing a globe.
 *
 *   npx tsx scripts/fetch-logos.ts
 */
import { createHash } from "node:crypto";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { KNOWN_COMPANIES } from "../src/lib/companies/registry";

const OUT = path.resolve(__dirname, "../public/logos");
const url = (domain: string) => `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

async function fetchPng(domain: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url(domain), { redirect: "follow", signal: AbortSignal.timeout(15_000) });
    if (!res.ok || !(res.headers.get("content-type") ?? "").startsWith("image/")) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function main() {
  await mkdir(OUT, { recursive: true });
  // What "no favicon known" looks like, so it is never shipped as a logo.
  const globe = await fetchPng("no-such-domain-for-a-globe-check.invalid");
  const globeHash = globe ? sha(globe) : null;

  const have = new Set((await readdir(OUT)).filter((f) => f.endsWith(".png")).map((f) => f.slice(0, -4)));
  const got: string[] = [];
  const skipped: string[] = [];

  for (const company of KNOWN_COMPANIES) {
    if (!company.domain) { skipped.push(`${company.name} (no domain)`); continue; }
    if (have.has(company.slug) && !process.argv.includes("--refresh")) { got.push(company.slug); continue; }
    const png = await fetchPng(company.domain);
    if (!png || (globeHash && sha(png) === globeHash) || png.byteLength < 200) {
      skipped.push(`${company.name} (${company.domain}: ${png ? "generic icon" : "fetch failed"})`);
      continue;
    }
    await writeFile(path.join(OUT, `${company.slug}.png`), png);
    got.push(company.slug);
    process.stdout.write(`  ${company.slug} ${png.byteLength}b\n`);
  }

  got.sort();
  await writeFile(path.join(OUT, "manifest.json"), JSON.stringify(got, null, 2) + "\n");
  console.log(`\n${got.length} logos in public/logos; ${skipped.length} without one:`);
  for (const s of skipped) console.log(`  - ${s}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
