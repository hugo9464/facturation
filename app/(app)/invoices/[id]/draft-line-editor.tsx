"use client";

import { useState } from "react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
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
import {
  addInvoiceLineAction,
  deleteInvoiceLineAction,
  updateInvoiceLineDescriptionAction,
} from "@/actions/invoices";

export function AddInvoiceLineForm({ invoiceId }: { invoiceId: string }) {
  const [pending, start] = useTransition();
  return (
    <form
      className="rounded-md border p-4 space-y-3"
      action={(formData) => {
        start(async () => {
          const r = await addInvoiceLineAction(invoiceId, formData);
          if (r?.error) toast.error(r.error);
          else {
            toast.success("Ligne ajoutée");
            (document.getElementById("add-line-form") as HTMLFormElement)?.reset();
          }
        });
      }}
      id="add-line-form"
    >
      <p className="text-sm font-medium">Ajouter une ligne manuelle</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            name="description"
            placeholder="Ex: Frais de déplacement"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="quantity">Quantité</Label>
          <Input
            id="quantity"
            name="quantity"
            type="number"
            step="0.25"
            min="0"
            defaultValue="1"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="unit_type">Type</Label>
          <Select name="unit_type" defaultValue="FORFAIT">
            <SelectTrigger id="unit_type" className="w-full">
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
          <Label htmlFor="unit_price">Prix unitaire (€)</Label>
          <Input
            id="unit_price"
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

export function DeleteInvoiceLineButton({
  invoiceId,
  lineId,
}: {
  invoiceId: string;
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
          const r = await deleteInvoiceLineAction(invoiceId, lineId);
          if (r && "error" in r && r.error) toast.error(r.error);
        });
      }}
    >
      <Trash2 className="size-3.5" />
    </Button>
  );
}

export function EditInvoiceLineDescription({
  invoiceId,
  lineId,
  description,
}: {
  invoiceId: string;
  lineId: string;
  description: string;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();

  if (!editing) {
    return (
      <div className="group/line flex items-start gap-2">
        <span className="min-w-0 flex-1 whitespace-pre-line">{description}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 opacity-0 transition-opacity group-hover/line:opacity-100 focus-visible:opacity-100"
          aria-label="Modifier la description"
          onClick={() => setEditing(true)}
        >
          <Pencil className="size-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <form
      className="space-y-2"
      action={(formData) => {
        start(async () => {
          const result = await updateInvoiceLineDescriptionAction(
            invoiceId,
            lineId,
            formData,
          );
          if (result?.error) {
            toast.error(result.error);
          } else {
            toast.success("Description mise à jour");
            setEditing(false);
          }
        });
      }}
    >
      <Textarea
        name="description"
        defaultValue={description}
        disabled={pending}
        autoFocus
        required
        rows={3}
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Enregistrement..." : "Enregistrer"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => setEditing(false)}
        >
          Annuler
        </Button>
      </div>
    </form>
  );
}
