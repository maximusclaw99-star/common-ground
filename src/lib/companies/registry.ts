/**
 * The companies the product knows by name.
 *
 * This is a display registry, not a closed world: a student can pick a
 * company that is not here and everything still works — they just get a
 * monogram instead of a logo and a slug derived from the name. What the
 * registry adds for the ones it does know is a domain (for the logo), a sector
 * label, and a stable slug for the dashboard URL.
 *
 * Kept free of app imports on purpose: `scripts/fetch-logos.ts` reads it with
 * tsx to fetch the logos, and must not drag the whole app in to do so.
 */

export type Sector =
  | "Accounting" | "Consulting" | "Technology" | "Data & AI"
  | "Finance" | "Defense & federal" | "Design";

export interface KnownCompany {
  name: string;
  /** Stable URL segment. Derived from the name unless it needs to be shorter. */
  slug: string;
  /** Where the logo comes from. Null for fictional employers in the fixtures. */
  domain: string | null;
  sector: Sector;
  /** Other spellings people use, matched case-insensitively. */
  aliases?: readonly string[];
}

const c = (name: string, domain: string | null, sector: Sector, aliases?: readonly string[]): KnownCompany =>
  ({ name, slug: slugify(name), domain, sector, aliases });

export const KNOWN_COMPANIES: readonly KnownCompany[] = Object.freeze([
  // ---------------------------------------------------------- accounting
  c("Deloitte", "deloitte.com", "Accounting", ["Deloitte & Touche", "Deloitte Consulting"]),
  c("PwC", "pwc.com", "Accounting", ["PricewaterhouseCoopers", "PwC (Campus)", "PwC (Experienced)"]),
  c("EY", "ey.com", "Accounting", ["Ernst & Young"]),
  c("KPMG", "kpmg.com", "Accounting"),
  c("Grant Thornton", "grantthornton.com", "Accounting"),
  c("RSM US", "rsmus.com", "Accounting", ["RSM"]),
  c("BDO USA", "bdo.com", "Accounting", ["BDO"]),
  c("Baker Tilly", "bakertilly.com", "Accounting"),
  c("Forvis Mazars", "forvismazars.us", "Accounting", ["Forvis"]),
  c("CohnReznick", "cohnreznick.com", "Accounting"),

  // ---------------------------------------------------------- consulting
  c("McKinsey & Company", "mckinsey.com", "Consulting", ["McKinsey"]),
  c("Boston Consulting Group", "bcg.com", "Consulting", ["BCG", "Boston Consulting Group (BCG)"]),
  c("Bain & Company", "bain.com", "Consulting", ["Bain"]),
  c("Accenture", "accenture.com", "Consulting"),
  c("Booz Allen Hamilton", "boozallen.com", "Defense & federal", ["Booz Allen"]),
  c("Guidehouse", "guidehouse.com", "Consulting"),
  c("Huron Consulting", "huronconsultinggroup.com", "Consulting", ["Huron"]),
  c("Oliver Wyman", "oliverwyman.com", "Consulting"),
  c("Capgemini", "capgemini.com", "Consulting"),
  c("RTI International", "rti.org", "Consulting", ["RTI"]),
  c("ICF", "icf.com", "Consulting"),
  c("CGI Federal", "cgi.com", "Defense & federal", ["CGI"]),
  c("MITRE", "mitre.org", "Defense & federal", ["The MITRE Corporation"]),
  c("Leidos", "leidos.com", "Defense & federal"),
  c("Lockheed Martin", "lockheedmartin.com", "Defense & federal"),
  c("Northrop Grumman", "northropgrumman.com", "Defense & federal"),

  // ---------------------------------------------------------- technology
  c("Google", "google.com", "Technology", ["Alphabet"]),
  c("Microsoft", "microsoft.com", "Technology"),
  c("Amazon", "amazon.com", "Technology", ["AWS", "Amazon Web Services"]),
  c("Apple", "apple.com", "Technology"),
  c("Meta", "meta.com", "Technology", ["Facebook"]),
  c("Netflix", "netflix.com", "Technology"),
  c("Adobe", "adobe.com", "Technology"),
  c("Salesforce", "salesforce.com", "Technology"),
  c("Oracle", "oracle.com", "Technology"),
  c("NVIDIA", "nvidia.com", "Technology", ["Nvidia"]),
  c("Stripe", "stripe.com", "Technology"),
  c("Cloudflare", "cloudflare.com", "Technology"),
  c("Twilio", "twilio.com", "Technology"),
  c("Samsara", "samsara.com", "Technology"),
  c("Instacart", "instacart.com", "Technology"),
  c("Discord", "discord.com", "Technology"),
  c("Reddit", "reddit.com", "Technology"),
  c("Braze", "braze.com", "Technology"),
  c("Klaviyo", "klaviyo.com", "Technology"),
  c("Asana", "asana.com", "Technology"),
  c("Gusto", "gusto.com", "Technology"),
  c("Vercel", "vercel.com", "Technology"),
  c("Airtable", "airtable.com", "Technology"),
  c("Amplitude", "amplitude.com", "Technology"),
  c("Figma", "figma.com", "Design"),

  // ----------------------------------------------------------- data & ai
  c("Databricks", "databricks.com", "Data & AI"),
  c("Snowflake", "snowflake.com", "Data & AI"),
  c("Palantir", "palantir.com", "Data & AI", ["Palantir Technologies"]),
  c("Datadog", "datadoghq.com", "Data & AI"),
  c("MongoDB", "mongodb.com", "Data & AI"),
  c("Elastic", "elastic.co", "Data & AI"),
  c("Fivetran", "fivetran.com", "Data & AI"),
  c("Sigma Computing", "sigmacomputing.com", "Data & AI", ["Sigma"]),
  c("Anthropic", "anthropic.com", "Data & AI"),
  c("Scale AI", "scale.com", "Data & AI", ["Scale"]),

  // ------------------------------------------------------------- finance
  c("Goldman Sachs", "goldmansachs.com", "Finance"),
  c("JPMorgan Chase", "jpmorganchase.com", "Finance", ["JPMorgan", "J.P. Morgan", "JP Morgan"]),
  c("Morgan Stanley", "morganstanley.com", "Finance"),
  c("Bank of America", "bankofamerica.com", "Finance", ["BofA"]),
  c("Citi", "citi.com", "Finance", ["Citigroup", "Citibank"]),
  c("Wells Fargo", "wellsfargo.com", "Finance"),
  c("BlackRock", "blackrock.com", "Finance"),
  c("Vanguard", "vanguard.com", "Finance"),
  c("Fidelity Investments", "fidelity.com", "Finance", ["Fidelity"]),
  c("Truist", "truist.com", "Finance"),
  c("Capital One", "capitalone.com", "Finance"),
  c("Robinhood", "robinhood.com", "Finance"),
  c("Affirm", "affirm.com", "Finance"),
  c("Chime", "chime.com", "Finance"),
  c("Evercore", "evercore.com", "Finance"),
  c("Lazard", "lazard.com", "Finance"),
  c("Carlyle", "carlyle.com", "Finance", ["The Carlyle Group"]),

  // ----------------------------------------------------------- fixtures
  // Fictional employers from the demo cast. No domain, so a monogram.
  c("Greystone Investment Bank", null, "Finance"),
  c("Acme Analytics", null, "Data & AI"),
]);

/** "Bain & Company" → "bain-and-company". Stable, URL-safe, lowercase. */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const byKey = new Map<string, KnownCompany>();
for (const company of KNOWN_COMPANIES) {
  byKey.set(slugify(company.name), company);
  for (const alias of company.aliases ?? []) byKey.set(slugify(alias), company);
}

/** Registry lookup by any spelling we know. Undefined for a company we don't. */
export function findKnownCompany(name: string | null | undefined): KnownCompany | undefined {
  if (!name) return undefined;
  return byKey.get(slugify(name));
}
