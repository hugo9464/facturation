"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateInvoiceDetailsAction } from "@/actions/invoices";
import type { Invoice } from "@/db/schema";

export function DraftDetailsEditor({ invoice }: { invoice: Invoice }) {
  const [pending, start] = useTransition();
  return (
    <form
      className="rounded-md border p-4 space-y-3"
      action={(formData) => {
        start(async () => {
          const r = await updateInvoiceDetailsAction(invoice.id, formData);
          if (r?.error) toast.error(r.error);
          else toast.success("Détails enregistrés");
        });
      }}
    >
      <p className="text-sm font-medium">Détails du brouillon</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="issue_date">Date d&apos;émission</Label>
          <Input
            id="issue_date"
            name="issue_date"
            type="date"
            defaultValue={invoice.issueDate}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="due_date">Date d&apos;échéance</Label>
          <Input
            id="due_date"
            name="due_date"
            type="date"
            defaultValue={invoice.dueDate}
            required
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="po_number">N° de bon de commande</Label>
        <Input
          id="po_number"
          name="po_number"
          defaultValue={invoice.poNumber ?? ""}
          placeholder="Ex: PO-2026-05"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes (visible sur le PDF)</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={2}
          defaultValue={invoice.notes ?? ""}
          placeholder="Ex: Merci pour votre confiance."
        />
      </div>
      <Button type="submit" disabled={pending} size="sm">
        {pending ? "Enregistrement…" : "Enregistrer les détails"}
      </Button>
    </form>
  );
}
