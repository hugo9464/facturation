"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteTimeEntryAction } from "@/actions/time-entries";

export function DeleteEntryButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-7"
      disabled={pending}
      onClick={() => {
        if (!confirm("Supprimer cette saisie ?")) return;
        start(async () => {
          const r = await deleteTimeEntryAction(id);
          if ("error" in r && r.error) toast.error(r.error);
          else toast.success("Saisie supprimée");
        });
      }}
    >
      <Trash2 className="size-3.5" />
    </Button>
  );
}
