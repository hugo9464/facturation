import {
  FormatError,
  InvalidPDFException,
  PasswordException,
  PDFParse,
} from "pdf-parse";

const MAX_EXTRACTED_TEXT_LENGTH = 35_000;

export class PdfTextExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfTextExtractionError";
  }
}

function normalizePdfText(value: string) {
  return value
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_EXTRACTED_TEXT_LENGTH);
}

function toPdfTextError(error: unknown) {
  if (error instanceof PasswordException) {
    return new PdfTextExtractionError(
      "Ce PDF est protégé par mot de passe. Exporte une version non protégée puis réessaie.",
    );
  }

  if (error instanceof InvalidPDFException || error instanceof FormatError) {
    return new PdfTextExtractionError(
      "Ce fichier PDF semble invalide ou corrompu. Réexporte-le en PDF standard puis réessaie.",
    );
  }

  return new PdfTextExtractionError(
    "Impossible de lire ce PDF. Réexporte-le en PDF standard, non protégé, puis réessaie.",
  );
}

export async function extractPdfText(buffer: Buffer) {
  if (buffer.subarray(0, 4).toString("latin1") !== "%PDF") {
    throw new PdfTextExtractionError("Le fichier ne semble pas être un PDF valide.");
  }

  const data = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const parser = new PDFParse({ data, stopAtErrors: false });
  let parseError: unknown = null;

  try {
    const result = await parser.getText({ pageJoiner: "\n" });
    return normalizePdfText(result.text);
  } catch (error) {
    parseError = error;
    throw toPdfTextError(error);
  } finally {
    try {
      await parser.destroy();
    } catch (destroyError) {
      if (!parseError) {
        console.warn("PDF cleanup failed after successful extraction", destroyError);
      }
    }
  }
}
