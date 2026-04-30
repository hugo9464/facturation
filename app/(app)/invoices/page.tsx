import Link from "next/link";
import { db } from "@/db";
import { client, invoice } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
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
import { Plus } from "lucide-react";

const STATUS_VARIANTS = {
  DRAFT: "secondary",
  SENT: "default",
  PAID: "default",
  OVERDUE: "destructive",
  CANCELLED: "outline",
} as const;

const STATUS_LABELS = {
  DRAFT: "Brouillon",
  SENT: "Émise",
  PAID: "Payée",
  OVERDUE: "En retard",
  CANCELLED: "Annulée",
} as const;

export default async function InvoicesPage() {
  const user = await requireUser();
  const rows = await db
    .select({
      invoice,
      clientName: client.name,
    })
    .from(invoice)
    .innerJoin(client, eq(client.id, invoice.clientId))
    .where(eq(invoice.userId, user.id))
    .orderBy(desc(invoice.issueDate), desc(invoice.createdAt));

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Factures</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {rows.length} {rows.length > 1 ? "factures" : "facture"}
          </p>
        </div>
        <ButtonLink href="/invoices/new">
          <Plus className="size-4" />
          Nouvelle
        </ButtonLink>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            Aucune facture. Crée ta première à partir de tes saisies.
          </p>
          <ButtonLink href="/invoices/new" className="mt-4">
            Créer une facture
          </ButtonLink>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N°</TableHead>
                <TableHead>Émise le</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.invoice.id}>
                  <TableCell className="font-mono text-sm">
                    {r.invoice.number ?? "—"}
                  </TableCell>
                  <TableCell>{formatDate(r.invoice.issueDate)}</TableCell>
                  <TableCell>{r.clientName}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[r.invoice.status]}>
                      {STATUS_LABELS[r.invoice.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatCents(r.invoice.totalCents)}</TableCell>
                  <TableCell className="text-right">
                    <ButtonLink
                      href={`/invoices/${r.invoice.id}`}
                      variant="ghost"
                      size="sm"
                    >
                      Détail
                    </ButtonLink>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
