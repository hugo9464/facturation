"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  TimeEntryDialog,
  type TimeEntryProjectOption,
} from "@/components/time-entry-dialog";
import { deleteTimeEntryAction } from "@/actions/time-entries";
import type { TimeEntry } from "@/db/schema";

export function EntryRowActions({
  entry,
  projects,
}: {
  entry: TimeEntry;
  projects: TimeEntryProjectOption[];
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-0.5">
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={() => setEditOpen(true)}
        aria-label="Modifier"
      >
        <Pencil className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        disabled={pending}
        aria-label="Supprimer"
        onClick={() => {
          if (!confirm("Supprimer cette saisie ?")) return;
          start(async () => {
            const r = await deleteTimeEntryAction(entry.id);
            if ("error" in r && r.error) toast.error(r.error);
            else toast.success("Saisie supprimée");
          });
        }}
      >
        <Trash2 className="size-3.5" />
      </Button>
      <TimeEntryDialog
        projects={projects}
        entry={entry}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </div>
  );
}
