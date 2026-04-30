"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  cancelInvoiceAction,
  emitInvoiceAction,
  markInvoicePaidAction,
} from "@/actions/invoices";
import type { Invoice } from "@/db/schema";
import { Download } from "lucide-react";

export function InvoiceActions({ invoice }: { invoice: Invoice }) {
  const [pending, start] = useTransition();
  const [paidOpen, setPaidOpen] = useState(false);

  const onEmit = () => {
    if (
      !confirm(
        "Émettre la facture ?\nUn numéro sera alloué et le PDF sera figé. Action irréversible.",
      )
    )
      return;
    start(async () => {
      const r = await emitInvoiceAction(invoice.id);
      if (r?.error) toast.error(r.error);
      else toast.success("Facture émise");
    });
  };

  const onCancel = () => {
    start(async () => {
      const r = await cancelInvoiceAction(invoice.id);
      if (r && "error" in r && r.error) toast.error(r.error);
      else
        toast.success(
          invoice.status === "DRAFT"
            ? "Brouillon supprimé"
            : "Facture annulée",
        );
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={`/api/invoices/${invoice.id}/pdf`}
        target="_blank"
        rel="noreferrer"
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        <Download className="size-4" />
        PDF
      </a>

      {invoice.status === "DRAFT" && (
        <Button onClick={onEmit} disabled={pending} size="sm">
          {pending ? "Émission…" : "Émettre"}
        </Button>
      )}

      {(invoice.status === "SENT" || invoice.status === "OVERDUE") && (
        <Dialog open={paidOpen} onOpenChange={setPaidOpen}>
          <DialogTrigger render={<Button size="sm">Marquer payée</Button>} />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Encaissement</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-4"
              action={(formData) => {
                start(async () => {
                  const r = await markInvoicePaidAction(invoice.id, formData);
                  if (r?.error) toast.error(r.error);
                  else {
                    toast.success("Facture marquée payée");
                    setPaidOpen(false);
                  }
                });
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="method">Mode de paiement</Label>
                <Input
                  id="method"
                  name="method"
                  defaultValue="Virement"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reference">Référence (optionnel)</Label>
                <Input id="reference" name="reference" />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={pending}>
                  {pending ? "Enregistrement…" : "Confirmer"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {invoice.status !== "CANCELLED" && invoice.status !== "PAID" && (
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button variant="outline" size="sm">
                {invoice.status === "DRAFT" ? "Supprimer" : "Annuler"}
              </Button>
            }
          />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {invoice.status === "DRAFT"
                  ? "Supprimer le brouillon ?"
                  : "Annuler la facture ?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {invoice.status === "DRAFT"
                  ? "Le brouillon sera définitivement supprimé."
                  : "La facture passera en statut 'Annulée'. Les saisies de temps redeviennent disponibles pour une nouvelle facture. Le PDF émis reste conservé."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Retour</AlertDialogCancel>
              <AlertDialogAction onClick={onCancel}>
                Confirmer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
