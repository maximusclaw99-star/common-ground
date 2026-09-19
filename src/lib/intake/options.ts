/**
 * Seed lists for the pickable intake fields.
 *
 * These are a starting point, not a closed world: a student targeting a firm
 * that is not listed, or studying something not listed, must still be able to
 * type it. The comboboxes that render these accept free text for exactly that
 * reason — the list is there to make the common case one click, not to tell
 * anyone their answer is invalid.
 *
 * Groups are preserved because they are how people actually think about these
 * ("Big Four", "MBB"), and a flat alphabetical list loses that.
 */

export interface OptionGroup {
  label: string;
  items: readonly string[];
}

export const COMPANY_OPTIONS: readonly OptionGroup[] = Object.freeze([
  {
    label: "Big Tech / Software",
    items: ["Google", "Microsoft", "Apple", "Amazon", "Meta", "Netflix", "Salesforce", "Adobe"],
  },
  {
    label: "MBB Consulting",
    items: ["McKinsey & Company", "Boston Consulting Group (BCG)", "Bain & Company"],
  },
  {
    label: "Big Four Accounting",
    items: ["Deloitte", "PwC", "EY", "KPMG"],
  },
]);

export const ROLE_OPTIONS: readonly OptionGroup[] = Object.freeze([
  {
    label: "Tech",
    items: [
      "Software Engineer", "Frontend Engineer", "Backend Engineer", "Full-Stack Engineer",
      "Product Manager", "Data Scientist", "Cybersecurity Analyst",
    ],
  },
  {
    label: "Consulting",
    items: ["Management Consultant", "Strategy Analyst", "Technology Consultant"],
  },
  {
    label: "Accounting & Finance",
    items: ["Audit Associate", "Tax Associate", "Financial Analyst", "Advisory Consultant"],
  },
]);

export const MAJOR_OPTIONS: readonly OptionGroup[] = Object.freeze([
  {
    label: "Computing",
    items: ["Computer Science", "Software Engineering", "Information Technology", "Data Science"],
  },
  {
    label: "Business",
    items: ["Business Administration", "Finance", "Accounting", "Economics", "Marketing"],
  },
  {
    label: "Engineering",
    items: ["Mechanical Engineering", "Electrical Engineering", "Industrial Engineering"],
  },
  {
    label: "Sciences & Social Sciences",
    items: ["Psychology", "Political Science", "Mathematics", "Statistics"],
  },
]);

export const flattenOptions = (groups: readonly OptionGroup[]): string[] =>
  groups.flatMap((g) => [...g.items]);
