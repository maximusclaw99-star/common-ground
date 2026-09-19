const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  "#39": "'", "#x27": "'", "#x2F": "/", "#47": "/", "#160": " ",
};

function decodeEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, code: string) => {
    const known = ENTITIES[code];
    if (known !== undefined) return known;
    if (code.startsWith("#x") || code.startsWith("#X")) {
      const n = Number.parseInt(code.slice(2), 16);
      return Number.isNaN(n) ? match : String.fromCodePoint(n);
    }
    if (code.startsWith("#")) {
      const n = Number.parseInt(code.slice(1), 10);
      return Number.isNaN(n) ? match : String.fromCodePoint(n);
    }
    return match;
  });
}

/**
 * Greenhouse returns job content as HTML-entity-encoded markup, so it needs
 * decoding BEFORE tag stripping or the tags are still entities. Decoding twice
 * is intentional and safe here: the payload is display text bound for the model
 * and the DB, never re-inserted into the DOM as HTML.
 */
export function htmlToText(input: string | null | undefined): string | null {
  if (!input) return null;
  const text = decodeEntities(decodeEntities(input))
    .replace(/<\s*(br|\/p|\/div|\/li|\/h[1-6])\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/[ \t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text.length > 0 ? text : null;
}
