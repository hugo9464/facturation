import Link from "next/link";
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
import { Plus } from "lucide-react";
import { getSupabaseDb, toInvoice } from "@/lib/supabase/db";

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
  const supabase = await getSupabaseDb();
  const { data, error } = await supabase
    .from("invoice")
    .select("*, client:client_id(name)")
    .eq("user_id", user.id)
    .order("issue_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []).map((row) => ({
    invoice: toInvoice(row),
    clientName: Array.isArray(row.client) ? row.client[0]?.name : row.client?.name,
  }));

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
                <TableHead>Email</TableHead>
                <TableHead>Montant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const href = `/invoices/${r.invoice.id}`;
                return (
                  <TableRow key={r.invoice.id} className="cursor-pointer">
                    <TableCell className="font-mono text-sm">
                      <Link
                        href={href}
                        className="-m-2 block p-2"
                        aria-label={`Ouvrir la facture ${
                          r.invoice.number ?? r.invoice.id
                        }`}
                      >
                        {r.invoice.number ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={href} className="-m-2 block p-2">
                        {formatDate(r.invoice.issueDate)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={href} className="-m-2 block p-2">
                        {r.clientName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={href} className="-m-2 block p-2">
                        <Badge variant={STATUS_VARIANTS[r.invoice.status]}>
                          {STATUS_LABELS[r.invoice.status]}
                        </Badge>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={href} className="-m-2 block p-2">
                        {r.invoice.emailSentAt ? (
                          <span className="text-emerald-600">
                            Envoyée le {formatDateTime(r.invoice.emailSentAt)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={href} className="-m-2 block p-2">
                        {formatCents(r.invoice.totalCents)}
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
