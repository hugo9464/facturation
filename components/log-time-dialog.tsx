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
import { createTimeEntryAction } from "@/actions/time-entries";
import { todayISO } from "@/lib/dates";
import type { Client, RateType } from "@/db/schema";

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

export function LogTimeDialog({
  children,
  clients,
}: {
  children: React.ReactNode;
  clients: Client[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [clientId, setClientId] = useState<string>(clients[0]?.id ?? "");
  const [type, setType] = useState<RateType>(
    clients[0]?.defaultRateType ?? "DAY",
  );
  const [quantity, setQuantity] = useState(DEFAULT_QTY[type]);

  const selectedClient = clients.find((c) => c.id === clientId);
  const rateCents = selectedClient?.defaultRateCents ?? 0;

  function onClientChange(id: string | null) {
    if (!id) return;
    setClientId(id);
    const c = clients.find((c) => c.id === id);
    if (c) {
      setType(c.defaultRateType);
      setQuantity(DEFAULT_QTY[c.defaultRateType]);
    }
  }

  function onTypeChange(t: string | null) {
    if (!t) return;
    setType(t as RateType);
    setQuantity(DEFAULT_QTY[t as RateType]);
  }

  const trigger = children as React.ReactElement;

  if (clients.length === 0) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={trigger} />
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
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Logger du temps</DialogTitle>
          <DialogDescription>
            Saisie rapide d&apos;une prestation.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          action={(formData) => {
            startTransition(async () => {
              const result = await createTimeEntryAction(formData);
              if (result?.error) {
                toast.error(result.error);
              } else {
                toast.success("Saisie enregistrée");
                setOpen(false);
              }
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="client_id">Client</Label>
            <Select value={clientId} onValueChange={onClientChange} name="client_id">
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
                defaultValue={todayISO()}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select
                value={type}
                onValueChange={(v) => onTypeChange(v as RateType)}
              >
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
              <Label htmlFor="rate">Tarif (€)</Label>
              <Input
                id="rate"
                name="rate_cents"
                type="hidden"
                value={rateCents}
                readOnly
              />
              <Input
                value={(rateCents / 100).toFixed(2)}
                disabled
                className="text-muted-foreground"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              rows={2}
              placeholder="Ex: Refonte de la page d'accueil"
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
