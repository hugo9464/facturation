"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { retriggerJobOfferSearchAction } from "@/actions/job-offers";
import { Button } from "@/components/ui/button";

type RetriggerSearchButtonProps = {
  instruction?: string;
  onSearchComplete?: () => void;
};

function plural(value: number, singular: string, pluralLabel: string = `${singular}s`) {
  return `${value} ${value > 1 ? pluralLabel : singular}`;
}

export function RetriggerSearchButton({ instruction, onSearchComplete }: RetriggerSearchButtonProps = {}) {
  const router = useRouter();
  const [refreshPending, startRefreshTransition] = useTransition();
  const [isSearching, setIsSearching] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const pending = isSearching || refreshPending;

  return (
    <div className="flex max-w-sm flex-col items-start gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={async () => {
          setIsSearching(true);
          setStatusMessage("Recherche en cours… l'agent analyse les offres disponibles.");
          const toastId = toast.loading("Recherche d'offres en cours…");

          try {
            const result = await retriggerJobOfferSearchAction(instruction);
            if (!result.ok) {
              setStatusMessage(result.error);
              toast.error(result.error, { id: toastId });
              return;
            }

            const summary =
              result.inserted + result.refreshed > 0
                ? `Recherche terminée : ${plural(result.inserted, "nouvelle offre")}, ${plural(
                    result.refreshed,
                    "mise à jour",
                  )}. ${plural(result.scraped, "offre analysée")}.`
                : `Recherche terminée : ${plural(
                    result.scraped,
                    "offre analysée",
                  )}, aucune nouvelle offre pertinente trouvée pour tes critères.`;

            setStatusMessage(summary);
            toast.success(summary, { id: toastId });
            onSearchComplete?.();
            startRefreshTransition(() => {
              router.refresh();
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : "La recherche a échoué.";
            setStatusMessage(message);
            toast.error(message, { id: toastId });
          } finally {
            setIsSearching(false);
          }
        }}
      >
        {pending ? "Recherche en cours…" : "Relancer la recherche"}
      </Button>
      {statusMessage ? (
        <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
          {statusMessage}
        </p>
      ) : null}
    </div>
  );
}
