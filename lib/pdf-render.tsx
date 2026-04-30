import { renderToBuffer } from "@react-pdf/renderer";
import { InvoicePDF } from "@/components/invoice-pdf";
import type {
  Client,
  Invoice,
  InvoiceLine,
  Profile,
} from "@/db/schema";

export async function renderInvoicePDFToBuffer(input: {
  invoice: Invoice;
  lines: InvoiceLine[];
  client: Client;
  profile: Profile;
}): Promise<Buffer> {
  return renderToBuffer(<InvoicePDF {...input} />);
}
