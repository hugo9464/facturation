"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveJobOfferAgentFeedbackAction } from "@/actions/job-offers";
import { Button } from "@/components/ui/button";
import { RetriggerSearchButton } from "./retrigger-search-button";

export function JobOfferAgentControls() {
  const router = useRouter();
  const [agentInstruction, setAgentInstruction] = useState("");
  const [isSaving, startSaving] = useTransition();

  function saveInstruction() {
    const message = agentInstruction.trim();
    if (message.length < 3) {
      toast.error("Ajoute une instruction d'au moins 3 caractères.");
      return;
    }

    startSaving(async () => {
      const formData = new FormData();
      formData.set("message", message);
      const result = await saveJobOfferAgentFeedbackAction(formData);
      if (!result.ok) return;
      toast.success("Instruction enregistrée pour les prochaines recherches.");
      setAgentInstruction("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <textarea
        value={agentInstruction}
        onChange={(event) => setAgentInstruction(event.target.value)}
        minLength={3}
        maxLength={1200}
        rows={3}
        placeholder="Ex: privilégie les missions remote, ignore les CDI, salaire minimum 60k€..."
        className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
      />
      <div className="flex flex-wrap items-start gap-2">
        <Button type="button" size="sm" onClick={saveInstruction} disabled={isSaving}>
          {isSaving ? "Enregistrement…" : "Enregistrer l'instruction"}
        </Button>
        <RetriggerSearchButton instruction={agentInstruction} onSearchComplete={() => setAgentInstruction("")} />
      </div>
      <p className="text-xs text-muted-foreground">
        Si tu relances la recherche avec une instruction saisie ici, elle est enregistrée d&apos;abord puis appliquée à cette recherche.
      </p>
    </div>
  );
}
