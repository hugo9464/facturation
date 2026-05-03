"use client";

import { Button } from "@/components/ui/button";

export default function TodoError({ reset }: { reset: () => void }) {
  return (
    <div className="max-w-3xl rounded-lg border border-dashed p-10 text-center">
      <h1 className="text-lg font-semibold">Impossible de charger les tâches</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Une erreur est survenue pendant le chargement.
      </p>
      <Button className="mt-4" variant="outline" onClick={reset}>
        Réessayer
      </Button>
    </div>
  );
}
