import Link from "next/link";
import { requireUser } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCents } from "@/lib/money";
import { formatDate, startOfMonthISO, startOfYearISO, todayISO } from "@/lib/dates";
import { plafondLimitCents } from "@/lib/legal";
import { getProfile, getSupabaseDb, toInvoice, toTimeEntry } from "@/lib/supabase/db";

export default async function DashboardPage() {
  const user = await requireUser();
  const today = todayISO();
  const monthStart = startOfMonthISO();
  const yearStart = startOfYearISO();
  const supabase = await getSupabaseDb();

  const [profileRow, invoicesResult, monthEntriesResult, overdueResult] =
    await Promise.all([
      getProfile(user.id),
      supabase.from("invoice").select("*").eq("user_id", user.id),
      supabase
        .from("time_entry")
        .select("*")
        .eq("user_id", user.id)
        .gte("date", monthStart),
      supabase
        .from("invoice")
        .select("*, client:client_id(name)")
        .eq("user_id", user.id)
        .eq("status", "SENT")
        .lte("due_date", today)
        .order("due_date", { ascending: false })
        .limit(10),
    ]);
  if (invoicesResult.error) throw invoicesResult.error;
  if (monthEntriesResult.error) throw monthEntriesResult.error;
  if (overdueResult.error) throw overdueResult.error;

  const invoices = (invoicesResult.data ?? []).map(toInvoice);
  const monthEntries = (monthEntriesResult.data ?? []).map(toTimeEntry);
  const billableInvoices = invoices.filter((item) => item.status !== "CANCELLED");
  const monthCACents = billableInvoices
    .filter((item) => item.issueDate >= monthStart)
    .reduce((sum, item) => sum + item.totalCents, 0);
  const yearCACents = billableInvoices
    .filter((item) => item.issueDate >= yearStart)
    .reduce((sum, item) => sum + item.totalCents, 0);
  const unpaid = invoices.filter(
    (item) => item.status === "SENT" || item.status === "OVERDUE",
  );
  const unpaidCents = unpaid.reduce((sum, item) => sum + item.totalCents, 0);
  const unpaidCount = unpaid.length;
  const monthDays = monthEntries.reduce((sum, entry) => {
    if (entry.type === "DAY") return sum + Number(entry.quantity);
    if (entry.type === "HALF_DAY") return sum + Number(entry.quantity) * 0.5;
    if (entry.type === "HOUR") return sum + Number(entry.quantity) / 8;
    return sum;
  }, 0);
  const overdueInvoices = (overdueResult.data ?? []).map((row) => {
    const invoice = toInvoice(row);
    return {
      id: invoice.id,
      number: invoice.number,
      totalCents: invoice.totalCents,
      dueDate: invoice.dueDate,
      issueDate: invoice.issueDate,
      clientName: Array.isArray(row.client) ? row.client[0]?.name : row.client?.name,
    };
  });

  const plafondCents = plafondLimitCents(profileRow?.plafondType ?? "BNC");
  const plafondPct = Math.min(100, (yearCACents / plafondCents) * 100);
  const plafondAlert = plafondPct > 80;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Vue d&apos;ensemble de ton activité.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>CA ce mois</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatCents(monthCACents)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>CA cette année</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatCents(yearCACents)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Jours travaillés (mois)</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {monthDays.toFixed(2).replace(".", ",")}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Impayés</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatCents(unpaidCents)}
            </CardTitle>
            <CardDescription className="text-xs pt-1">
              {unpaidCount} {unpaidCount > 1 ? "factures" : "facture"}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                Plafond {profileRow?.plafondType === "BIC" ? "BIC" : "BNC"}
              </CardTitle>
              <CardDescription>
                {formatCents(yearCACents)} sur {formatCents(plafondCents)}
              </CardDescription>
            </div>
            {plafondAlert && (
              <Badge variant="destructive">
                Attention — {plafondPct.toFixed(0)} %
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={
                plafondAlert
                  ? "h-full bg-destructive transition-all"
                  : "h-full bg-foreground/80 transition-all"
              }
              style={{ width: `${plafondPct}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {overdueInvoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">
              Factures en retard
            </CardTitle>
            <CardDescription>
              {overdueInvoices.length}{" "}
              {overdueInvoices.length > 1 ? "factures" : "facture"} dont
              l&apos;échéance est passée.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {overdueInvoices.map((inv) => (
                <Link
                  key={inv.id}
                  href={`/invoices/${inv.id}`}
                  className="flex items-center justify-between gap-4 rounded-md border px-4 py-2 text-sm hover:bg-muted/50"
                >
                  <span className="font-mono">{inv.number}</span>
                  <span className="flex-1">{inv.clientName}</span>
                  <span className="text-muted-foreground">
                    Échéance {formatDate(inv.dueDate)}
                  </span>
                  <span className="font-medium">
                    {formatCents(inv.totalCents)}
                  </span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <ButtonLink href="/invoices/new">Nouvelle facture</ButtonLink>
        <ButtonLink href="/clients/new" variant="outline">
          Nouveau client
        </ButtonLink>
        <ButtonLink href="/time" variant="outline">
          Voir les temps
        </ButtonLink>
      </div>
    </div>
  );
}
