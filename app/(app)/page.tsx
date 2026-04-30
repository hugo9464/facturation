import Link from "next/link";
import { db } from "@/db";
import { client, invoice, profile, timeEntry } from "@/db/schema";
import { and, eq, gte, lte, desc, sql } from "drizzle-orm";
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

export default async function DashboardPage() {
  const user = await requireUser();
  const today = todayISO();
  const monthStart = startOfMonthISO();
  const yearStart = startOfYearISO();

  const [profileRow] = await db
    .select()
    .from(profile)
    .where(eq(profile.userId, user.id))
    .limit(1);

  // Aggregations
  const [monthCAResult] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${invoice.totalCents}), 0)`,
    })
    .from(invoice)
    .where(
      and(
        eq(invoice.userId, user.id),
        gte(invoice.issueDate, monthStart),
        sql`${invoice.status} <> 'CANCELLED'`,
      ),
    );

  const [yearCAResult] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${invoice.totalCents}), 0)`,
    })
    .from(invoice)
    .where(
      and(
        eq(invoice.userId, user.id),
        gte(invoice.issueDate, yearStart),
        sql`${invoice.status} <> 'CANCELLED'`,
      ),
    );

  const [monthDaysResult] = await db
    .select({
      total: sql<string>`COALESCE(SUM(
        CASE ${timeEntry.type}
          WHEN 'DAY' THEN ${timeEntry.quantity}
          WHEN 'HALF_DAY' THEN ${timeEntry.quantity} * 0.5
          WHEN 'HOUR' THEN ${timeEntry.quantity} / 8.0
          ELSE 0 END
      ), 0)`,
    })
    .from(timeEntry)
    .where(
      and(eq(timeEntry.userId, user.id), gte(timeEntry.date, monthStart)),
    );

  const [unpaidResult] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${invoice.totalCents}), 0)`,
      count: sql<string>`COUNT(*)`,
    })
    .from(invoice)
    .where(
      and(
        eq(invoice.userId, user.id),
        sql`${invoice.status} IN ('SENT', 'OVERDUE')`,
      ),
    );

  const overdueInvoices = await db
    .select({
      id: invoice.id,
      number: invoice.number,
      totalCents: invoice.totalCents,
      dueDate: invoice.dueDate,
      issueDate: invoice.issueDate,
      clientName: client.name,
    })
    .from(invoice)
    .innerJoin(client, eq(client.id, invoice.clientId))
    .where(
      and(
        eq(invoice.userId, user.id),
        sql`${invoice.status} = 'SENT'`,
        lte(invoice.dueDate, today),
      ),
    )
    .orderBy(desc(invoice.dueDate))
    .limit(10);

  const monthCACents = Number(monthCAResult.total);
  const yearCACents = Number(yearCAResult.total);
  const unpaidCents = Number(unpaidResult.total);
  const unpaidCount = Number(unpaidResult.count);
  const monthDays = Number(monthDaysResult.total);

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
