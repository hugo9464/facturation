import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";
import {
  getClientMissingFields,
  getProfileMissingFields,
} from "@/lib/billing-readiness";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClientEditForm } from "./client-edit-form";
import { ArchiveButton } from "./archive-button";
import { formatCents } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { rateTypeLabel } from "@/lib/invoice-grouping";
import {
  getProfile,
  getSupabaseDb,
  toClient,
  toInvoice,
  toTimeEntry,
} from "@/lib/supabase/db";

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

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await getSupabaseDb();

  const { data: clientRow, error: clientError } = await supabase
    .from("client")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (clientError) throw clientError;
  const c = clientRow ? toClient(clientRow) : null;
  if (!c) notFound();

  const profileRow = await getProfile(user.id);

  const [entriesResult, invoicesResult] = await Promise.all([
    supabase
      .from("time_entry")
      .select("*")
      .eq("client_id", c.id)
      .eq("user_id", user.id)
      .is("invoice_id", null)
      .order("date", { ascending: false })
      .limit(50),
    supabase
      .from("invoice")
      .select("*")
      .eq("client_id", c.id)
      .eq("user_id", user.id)
      .order("issue_date", { ascending: false })
      .limit(20),
  ]);
  if (entriesResult.error) throw entriesResult.error;
  if (invoicesResult.error) throw invoicesResult.error;
  const unbilledEntries = (entriesResult.data ?? []).map(toTimeEntry);
  const recentInvoices = (invoicesResult.data ?? []).map(toInvoice);

  const unbilledTotalCents = unbilledEntries.reduce(
    (acc, e) => acc + Math.round(Number(e.quantity) * e.rateCents),
    0,
  );

  const profileMissing = getProfileMissingFields(profileRow);
  const clientMissing = getClientMissingFields(c);
  const billable = profileMissing.length === 0 && clientMissing.length === 0;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            {c.name}
            {c.archived && <Badge variant="secondary">archivé</Badge>}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {formatCents(c.defaultRateCents)} / {rateTypeLabel(c.defaultRateType)}
          </p>
        </div>
        <div className="flex gap-2">
          {!c.archived && unbilledEntries.length > 0 && (
            <ButtonLink
              href={`/invoices/new?client=${c.id}`}
              variant={billable ? "default" : "outline"}
            >
              {billable
                ? `Facturer (${formatCents(unbilledTotalCents)})`
                : `Voir (${formatCents(unbilledTotalCents)})`}
            </ButtonLink>
          )}
          <ArchiveButton id={c.id} archived={c.archived} />
        </div>
      </div>

      {!billable && unbilledEntries.length > 0 && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-2">
          <div className="flex items-start gap-2 text-destructive">
            <AlertCircle className="size-4 mt-0.5 shrink-0" />
            <p className="text-sm font-medium">
              Pas encore prêt à facturer
            </p>
          </div>
          <div className="pl-6 text-sm space-y-1.5">
            {clientMissing.length > 0 && (
              <p>
                <span className="font-medium">Ce client : </span>
                <span className="text-muted-foreground">
                  {clientMissing.map((m) => m.label).join(", ")}
                </span>
              </p>
            )}
            {profileMissing.length > 0 && (
              <p>
                <span className="font-medium">Tes paramètres : </span>
                <span className="text-muted-foreground">
                  {profileMissing.map((m) => m.label).join(", ")}
                </span>{" "}
                <ButtonLink
                  href="/settings"
                  size="sm"
                  variant="ghost"
                  className="h-auto py-0 px-1"
                >
                  → corriger
                </ButtonLink>
              </p>
            )}
          </div>
        </div>
      )}

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Infos</TabsTrigger>
          <TabsTrigger value="entries">
            Saisies non facturées ({unbilledEntries.length})
          </TabsTrigger>
          <TabsTrigger value="invoices">
            Factures ({recentInvoices.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="info" className="pt-4">
          <ClientEditForm initial={c} />
        </TabsContent>
        <TabsContent value="entries" className="pt-4">
          {unbilledEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">
              Aucune saisie non facturée.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Qté</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unbilledEntries.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>{formatDate(e.date)}</TableCell>
                      <TableCell>{rateTypeLabel(e.type)}</TableCell>
                      <TableCell>{e.quantity}</TableCell>
                      <TableCell>
                        {formatCents(
                          Math.round(Number(e.quantity) * e.rateCents),
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-xs truncate">
                        {e.description}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
        <TabsContent value="invoices" className="pt-4">
          {recentInvoices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">
              Aucune facture pour ce client.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N°</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentInvoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-sm">
                        {inv.number ?? "—"}
                      </TableCell>
                      <TableCell>{formatDate(inv.issueDate)}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANTS[inv.status]}>
                          {STATUS_LABELS[inv.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatCents(inv.totalCents)}</TableCell>
                      <TableCell className="text-right">
                        <ButtonLink
                          href={`/invoices/${inv.id}`}
                          variant="ghost"
                          size="sm"
                        >
                          Voir
                        </ButtonLink>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
