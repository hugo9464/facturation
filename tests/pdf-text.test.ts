import * as assert from "node:assert/strict";
import React from "react";
import { Document, Page, Text, renderToBuffer } from "@react-pdf/renderer";
import { PdfTextExtractionError, extractPdfText } from "../lib/pdf-text";

async function run() {
  const pdf = React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      null,
      React.createElement(
        Text,
        null,
        "CV Hugo Faye developpeur Next.js Supabase OpenAI",
      ),
    ),
  );

  const buffer = Buffer.from(await renderToBuffer(pdf));
  const text = await extractPdfText(buffer);
  assert.match(text, /CV Hugo Faye/);
  assert.doesNotMatch(text, /-- 1 of 1 --/);

  await assert.rejects(
    () => extractPdfText(Buffer.from("not a pdf")),
    (error) =>
      error instanceof PdfTextExtractionError &&
      error.message === "Le fichier ne semble pas être un PDF valide.",
  );

  console.log("pdf text tests passed");
}

void run();
