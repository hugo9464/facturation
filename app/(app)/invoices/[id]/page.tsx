import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import {
  client as clientTable,
  invoice,
  invoiceLine,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { Button, ButtonLink } from "@/components/ui/button";
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
import { formatDate } from "@/lib/dates";
import { rateTypeLabel } from "@/lib/invoice-grouping";
import { InvoiceActions } from "./invoice-actions";
import { DraftLineEditor } from "./draft-line-editor";
import { DraftDetailsEditor } from "./draft-details-editor";
import { ArrowLeft } from "lucide-react";

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

  const [inv] = await db
    .select()
    .from(invoice)
    .where(and(eq(invoice.id, id), eq(invoice.userId, user.id)))
    .limit(1);
  if (!inv) notFound();

  const [c] = await db
    .select()
    .from(clientTable)
    .where(eq(clientTable.id, inv.clientId))
    .limit(1);

  const lines = await db
    .select()
    .from(invoiceLine)
    .where(eq(invoiceLine.invoiceId, id))
    .orderBy(invoiceLine.order);

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
          </div>
          <InvoiceActions invoice={inv} />
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
                    <TableCell className="max-w-xs">{l.description}</TableCell>
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
                        <DraftLineEditor.DeleteButton
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
          {isDraft && <DraftLineEditor.AddForm invoiceId={id} />}
          {isDraft && <DraftDetailsEditor invoice={inv} />}
          {!isDraft && inv.notes && (
            <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm italic">
              {inv.notes}
            </div>
          )}
          {inv.status === "PAID" && (
            <div className="rounded-md border bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-sm">
              <p className="font-medium text-emerald-900 dark:text-emerald-200">
                Payée le {inv.paidAt ? formatDate(inv.paidAt.toString()) : "—"}
              </p>
              {inv.paymentMethod && (
                <p className="text-emerald-800 dark:text-emerald-300 mt-1">
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
