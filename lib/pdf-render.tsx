import { renderToBuffer } from "@react-pdf/renderer";
import { InvoicePDF } from "@/components/invoice-pdf";
import { QuotePDF } from "@/components/quote-pdf";
import type {
  Client,
  Invoice,
  InvoiceLine,
  Profile,
  Quote,
  QuoteLine,
} from "@/db/schema";

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
