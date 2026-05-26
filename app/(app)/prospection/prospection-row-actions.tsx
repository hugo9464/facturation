"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import {
  deleteProspectionEntryAction,
} from "@/actions/prospection";
import type { ProspectionEntryView } from "@/lib/prospection";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ProspectionForm } from "./prospection-form";

export function ProspectionRowActions({
  entry,
}: {
  entry: ProspectionEntryView;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function onDelete() {
    if (!window.confirm("Supprimer cette offre ?")) return;
    start(async () => {
      const result = await deleteProspectionEntryAction(entry.id);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Offre supprimée");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
          aria-label="Modifier"
        >
          <Pencil className="size-4" />
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Modifier l&apos;offre</DialogTitle>
          </DialogHeader>
          <ProspectionForm entry={entry} onSaved={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Supprimer"
        onClick={onDelete}
        disabled={pending}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
