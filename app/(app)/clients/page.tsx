import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { ButtonLink } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCents } from "@/lib/money";
import { rateTypeLabel } from "@/lib/invoice-grouping";
import { Plus } from "lucide-react";
import { getSupabaseDb, toClient } from "@/lib/supabase/db";

export default async function ClientsPage() {
  const user = await requireUser();
  const supabase = await getSupabaseDb();
  const { data, error } = await supabase
    .from("client")
    .select("*")
    .eq("user_id", user.id)
    .order("name", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []).map(toClient);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {rows.length} {rows.length > 1 ? "clients" : "client"}
          </p>
        </div>
        <ButtonLink href="/clients/new">
          <Plus className="size-4" />
          Nouveau
        </ButtonLink>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            Aucun client. Crée ton premier client pour pouvoir logger du temps.
          </p>
          <ButtonLink href="/clients/new" className="mt-4">
            Créer un client
          </ButtonLink>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Tarif</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Email</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link
                      href={`/clients/${c.id}`}
                      className="font-medium hover:underline"
                    >
                      {c.name}
                    </Link>
                    {c.archived && (
                      <Badge variant="secondary" className="ml-2">
                        archivé
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{formatCents(c.defaultRateCents)}</TableCell>
                  <TableCell>
                    <span className="text-muted-foreground">
                      / {rateTypeLabel(c.defaultRateType)}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.email}
                  </TableCell>
                  <TableCell className="text-right">
                    <ButtonLink
                      href={`/clients/${c.id}`}
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
