"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatCents } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { rateTypeLabel } from "@/lib/invoice-grouping";
import { createDraftInvoiceAction } from "@/actions/invoices";
import {
  getClientMissingFields,
  type MissingField,
} from "@/lib/billing-readiness";
import type { Client, TimeEntry } from "@/db/schema";
import { AlertCircle } from "lucide-react";

export function NewInvoiceWizard({
  clients,
  unbilledEntries,
  preselectedClientId,
  profileMissing,
}: {
  clients: Client[];
  unbilledEntries: TimeEntry[];
  preselectedClientId?: string;
  profileMissing: MissingField[];
}) {
  const [clientId, setClientId] = useState(
    preselectedClientId ?? clients[0]?.id ?? "",
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () =>
      new Set(
        unbilledEntries
          .filter((e) => e.clientId === (preselectedClientId ?? clients[0]?.id))
          .map((e) => e.id),
      ),
  );
  const [pending, start] = useTransition();

  const clientEntries = useMemo(
    () => unbilledEntries.filter((e) => e.clientId === clientId),
    [unbilledEntries, clientId],
  );

  const selectedClient = clients.find((c) => c.id === clientId);
  const clientMissing = useMemo(
    () => (selectedClient ? getClientMissingFields(selectedClient) : []),
    [selectedClient],
  );

  const billable =
    profileMissing.length === 0 && clientMissing.length === 0;

  const totalCents = useMemo(() => {
    return clientEntries
      .filter((e) => selectedIds.has(e.id))
      .reduce((acc, e) => acc + Math.round(Number(e.quantity) * e.rateCents), 0);
  }, [clientEntries, selectedIds]);

  function onClientChange(id: string | null) {
    if (!id) return;
    setClientId(id);
    setSelectedIds(
      new Set(
        unbilledEntries.filter((e) => e.clientId === id).map((e) => e.id),
      ),
    );
  }

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(clientEntries.map((e) => e.id)));
  }

  function selectNone() {
    setSelectedIds(new Set());
  }

  async function onSubmit() {
    if (!clientId) return;
    if (selectedIds.size === 0) {
      toast.error("Sélectionne au moins une saisie");
      return;
    }
    start(async () => {
      const result = await createDraftInvoiceAction({
        clientId,
        entryIds: Array.from(selectedIds),
      });
      if (result?.error) toast.error(result.error);
    });
  }

  if (clients.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Aucun client</CardTitle>
          <CardDescription>
            Crée d&apos;abord un client pour pouvoir facturer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ButtonLink href="/clients/new">Créer un client</ButtonLink>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {(profileMissing.length > 0 || clientMissing.length > 0) && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-3">
          <div className="flex items-start gap-2 text-destructive">
            <AlertCircle className="size-4 mt-0.5 shrink-0" />
            <p className="text-sm font-medium">
              Informations manquantes pour facturer
            </p>
          </div>
          {profileMissing.length > 0 && (
            <div className="text-sm pl-6">
              <p className="font-medium">
                Tes paramètres d&apos;entreprise :
              </p>
              <ul className="list-disc pl-5 text-muted-foreground mt-1">
                {profileMissing.map((m) => (
                  <li key={m.field}>{m.label}</li>
                ))}
              </ul>
              <ButtonLink
                href="/settings"
                size="sm"
                variant="outline"
                className="mt-2"
              >
                Compléter les paramètres
              </ButtonLink>
            </div>
          )}
          {clientMissing.length > 0 && selectedClient && (
            <div className="text-sm pl-6">
              <p className="font-medium">
                Client {selectedClient.name} :
              </p>
              <ul className="list-disc pl-5 text-muted-foreground mt-1">
                {clientMissing.map((m) => (
                  <li key={m.field}>{m.label}</li>
                ))}
              </ul>
              <ButtonLink
                href={`/clients/${selectedClient.id}`}
                size="sm"
                variant="outline"
                className="mt-2"
              >
                Compléter le client
              </ButtonLink>
            </div>
          )}
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Client</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="client">Sélectionne le client à facturer</Label>
            <Select value={clientId} onValueChange={onClientChange}>
              <SelectTrigger id="client" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Saisies non facturées</CardTitle>
              <CardDescription>
                {clientEntries.length}{" "}
                {clientEntries.length > 1 ? "saisies" : "saisie"} disponible
                {clientEntries.length > 1 ? "s" : ""}
              </CardDescription>
            </div>
            {clientEntries.length > 0 && (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={selectAll}>
                  Tout
                </Button>
                <Button variant="ghost" size="sm" onClick={selectNone}>
                  Aucun
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {clientEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Aucune saisie non facturée pour ce client. Logge du temps avec
              le bouton en haut.
            </p>
          ) : (
            <div className="space-y-1.5">
              {clientEntries.map((e) => {
                const checked = selectedIds.has(e.id);
                const totalCents = Math.round(Number(e.quantity) * e.rateCents);
                return (
                  <label
                    key={e.id}
                    className="flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/40 has-[input:checked]:bg-muted/60"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggle(e.id)}
                    />
                    <span className="w-20 text-sm text-muted-foreground">
                      {formatDate(e.date)}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {e.quantity} {rateTypeLabel(e.type)}
                    </Badge>
                    <span className="flex-1 text-sm text-muted-foreground truncate">
                      {e.description}
                    </span>
                    <span className="text-sm font-medium">
                      {formatCents(totalCents)}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-4 sticky bottom-4 bg-background/95 backdrop-blur border rounded-lg px-4 py-3 shadow-sm">
        <div>
          <p className="text-xs text-muted-foreground">Total brouillon</p>
          <p className="text-xl font-semibold tabular-nums">
            {formatCents(totalCents)}
          </p>
        </div>
        <Button
          onClick={onSubmit}
          disabled={pending || selectedIds.size === 0 || !billable}
          size="lg"
        >
          {pending ? "Création…" : "Créer le brouillon"}
        </Button>
      </div>
    </div>
  );
}
