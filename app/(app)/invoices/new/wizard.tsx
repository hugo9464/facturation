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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatCents } from "@/lib/money";
import { formatDate, startOfMonthISO, todayISO } from "@/lib/dates";
import {
  buildSpaceManagementProductManagerLine,
  groupEntriesIntoLines,
  isSpaceManagementClientName,
  latestCompletedSpaceManagementBillingPeriod,
  rateTypeLabel,
} from "@/lib/invoice-grouping";
import { createDraftInvoiceAction } from "@/actions/invoices";
import {
  getClientMissingFields,
  type MissingField,
} from "@/lib/billing-readiness";
import type { Client, RateType, TimeEntry } from "@/db/schema";
import { AlertCircle, Plus, Trash2 } from "lucide-react";

type DraftLine = {
  id: string;
  source: "time" | "manual";
  description: string;
  quantity: string;
  unitType: RateType;
  unitPrice: string;
  timeEntryIds: string[];
};

const TYPE_LABELS: Record<RateType, string> = {
  DAY: "Jour",
  HALF_DAY: "Demi-journée",
  HOUR: "Heure",
  FORFAIT: "Forfait",
};

function parseDecimal(value: string): number {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function eurosToCentsInput(value: string): number {
  return Math.round(parseDecimal(value) * 100);
}

function formatQuantityInput(quantity: number): string {
  return Number.isInteger(quantity) ? quantity.toString() : quantity.toString();
}

function formatUnitPriceInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

function getEntriesForPeriod(
  entries: TimeEntry[],
  clientId: string,
  periodStart: string,
  periodEnd: string,
) {
  if (!clientId || !periodStart || !periodEnd || periodEnd < periodStart) {
    return [];
  }
  return entries.filter(
    (entry) =>
      entry.clientId === clientId &&
      entry.date >= periodStart &&
      entry.date <= periodEnd,
  );
}

function buildTimeLines({
  entries,
  client,
  periodStart,
  periodEnd,
}: {
  entries: TimeEntry[];
  client: Client | undefined;
  periodStart: string;
  periodEnd: string;
}): DraftLine[] {
  const invoiceLines =
    client && isSpaceManagementClientName(client.name)
      ? buildSpaceManagementProductManagerLine({
          entries,
          periodStart,
          periodEnd,
          unitPriceCents: client.defaultRateCents,
        })
      : groupEntriesIntoLines(entries);

  return invoiceLines.map((line) => ({
    id: `time:${[...line.timeEntryIds].sort().join(":")}`,
    source: "time",
    description: line.description,
    quantity: formatQuantityInput(line.quantity),
    unitType: line.unitType,
    unitPrice: formatUnitPriceInput(line.unitPriceCents),
    timeEntryIds: line.timeEntryIds,
  }));
}

function createManualLine(): DraftLine {
  return {
    id: `manual:${crypto.randomUUID()}`,
    source: "manual",
    description: "",
    quantity: "1",
    unitType: "FORFAIT",
    unitPrice: "",
    timeEntryIds: [],
  };
}

function lineTotalCents(line: DraftLine): number {
  return Math.round(parseDecimal(line.quantity) * eurosToCentsInput(line.unitPrice));
}

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
  const initialClientId = preselectedClientId ?? clients[0]?.id ?? "";
  const initialClient = clients.find((client) => client.id === initialClientId);
  const initialSpaceManagementPeriod =
    initialClient && isSpaceManagementClientName(initialClient.name)
      ? latestCompletedSpaceManagementBillingPeriod()
      : null;
  const [clientId, setClientId] = useState(initialClientId);
  const [periodStart, setPeriodStart] = useState(
    initialSpaceManagementPeriod?.periodStart ?? startOfMonthISO(),
  );
  const [periodEnd, setPeriodEnd] = useState(
    initialSpaceManagementPeriod?.periodEnd ?? todayISO(),
  );
  const [poNumber, setPoNumber] = useState("");
  const [manualLines, setManualLines] = useState<DraftLine[]>([]);
  const [timeLineEdits, setTimeLineEdits] = useState<
    Record<string, Partial<DraftLine>>
  >({});
  const [hiddenTimeLineIds, setHiddenTimeLineIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [pending, start] = useTransition();
  const selectedClient = clients.find((client) => client.id === clientId);
  const isSpaceManagementSelected = selectedClient
    ? isSpaceManagementClientName(selectedClient.name)
    : false;

  const periodEntries = useMemo(
    () => getEntriesForPeriod(unbilledEntries, clientId, periodStart, periodEnd),
    [unbilledEntries, clientId, periodStart, periodEnd],
  );

  const timeLines = useMemo(
    () =>
      buildTimeLines({
        entries: periodEntries,
        client: selectedClient,
        periodStart,
        periodEnd,
      })
        .filter((line) => !hiddenTimeLineIds.has(line.id))
        .map((line) => ({ ...line, ...timeLineEdits[line.id] })),
    [
      periodEntries,
      selectedClient,
      periodStart,
      periodEnd,
      hiddenTimeLineIds,
      timeLineEdits,
    ],
  );

  const lines = useMemo(
    () => [...timeLines, ...manualLines],
    [timeLines, manualLines],
  );

  const clientMissing = useMemo(
    () => (selectedClient ? getClientMissingFields(selectedClient) : []),
    [selectedClient],
  );

  const billable = profileMissing.length === 0 && clientMissing.length === 0;
  const periodInvalid = Boolean(periodStart && periodEnd && periodEnd < periodStart);
  const spaceManagementPeriodInvalid =
    isSpaceManagementSelected &&
    (!periodStart.endsWith("-25") || !periodEnd.endsWith("-24"));

  const totalCents = useMemo(() => {
    return lines.reduce((acc, line) => acc + lineTotalCents(line), 0);
  }, [lines]);

  function updateLine(line: DraftLine, patch: Partial<DraftLine>) {
    if (line.source === "time") {
      setTimeLineEdits((currentEdits) => ({
        ...currentEdits,
        [line.id]: { ...currentEdits[line.id], ...patch },
      }));
      return;
    }
    setManualLines((currentLines) =>
      currentLines.map((currentLine) =>
        currentLine.id === line.id ? { ...currentLine, ...patch } : currentLine,
      ),
    );
  }

  function deleteLine(line: DraftLine) {
    if (line.source === "time") {
      setHiddenTimeLineIds((currentIds) => new Set(currentIds).add(line.id));
      return;
    }
    setManualLines((currentLines) =>
      currentLines.filter((currentLine) => currentLine.id !== line.id),
    );
  }

  function addManualLine() {
    if (isSpaceManagementSelected) return;
    setManualLines((currentLines) => [...currentLines, createManualLine()]);
  }

  function selectClient(id: string | null) {
    if (!id) return;
    setClientId(id);
    const nextClient = clients.find((client) => client.id === id);
    if (nextClient && isSpaceManagementClientName(nextClient.name)) {
      const period = latestCompletedSpaceManagementBillingPeriod();
      setPeriodStart(period.periodStart);
      setPeriodEnd(period.periodEnd);
      setManualLines([]);
      setHiddenTimeLineIds(new Set<string>());
      setTimeLineEdits({});
    }
  }

  async function onSubmit() {
    if (!clientId) return;
    if (periodInvalid) {
      toast.error("La période est invalide");
      return;
    }
    if (spaceManagementPeriodInvalid) {
      toast.error("Les factures SPACE MANAGEMENT doivent courir du 25 au 24");
      return;
    }
    if (lines.length === 0) {
      toast.error("Ajoute au moins une ligne");
      return;
    }

    const payloadLines = lines.map((line) => ({
      description: line.description.trim(),
      quantity: parseDecimal(line.quantity),
      unitType: line.unitType,
      unitPriceCents: eurosToCentsInput(line.unitPrice),
      timeEntryIds: line.timeEntryIds,
    }));

    const invalidLine = payloadLines.find(
      (line) =>
        !line.description ||
        line.quantity <= 0 ||
        line.unitPriceCents < 0 ||
        !Number.isFinite(line.quantity),
    );
    if (invalidLine) {
      toast.error("Vérifie les descriptions, quantités et prix unitaires");
      return;
    }

    start(async () => {
      const result = await createDraftInvoiceAction({
        clientId,
        periodStart,
        periodEnd,
        poNumber,
        lines: payloadLines,
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
            Crée d&apos;abord un client actif pour pouvoir facturer.
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
          <CardTitle className="text-base">Client et période</CardTitle>
          <CardDescription>
            Les temps non facturés de la période préremplissent les lignes.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2 sm:col-span-3">
            <Label htmlFor="client">Client à facturer</Label>
            <Select
              value={clientId}
              onValueChange={selectClient}
            >
              <SelectTrigger id="client" className="w-full">
                <span className="truncate">
                  {selectedClient ? selectedClient.name : "Client"}
                </span>
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="period-start">Début</Label>
            <Input
              id="period-start"
              type="date"
              value={periodStart}
              onChange={(event) => setPeriodStart(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="period-end">Fin</Label>
            <Input
              id="period-end"
              type="date"
              value={periodEnd}
              onChange={(event) => setPeriodEnd(event.target.value)}
            />
          </div>
          <div className="flex items-end">
            <div className="w-full rounded-md border bg-muted/35 px-3 py-2 text-sm">
              <p className="text-muted-foreground">Temps trouvés</p>
              <p className="font-medium">
                {periodInvalid
                  ? "Période invalide"
                  : `${periodEntries.length} saisie${
                      periodEntries.length > 1 ? "s" : ""
                    }`}
              </p>
            </div>
          </div>
          <div className="space-y-2 sm:col-span-3">
            <Label htmlFor="po-number">N° de bon de commande</Label>
            <Input
              id="po-number"
              value={poNumber}
              onChange={(event) => setPoNumber(event.target.value)}
              placeholder="Ex: PO-2026-05"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">Lignes de facture</CardTitle>
              <CardDescription>
                Modifie les lignes préremplies ou ajoute une ligne manuelle.
              </CardDescription>
            </div>
            {!isSpaceManagementSelected && (
              <Button variant="outline" size="sm" onClick={addManualLine}>
                <Plus className="size-4" />
                Ligne
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {lines.length === 0 ? (
            <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
              Aucune ligne pour cette période.
            </div>
          ) : (
            <div className="space-y-3">
              {lines.map((line) => {
                const total = lineTotalCents(line);
                return (
                  <div key={line.id} className="rounded-md border p-3 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-medium uppercase text-muted-foreground">
                        {line.source === "time"
                          ? `${line.timeEntryIds.length} saisie${
                              line.timeEntryIds.length > 1 ? "s" : ""
                            } logguée${
                              line.timeEntryIds.length > 1 ? "s" : ""
                            }`
                          : "Ligne manuelle"}
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => deleteLine(line)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_110px_150px_130px_110px]">
                      <div className="space-y-1.5">
                        <Label htmlFor={`description-${line.id}`}>
                          Description
                        </Label>
                        <Textarea
                          id={`description-${line.id}`}
                          rows={2}
                          value={line.description}
                          onChange={(event) =>
                            updateLine(line, {
                              description: event.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`quantity-${line.id}`}>Quantité</Label>
                        <Input
                          id={`quantity-${line.id}`}
                          type="number"
                          step="0.25"
                          min="0"
                          value={line.quantity}
                          onChange={(event) =>
                            updateLine(line, { quantity: event.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`unit-type-${line.id}`}>Type</Label>
                        <Select
                          value={line.unitType}
                          onValueChange={(value) =>
                            updateLine(line, { unitType: value as RateType })
                          }
                        >
                          <SelectTrigger
                            id={`unit-type-${line.id}`}
                            className="w-full"
                          >
                            <span className="truncate">
                              {TYPE_LABELS[line.unitType]}
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(TYPE_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`unit-price-${line.id}`}>P.U. (€)</Label>
                        <Input
                          id={`unit-price-${line.id}`}
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.unitPrice}
                          onChange={(event) =>
                            updateLine(line, { unitPrice: event.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Total</Label>
                        <div className="h-9 rounded-md border bg-muted/35 px-3 py-2 text-right text-sm font-medium tabular-nums">
                          {formatCents(total)}
                        </div>
                      </div>
                    </div>
                    {line.source === "time" && periodEntries.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Source : période du {formatDate(periodStart)} au{" "}
                        {formatDate(periodEnd)} · {line.quantity}{" "}
                        {rateTypeLabel(line.unitType, parseDecimal(line.quantity))}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="sticky bottom-4 flex items-center justify-between gap-4 rounded-lg border bg-card/95 px-4 py-3 shadow-md backdrop-blur">
        <div>
          <p className="text-xs text-muted-foreground">Total brouillon</p>
          <p className="text-xl font-semibold tabular-nums">
            {formatCents(totalCents)}
          </p>
        </div>
        <Button
          onClick={onSubmit}
          disabled={
            pending ||
            lines.length === 0 ||
            !billable ||
            periodInvalid ||
            spaceManagementPeriodInvalid ||
            !clientId
          }
          size="lg"
        >
          {pending ? "Création…" : "Créer le brouillon"}
        </Button>
      </div>
    </div>
  );
}
