import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import {
  client as clientTable,
  invoice,
  quote,
  quoteLine,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";
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
import { formatDate } from "@/lib/dates";
import { rateTypeLabel } from "@/lib/invoice-grouping";
import { QuoteActions } from "./quote-actions";
import { QuoteLineEditor } from "./quote-line-editor";
import { QuoteDetailsEditor } from "./quote-details-editor";
import { ArrowLeft } from "lucide-react";

const STATUS_LABELS = {
  DRAFT: "Brouillon",
  SENT: "Envoyé",
  ACCEPTED: "Accepté",
  REJECTED: "Refusé",
  EXPIRED: "Expiré",
} as const;

const STATUS_VARIANTS = {
  DRAFT: "secondary",
  SENT: "default",
  ACCEPTED: "default",
  REJECTED: "outline",
  EXPIRED: "outline",
} as const;

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const [q] = await db
    .select()
    .from(quote)
    .where(and(eq(quote.id, id), eq(quote.userId, user.id)))
    .limit(1);
  if (!q) notFound();

  const [c] = await db
    .select()
    .from(clientTable)
    .where(eq(clientTable.id, q.clientId))
    .limit(1);

  const lines = await db
    .select()
    .from(quoteLine)
    .where(eq(quoteLine.quoteId, id))
    .orderBy(quoteLine.order);

  const convertedInvoice = q.convertedInvoiceId
    ? (
        await db
          .select({
            id: invoice.id,
            number: invoice.number,
            status: invoice.status,
          })
          .from(invoice)
          .where(eq(invoice.id, q.convertedInvoiceId))
          .limit(1)
      )[0]
    : null;

  const editable = q.status === "DRAFT" || q.status === "SENT";

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <ButtonLink
          href="/quotes"
          variant="ghost"
          size="sm"
          className="mb-2 -ml-2"
        >
          <ArrowLeft className="size-4" />
          Tous les devis
        </ButtonLink>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-3">
              Devis {q.number ?? "(brouillon)"}
              <Badge variant={STATUS_VARIANTS[q.status]}>
                {STATUS_LABELS[q.status]}
              </Badge>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {c?.name} · Émis le {formatDate(q.issueDate)} · Valable jusqu&apos;au{" "}
              {formatDate(q.validUntil)}
            </p>
          </div>
          <QuoteActions quote={q} />
        </div>
      </div>

      {convertedInvoice && (
        <div className="rounded-md border bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-sm">
          <p className="font-medium text-emerald-900 dark:text-emerald-200">
            Devis converti en facture {convertedInvoice.number ?? "brouillon"}
          </p>
          <Link
            href={`/invoices/${convertedInvoice.id}`}
            className="text-emerald-700 dark:text-emerald-300 underline underline-offset-2"
          >
            Voir la facture →
          </Link>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qté</TableHead>
                  <TableHead className="text-right">P.U.</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  {editable && <TableHead></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={editable ? 5 : 4}
                      className="text-center py-8 text-muted-foreground"
                    >
                      Aucune ligne. Ajoute-en avec le formulaire ci-dessous.
                    </TableCell>
                  </TableRow>
                )}
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
                    {editable && (
                      <TableCell className="text-right">
                        <QuoteLineEditor.DeleteButton
                          quoteId={id}
                          lineId={l.id}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={editable ? 3 : 2}></TableCell>
                  <TableCell className="text-right font-semibold">
                    Total HT
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCents(q.totalCents)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          {editable && <QuoteLineEditor.AddForm quoteId={id} />}
          {editable && <QuoteDetailsEditor quote={q} />}
          {!editable && q.notes && (
            <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm italic">
              {q.notes}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Aperçu PDF
          </p>
          <iframe
            src={`/api/quotes/${id}/pdf`}
            className="w-full h-[800px] rounded-md border bg-muted"
            title={`Devis ${q.number ?? "brouillon"}`}
          />
        </div>
      </div>
    </div>
  );
}
