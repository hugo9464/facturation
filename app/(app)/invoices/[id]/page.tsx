import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCents } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/dates";
import { rateTypeLabel } from "@/lib/invoice-grouping";
import { InvoiceActions } from "./invoice-actions";
import {
  AddInvoiceLineForm,
  DeleteInvoiceLineButton,
  EditInvoiceLineDescription,
} from "./draft-line-editor";
import { DraftDetailsEditor } from "./draft-details-editor";
import { ArrowLeft } from "lucide-react";
import {
  getSupabaseDb,
  toClient,
  toInvoice,
  toInvoiceLine,
} from "@/lib/supabase/db";

const STATUS_LABELS = {
  DRAFT: "Brouillon",
  SENT: "Émise",
  PAID: "Payée",
  OVERDUE: "En retard",
  CANCELLED: "Annulée",
} as const;

const STATUS_VARIANTS = {
  DRAFT: "secondary",
  SENT: "default",
  PAID: "default",
  OVERDUE: "destructive",
  CANCELLED: "outline",
} as const;

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await getSupabaseDb();

  const { data: invoiceRow, error: invoiceError } = await supabase
    .from("invoice")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (invoiceError) throw invoiceError;
  const inv = invoiceRow ? toInvoice(invoiceRow) : null;
  if (!inv) notFound();

  const [{ data: clientRow, error: clientError }, { data: lineRows, error: linesError }] =
    await Promise.all([
      supabase
        .from("client")
        .select("*")
        .eq("id", inv.clientId)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("invoice_line")
        .select("*")
        .eq("invoice_id", id)
        .order("order", { ascending: true }),
    ]);
  if (clientError) throw clientError;
  if (linesError) throw linesError;

  const c = clientRow ? toClient(clientRow) : null;
  const lines = (lineRows ?? []).map(toInvoiceLine);

  const isDraft = inv.status === "DRAFT";

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <ButtonLink
          href="/invoices"
          variant="ghost"
          size="sm"
          className="mb-2 -ml-2"
        >
          <ArrowLeft className="size-4" />
          Toutes les factures
        </ButtonLink>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-3">
              Facture {inv.number ?? "(brouillon)"}
              <Badge variant={STATUS_VARIANTS[inv.status]}>
                {STATUS_LABELS[inv.status]}
              </Badge>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {c?.name} · Émise le {formatDate(inv.issueDate)} · Échéance{" "}
              {formatDate(inv.dueDate)}
            </p>
            {inv.emailSentAt && (
              <p className="mt-1 text-sm text-emerald-600">
                Envoyée par email le {formatDateTime(inv.emailSentAt)}
              </p>
            )}
          </div>
          <InvoiceActions invoice={inv} clientEmail={c?.email ?? null} />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Lines + edit */}
        <div className="space-y-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qté</TableHead>
                  <TableHead className="text-right">P.U.</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  {isDraft && <TableHead></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="max-w-xs whitespace-pre-line">
                      {isDraft ? (
                        <EditInvoiceLineDescription
                          invoiceId={id}
                          lineId={l.id}
                          description={l.description}
                        />
                      ) : (
                        l.description
                      )}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {l.quantity} {rateTypeLabel(l.unitType)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCents(l.unitPriceCents)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCents(l.totalCents)}
                    </TableCell>
                    {isDraft && (
                      <TableCell className="text-right">
                        <DeleteInvoiceLineButton
                          invoiceId={id}
                          lineId={l.id}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={isDraft ? 3 : 2}></TableCell>
                  <TableCell className="text-right font-semibold">
                    Total HT
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCents(inv.totalCents)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          {isDraft && <AddInvoiceLineForm invoiceId={id} />}
          {isDraft && <DraftDetailsEditor invoice={inv} />}
          {!isDraft && inv.notes && (
            <div className="rounded-md border bg-muted/35 px-4 py-3 text-sm italic">
              {inv.notes}
            </div>
          )}
          {inv.status === "PAID" && (
            <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm">
              <p className="font-medium text-emerald-200">
                Payée le {inv.paidAt ? formatDate(inv.paidAt.toString()) : "—"}
              </p>
              {inv.paymentMethod && (
                <p className="mt-1 text-emerald-300">
                  {inv.paymentMethod}
                  {inv.paymentReference ? ` — ${inv.paymentReference}` : ""}
                </p>
              )}
            </div>
          )}
        </div>

        {/* PDF preview */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Aperçu PDF
          </p>
          <iframe
            src={`/api/invoices/${id}/pdf`}
            className="w-full h-[800px] rounded-md border bg-muted"
            title={`Facture ${inv.number ?? "brouillon"}`}
          />
        </div>
      </div>
    </div>
  );
}
