"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { retriggerJobOfferSearchAction } from "@/actions/job-offers";
import { Button } from "@/components/ui/button";

export function RetriggerSearchButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await retriggerJobOfferSearchAction();
          if (!result.ok) {
            toast.error(result.error);
            return;
          }

          toast.success(
            `Recherche terminée : ${result.inserted} nouvelle${result.inserted > 1 ? "s" : ""} offre${
              result.inserted > 1 ? "s" : ""
            }, ${result.refreshed} mise${result.refreshed > 1 ? "s" : ""} à jour.`,
          );
          router.refresh();
        });
      }}
    >
      {pending ? "Recherche en cours…" : "Relancer la recherche"}
    </Button>
  );
}
