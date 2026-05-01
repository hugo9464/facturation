"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateQuoteDetailsAction } from "@/actions/quotes";
import type { Quote } from "@/db/schema";

export function QuoteDetailsEditor({ quote }: { quote: Quote }) {
  const [pending, start] = useTransition();
  return (
    <form
      className="rounded-md border p-4 space-y-3"
      action={(formData) => {
        start(async () => {
          const r = await updateQuoteDetailsAction(quote.id, formData);
          if (r?.error) toast.error(r.error);
          else toast.success("Détails enregistrés");
        });
      }}
    >
      <p className="text-sm font-medium">Détails du devis</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="issue_date">Date d&apos;émission</Label>
          <Input
            id="issue_date"
            name="issue_date"
            type="date"
            defaultValue={quote.issueDate}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="valid_until">Valable jusqu&apos;au</Label>
          <Input
            id="valid_until"
            name="valid_until"
            type="date"
            defaultValue={quote.validUntil}
            required
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes (visibles sur le PDF)</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={2}
          defaultValue={quote.notes ?? ""}
          placeholder="Ex: Conditions particulières, scope précis…"
        />
      </div>
      <Button type="submit" disabled={pending} size="sm">
        {pending ? "Enregistrement…" : "Enregistrer les détails"}
      </Button>
    </form>
  );
}
