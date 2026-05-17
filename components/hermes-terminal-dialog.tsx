"use client";

import { useState, useTransition } from "react";
import { Terminal } from "lucide-react";
import { toast } from "sonner";
import { sendHermesTerminalInstructionAction } from "@/actions/hermes-terminal";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function HermesTerminalDialog() {
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [isPending, startTransition] = useTransition();

  function submitInstruction() {
    const trimmedInstruction = instruction.trim();
    if (!trimmedInstruction) {
      toast.error("Écris une instruction pour Hermes.");
      return;
    }

    startTransition(async () => {
      const result = await sendHermesTerminalInstructionAction({
        instruction: trimmedInstruction,
        currentPath: window.location.pathname,
      });

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Instruction envoyée au terminal Hermes du VPS.");
      setInstruction("");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={buttonVariants({ variant: "outline", size: "sm", className: "gap-1.5" })}>
        <Terminal className="size-4" />
        <span className="hidden sm:inline">Terminal Hermes</span>
        <span className="sm:hidden">Hermes</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Terminal Hermes VPS</DialogTitle>
          <DialogDescription>
            Envoie une instruction directe à Hermes sur le VPS, indépendamment d’un projet Todo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="hermes-terminal-instruction">Instruction</Label>
          <Textarea
            id="hermes-terminal-instruction"
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            placeholder="Ex: Connecte-toi au VPS, vérifie les logs de la gateway Hermes et dis-moi si le webhook Facturation répond."
            className="min-h-40 font-mono text-sm"
            maxLength={8000}
            disabled={isPending}
          />
          <p className="text-xs text-muted-foreground">
            Cette action utilise le webhook Hermes configuré côté serveur. Aucun secret n’est exposé au navigateur.
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Annuler
          </Button>
          <Button type="button" onClick={submitInstruction} disabled={isPending || !instruction.trim()}>
            {isPending ? "Envoi..." : "Envoyer à Hermes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
