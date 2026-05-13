"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
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
import {
  acceptQuoteAction,
  convertQuoteToInvoiceAction,
  deleteQuoteAction,
  rejectQuoteAction,
  sendQuoteAction,
} from "@/actions/quotes";
import type { Quote } from "@/db/schema";

export function QuoteActions({ quote }: { quote: Quote }) {
  const [pending, start] = useTransition();

  const onSend = () => {
    if (!confirm("Envoyer le devis ?\nUn numéro lui sera attribué.")) return;
    start(async () => {
      const r = await sendQuoteAction(quote.id);
      if (r?.error) toast.error(r.error);
      else toast.success("Devis envoyé");
    });
  };

  const onAccept = () => {
    start(async () => {
      const r = await acceptQuoteAction(quote.id);
      if (r?.error) toast.error(r.error);
      else toast.success("Devis accepté");
    });
  };

  const onReject = () => {
    start(async () => {
      const r = await rejectQuoteAction(quote.id);
      if (r?.error) toast.error(r.error);
      else toast.success("Devis refusé");
    });
  };

  const onConvert = () => {
    if (!confirm("Convertir ce devis en facture ?\nUne facture brouillon sera créée."))
      return;
    start(async () => {
      const r = await convertQuoteToInvoiceAction(quote.id);
      if (r && "error" in r && r.error) toast.error(r.error);
    });
  };

  const onDelete = () => {
    start(async () => {
      const r = await deleteQuoteAction(quote.id);
      if (r && "error" in r && r.error) toast.error(r.error);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={`/api/quotes/${quote.id}/pdf`}
        target="_blank"
        rel="noreferrer"
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        <Download className="size-4" />
        PDF
      </a>

      {quote.status === "DRAFT" && (
        <Button onClick={onSend} disabled={pending} size="sm">
          {pending ? "Envoi…" : "Envoyer"}
        </Button>
      )}

      {quote.status === "SENT" && (
        <>
          <Button onClick={onAccept} disabled={pending} size="sm">
            Marquer accepté
          </Button>
          <Button
            onClick={onReject}
            disabled={pending}
            variant="outline"
            size="sm"
          >
            Marquer refusé
          </Button>
        </>
      )}

      {quote.status === "ACCEPTED" && !quote.convertedInvoiceId && (
        <Button onClick={onConvert} disabled={pending} size="sm">
          Convertir en facture
        </Button>
      )}

      {quote.status === "DRAFT" && (
        <AlertDialog>
          <AlertDialogTrigger
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Supprimer
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer le brouillon ?</AlertDialogTitle>
              <AlertDialogDescription>
                Le brouillon de devis sera définitivement supprimé.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Retour</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete}>Confirmer</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
