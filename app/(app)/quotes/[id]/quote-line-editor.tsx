"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addQuoteLineAction,
  deleteQuoteLineAction,
} from "@/actions/quotes";

function AddForm({ quoteId }: { quoteId: string }) {
  const [pending, start] = useTransition();
  return (
    <form
      className="rounded-md border p-4 space-y-3"
      id={`add-quote-line-${quoteId}`}
      action={(formData) => {
        start(async () => {
          const r = await addQuoteLineAction(quoteId, formData);
          if (r?.error) toast.error(r.error);
          else {
            toast.success("Ligne ajoutée");
            (document.getElementById(`add-quote-line-${quoteId}`) as HTMLFormElement)?.reset();
          }
        });
      }}
    >
      <p className="text-sm font-medium">Ajouter une ligne</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`description-${quoteId}`}>Description</Label>
          <Input
            id={`description-${quoteId}`}
            name="description"
            placeholder="Ex: Phase 1 — design"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`quantity-${quoteId}`}>Quantité</Label>
          <Input
            id={`quantity-${quoteId}`}
            name="quantity"
            type="number"
            step="0.25"
            min="0"
            defaultValue="1"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`unit_type-${quoteId}`}>Type</Label>
          <Select name="unit_type" defaultValue="DAY">
            <SelectTrigger id={`unit_type-${quoteId}`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DAY">Jour</SelectItem>
              <SelectItem value="HALF_DAY">Demi-journée</SelectItem>
              <SelectItem value="HOUR">Heure</SelectItem>
              <SelectItem value="FORFAIT">Forfait</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`unit_price-${quoteId}`}>Prix unitaire (€)</Label>
          <Input
            id={`unit_price-${quoteId}`}
            name="unit_price"
            type="number"
            step="0.01"
            min="0"
            required
          />
        </div>
      </div>
      <Button type="submit" disabled={pending} size="sm">
        {pending ? "Ajout…" : "Ajouter"}
      </Button>
    </form>
  );
}

function DeleteButton({
  quoteId,
  lineId,
}: {
  quoteId: string;
  lineId: string;
}) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-7"
      disabled={pending}
      onClick={() => {
        start(async () => {
          const r = await deleteQuoteLineAction(quoteId, lineId);
          if (r && "error" in r && r.error) toast.error(r.error);
        });
      }}
    >
      <Trash2 className="size-3.5" />
    </Button>
  );
}

export const QuoteLineEditor = { AddForm, DeleteButton };
