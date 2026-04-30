"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Client } from "@/db/schema";
import { createClientAction } from "@/actions/clients";
import { centsToEuros } from "@/lib/money";

type Action = (prev: unknown, formData: FormData) => Promise<{ error?: string; success?: string } | undefined | void>;

export function ClientForm({
  initial,
  action,
  submitLabel = "Enregistrer",
}: {
  initial?: Client;
  action?: Action;
  submitLabel?: string;
}) {
  const formAction = action ?? createClientAction;
  const [state, dispatch, pending] = useActionState(formAction, null);
  return (
    <form action={dispatch} className="space-y-6 max-w-2xl">
      <section className="space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground">Identité</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name">Nom du client *</Label>
            <Input
              id="name"
              name="name"
              defaultValue={initial?.name ?? ""}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_name">Personne de contact</Label>
            <Input
              id="contact_name"
              name="contact_name"
              defaultValue={initial?.contactName ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={initial?.email ?? ""}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="address">Adresse</Label>
            <Textarea
              id="address"
              name="address"
              defaultValue={initial?.address ?? ""}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="siret">SIRET</Label>
            <Input
              id="siret"
              name="siret"
              defaultValue={initial?.siret ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vat_number">N° TVA intracom</Label>
            <Input
              id="vat_number"
              name="vat_number"
              defaultValue={initial?.vatNumber ?? ""}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground">
          Tarif par défaut
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="default_rate">Tarif (€) *</Label>
            <Input
              id="default_rate"
              name="default_rate"
              type="number"
              step="0.01"
              min="0"
              defaultValue={
                initial ? centsToEuros(initial.defaultRateCents).toFixed(2) : ""
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="default_rate_type">Type *</Label>
            <Select
              name="default_rate_type"
              defaultValue={initial?.defaultRateType ?? "DAY"}
            >
              <SelectTrigger id="default_rate_type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DAY">Par jour</SelectItem>
                <SelectItem value="HALF_DAY">Par demi-journée</SelectItem>
                <SelectItem value="HOUR">Par heure</SelectItem>
                <SelectItem value="FORFAIT">Forfait</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              defaultValue={initial?.notes ?? ""}
              rows={2}
            />
          </div>
        </div>
      </section>

      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      {state?.success && (
        <p className="text-sm text-emerald-600">{state.success}</p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement…" : submitLabel}
      </Button>
    </form>
  );
}
