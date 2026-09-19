import { extractText, getDocumentProxy } from "unpdf";

/**
 * PDF to plain text.
 *
 * Databricks `ai_query` takes a string, and the warehouse's own
 * `students.resume_text` column is plain text, so the PDF has to be flattened
 * before it can be read there. This reads the embedded text layer only — there
 * is no OCR, so a scanned or photographed resume yields nothing and the caller
 * has to say so rather than sending an empty prompt to a model.
 */
export const MIN_USEFUL_CHARS = 120;

export class UnreadablePdfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnreadablePdfError";
  }
}

export async function pdfToText(bytes: Uint8Array): Promise<string> {
  let text: string;
  try {
    const pdf = await getDocumentProxy(bytes);
    ({ text } = await extractText(pdf, { mergePages: true }));
  } catch (error) {
    throw new UnreadablePdfError(
      `That PDF could not be opened (${error instanceof Error ? error.message : "unknown"}).`,
    );
  }

  const cleaned = text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (cleaned.length < MIN_USEFUL_CHARS) {
    throw new UnreadablePdfError(
      "That PDF has almost no selectable text, which usually means it is a scan or an image. " +
        "Export a text-based PDF from Word, Google Docs or LaTeX and try again.",
    );
  }
  return cleaned;
}
