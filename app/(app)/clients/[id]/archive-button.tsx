"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  archiveClientAction,
  unarchiveClientAction,
} from "@/actions/clients";

export function ArchiveButton({
  id,
  archived,
}: {
  id: string;
  archived: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() => {
        start(async () => {
          const result = archived
            ? await unarchiveClientAction(id)
            : await archiveClientAction(id);
          if ("error" in result && result.error) toast.error(result.error);
          else toast.success(archived ? "Client désarchivé" : "Client archivé");
        });
      }}
    >
      {archived ? "Désarchiver" : "Archiver"}
    </Button>
  );
}
