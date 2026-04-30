"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button, ButtonLink } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createTimeEntryAction,
  updateTimeEntryAction,
} from "@/actions/time-entries";
import { todayISO } from "@/lib/dates";
import type { Client, RateType, TimeEntry } from "@/db/schema";

const TYPE_LABELS: Record<RateType, string> = {
  DAY: "Jour",
  HALF_DAY: "Demi-journée",
  HOUR: "Heure",
  FORFAIT: "Forfait",
};

const DEFAULT_QTY: Record<RateType, string> = {
  DAY: "1",
  HALF_DAY: "0.5",
  HOUR: "1",
  FORFAIT: "1",
};

export function TimeEntryDialog({
  children,
  clients,
  entry,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  children?: React.ReactNode;
  clients: Client[];
  entry?: TimeEntry;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const [pending, startTransition] = useTransition();

  const isEdit = Boolean(entry);
  const initialClientId = entry?.clientId ?? clients[0]?.id ?? "";
  const initialType = entry?.type ?? clients[0]?.defaultRateType ?? "DAY";
  const initialQuantity = entry
    ? entry.quantity
    : DEFAULT_QTY[initialType];
  const initialRateCents = entry?.rateCents ?? clients[0]?.defaultRateCents ?? 0;

  const [clientId, setClientId] = useState(initialClientId);
  const [type, setType] = useState<RateType>(initialType);
  const [quantity, setQuantity] = useState(initialQuantity);
  const [rateCentsOverride, setRateCentsOverride] = useState<number | null>(
    isEdit ? initialRateCents : null,
  );

  // Reset fields when entry changes (re-opens with different entry)
  React.useEffect(() => {
    if (entry) {
      setClientId(entry.clientId);
      setType(entry.type);
      setQuantity(entry.quantity);
      setRateCentsOverride(entry.rateCents);
    }
  }, [entry]);

  const selectedClient = clients.find((c) => c.id === clientId);
  const rateCents =
    rateCentsOverride ?? selectedClient?.defaultRateCents ?? 0;

  function onClientChange(id: string | null) {
    if (!id) return;
    setClientId(id);
    const c = clients.find((c) => c.id === id);
    if (c && !isEdit) {
      setType(c.defaultRateType);
      setQuantity(DEFAULT_QTY[c.defaultRateType]);
      setRateCentsOverride(null);
    }
  }

  function onTypeChange(t: string | null) {
    if (!t) return;
    setType(t as RateType);
    if (!isEdit) setQuantity(DEFAULT_QTY[t as RateType]);
  }

  const trigger =
    children !== undefined ? (children as React.ReactElement) : null;

  if (clients.length === 0) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        {trigger && <DialogTrigger render={trigger} />}
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aucun client</DialogTitle>
            <DialogDescription>
              Crée d&apos;abord un client pour pouvoir logger du temps.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <ButtonLink href="/clients/new" onClick={() => setOpen(false)}>
              Créer un client
            </ButtonLink>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger render={trigger} />}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Modifier la saisie" : "Logger du temps"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Tu peux changer la date, la quantité, le type ou le tarif."
              : "Saisie rapide d'une prestation."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          action={(formData) => {
            startTransition(async () => {
              const result = isEdit
                ? await updateTimeEntryAction(entry!.id, formData)
                : await createTimeEntryAction(formData);
              if (result?.error) {
                toast.error(result.error);
              } else {
                toast.success(isEdit ? "Saisie modifiée" : "Saisie enregistrée");
                setOpen(false);
              }
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="client_id">Client</Label>
            <Select value={clientId} onValueChange={onClientChange}>
              <SelectTrigger id="client_id" className="w-full">
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
            <input type="hidden" name="client_id" value={clientId} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                name="date"
                type="date"
                defaultValue={entry?.date ?? todayISO()}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select value={type} onValueChange={onTypeChange}>
                <SelectTrigger id="type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="type" value={type} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantité</Label>
              <Input
                id="quantity"
                name="quantity"
                type="number"
                step="0.25"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rate">Tarif unitaire (€)</Label>
              <Input
                id="rate"
                type="number"
                step="0.01"
                min="0"
                value={(rateCents / 100).toFixed(2)}
                onChange={(e) => {
                  const cents = Math.round(
                    Number(e.target.value.replace(",", ".")) * 100,
                  );
                  setRateCentsOverride(cents);
                }}
              />
              <input type="hidden" name="rate_cents" value={rateCents} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              rows={2}
              defaultValue={entry?.description ?? ""}
              placeholder="Ex: Refonte de la page d'accueil"
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending
                ? "Enregistrement…"
                : isEdit
                  ? "Enregistrer"
                  : "Logger"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
