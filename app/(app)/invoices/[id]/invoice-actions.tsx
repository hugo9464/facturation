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
import { Textarea } from "@/components/ui/textarea";
import {
  cancelInvoiceAction,
  emitInvoiceAction,
  markInvoicePaidAction,
  sendInvoiceEmailAction,
} from "@/actions/invoices";
import type { Invoice } from "@/db/schema";
import { Download, Send } from "lucide-react";

export function InvoiceActions({
  invoice,
  clientEmail,
}: {
  invoice: Invoice;
  clientEmail: string | null;
}) {
  const [pending, start] = useTransition();
  const [paidOpen, setPaidOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState(
    `Facture ${invoice.number ?? ""}`.trim(),
  );
  const [emailBody, setEmailBody] = useState(
    [
      "Bonjour,",
      "",
      `Vous trouverez ci-joint la facture ${invoice.number ?? ""}.`,
      "",
      "Bien cordialement,",
    ].join("\n"),
  );

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

      {invoice.status !== "DRAFT" && invoice.status !== "CANCELLED" && (
        <Dialog open={sendOpen} onOpenChange={setSendOpen}>
          <DialogTrigger
            className={buttonVariants({ variant: "outline", size: "sm" })}
            disabled={!clientEmail}
            title={
              clientEmail
                ? `Envoyer à ${clientEmail}`
                : "Ajoute un email au client avant l'envoi"
            }
          >
            <Send className="size-4" />
            Envoyer
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Envoyer la facture</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-4"
              action={(formData) => {
                start(async () => {
                  const r = await sendInvoiceEmailAction(invoice.id, formData);
                  if ("error" in r && r.error) toast.error(r.error);
                  else {
                    toast.success(r.success);
                    setSendOpen(false);
                  }
                });
              }}
            >
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">À</p>
                <p className="text-sm font-medium">{clientEmail}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email_subject">Objet</Label>
                <Input
                  id="email_subject"
                  name="subject"
                  value={emailSubject}
                  onChange={(event) => setEmailSubject(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email_body">Message</Label>
                <Textarea
                  id="email_body"
                  name="body"
                  value={emailBody}
                  onChange={(event) => setEmailBody(event.target.value)}
                  rows={8}
                  required
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={pending || !clientEmail}>
                  <Send className="size-4" />
                  {pending ? "Envoi..." : "Envoyer l'email"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {invoice.status === "DRAFT" && (
        <Button onClick={onEmit} disabled={pending} size="sm">
          {pending ? "Émission…" : "Émettre"}
        </Button>
      )}

      {(invoice.status === "SENT" || invoice.status === "OVERDUE") && (
        <Dialog open={paidOpen} onOpenChange={setPaidOpen}>
          <DialogTrigger className={buttonVariants({ size: "sm" })}>
            Marquer payée
          </DialogTrigger>
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
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {invoice.status === "DRAFT" ? "Supprimer" : "Annuler"}
          </AlertDialogTrigger>
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
