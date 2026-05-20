import { renderToBuffer } from "@react-pdf/renderer";
import { InvoicePDF } from "@/components/invoice-pdf";
import { ProspectionCvPDF } from "@/components/prospection-cv-pdf";
import { QuotePDF } from "@/components/quote-pdf";
import type {
  Client,
  Invoice,
  InvoiceLine,
  Profile,
  Quote,
  QuoteLine,
} from "@/db/schema";
import type { TailoredCv } from "@/lib/prospection-cv";

export async function renderInvoicePDFToBuffer(input: {
  invoice: Invoice;
  lines: InvoiceLine[];
  client: Client;
  profile: Profile;
}): Promise<Buffer> {
  return renderToBuffer(<InvoicePDF {...input} />);
}

export async function renderQuotePDFToBuffer(input: {
  quote: Quote;
  lines: QuoteLine[];
  client: Client;
  profile: Profile;
}): Promise<Buffer> {
  return renderToBuffer(<QuotePDF {...input} />);
}

export async function renderProspectionCvPDFToBuffer(input: {
  cv: TailoredCv;
  photoDataUrl: string | null;
}): Promise<Buffer> {
  return renderToBuffer(<ProspectionCvPDF {...input} />);
}
