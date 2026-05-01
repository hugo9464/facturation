import { db } from "@/db";
import { client, quote } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
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
import { Plus } from "lucide-react";

const STATUS_VARIANTS = {
  DRAFT: "secondary",
  SENT: "default",
  ACCEPTED: "default",
  REJECTED: "outline",
  EXPIRED: "outline",
} as const;

const STATUS_LABELS = {
  DRAFT: "Brouillon",
  SENT: "Envoyé",
  ACCEPTED: "Accepté",
  REJECTED: "Refusé",
  EXPIRED: "Expiré",
} as const;

export default async function QuotesPage() {
  const user = await requireUser();
  const rows = await db
    .select({
      quote,
      clientName: client.name,
    })
    .from(quote)
    .innerJoin(client, eq(client.id, quote.clientId))
    .where(eq(quote.userId, user.id))
    .orderBy(desc(quote.issueDate), desc(quote.createdAt));

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Devis</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {rows.length} {rows.length > 1 ? "devis" : "devis"}
          </p>
        </div>
        <ButtonLink href="/quotes/new">
          <Plus className="size-4" />
          Nouveau
        </ButtonLink>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            Aucun devis. Crée ton premier devis pour le faire signer par un
            client.
          </p>
          <ButtonLink href="/quotes/new" className="mt-4">
            Créer un devis
          </ButtonLink>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N°</TableHead>
                <TableHead>Émis le</TableHead>
                <TableHead>Validité</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.quote.id}>
                  <TableCell className="font-mono text-sm">
                    {r.quote.number ?? "—"}
                  </TableCell>
                  <TableCell>{formatDate(r.quote.issueDate)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(r.quote.validUntil)}
                  </TableCell>
                  <TableCell>{r.clientName}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[r.quote.status]}>
                      {STATUS_LABELS[r.quote.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatCents(r.quote.totalCents)}</TableCell>
                  <TableCell className="text-right">
                    <ButtonLink
                      href={`/quotes/${r.quote.id}`}
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
