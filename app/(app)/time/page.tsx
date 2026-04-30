import { db } from "@/db";
import { client, timeEntry } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { formatCents } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { rateTypeLabel } from "@/lib/invoice-grouping";
import { startOfWeek, format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { EntryRowActions } from "./entry-row-actions";

export default async function TimePage() {
  const user = await requireUser();
  const [rows, clients] = await Promise.all([
    db
      .select({
        entry: timeEntry,
        clientName: client.name,
      })
      .from(timeEntry)
      .innerJoin(client, eq(client.id, timeEntry.clientId))
      .where(eq(timeEntry.userId, user.id))
      .orderBy(desc(timeEntry.date), desc(timeEntry.createdAt)),
    db
      .select()
      .from(client)
      .where(and(eq(client.userId, user.id), eq(client.archived, false)))
      .orderBy(client.name),
  ]);

  // Group by ISO week
  const groups = new Map<
    string,
    {
      weekStart: Date;
      entries: typeof rows;
      totalCents: number;
      totalDays: number;
    }
  >();

  for (const r of rows) {
    const ws = startOfWeek(parseISO(r.entry.date), { weekStartsOn: 1 });
    const key = format(ws, "yyyy-MM-dd");
    const existing = groups.get(key) ?? {
      weekStart: ws,
      entries: [],
      totalCents: 0,
      totalDays: 0,
    };
    existing.entries.push(r);
    existing.totalCents += Math.round(
      Number(r.entry.quantity) * r.entry.rateCents,
    );
    if (r.entry.type === "DAY") existing.totalDays += Number(r.entry.quantity);
    if (r.entry.type === "HALF_DAY")
      existing.totalDays += Number(r.entry.quantity) * 0.5;
    if (r.entry.type === "HOUR")
      existing.totalDays += Number(r.entry.quantity) / 8;
    groups.set(key, existing);
  }

  const weeks = Array.from(groups.values()).sort(
    (a, b) => b.weekStart.getTime() - a.weekStart.getTime(),
  );

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Temps</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {rows.length} {rows.length > 1 ? "saisies" : "saisie"} — utilise le
          bouton « Logger temps » en haut pour ajouter.
        </p>
      </div>

      {weeks.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            Aucune saisie pour l&apos;instant.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {weeks.map((w) => (
            <div key={w.weekStart.toISOString()} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <h2 className="font-medium">
                  Semaine du {format(w.weekStart, "d MMMM yyyy", { locale: fr })}
                </h2>
                <p className="text-muted-foreground">
                  {w.totalDays.toFixed(2).replace(".", ",")} j ·{" "}
                  <span className="font-medium text-foreground">
                    {formatCents(w.totalCents)}
                  </span>
                </p>
              </div>
              <div className="rounded-md border divide-y">
                {w.entries.map((r) => {
                  const totalCents = Math.round(
                    Number(r.entry.quantity) * r.entry.rateCents,
                  );
                  return (
                    <div
                      key={r.entry.id}
                      className="flex items-center gap-4 px-4 py-3 text-sm"
                    >
                      <span className="w-20 text-muted-foreground">
                        {formatDate(r.entry.date)}
                      </span>
                      <span className="font-medium min-w-[8rem]">
                        {r.clientName}
                      </span>
                      <span className="text-muted-foreground min-w-[6rem]">
                        {r.entry.quantity} {rateTypeLabel(r.entry.type)}
                      </span>
                      <span className="flex-1 text-muted-foreground truncate">
                        {r.entry.description}
                      </span>
                      <span className="font-medium">
                        {formatCents(totalCents)}
                      </span>
                      {r.entry.invoiceId ? (
                        <Badge variant="secondary" className="text-[10px]">
                          facturé
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          non facturé
                        </Badge>
                      )}
                      {!r.entry.invoiceId && (
                        <EntryRowActions
                          entry={r.entry}
                          clients={clients}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
