"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, Send, Terminal } from "lucide-react";
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

type TranscriptEntry = {
  id: string;
  at: string;
  tone: "command" | "status" | "success" | "error";
  title: string;
  body?: string;
};

type HermesTerminalResponseDetails = {
  ok: boolean;
  status: number;
  statusText: string;
  contentType: string | null;
  bodyExcerpt: string | null;
  json: unknown | null;
};

function entryId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function terminalTime() {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());
}

function formatResponseStatus(response: HermesTerminalResponseDetails) {
  const statusText = response.statusText ? ` ${response.statusText}` : "";
  const contentType = response.contentType ? ` · ${response.contentType}` : "";
  return `${response.ok ? "OK" : "ERROR"} HTTP ${response.status}${statusText}${contentType}`;
}

function formatResponseBody(response: HermesTerminalResponseDetails | undefined) {
  if (!response) return undefined;
  if (response.json !== null) {
    return JSON.stringify(response.json, null, 2);
  }
  return response.bodyExcerpt ?? undefined;
}

function responseEntry(
  response: HermesTerminalResponseDetails,
  tone: Extract<TranscriptEntry["tone"], "success" | "error">,
): TranscriptEntry {
  return {
    id: entryId(),
    at: terminalTime(),
    tone,
    title: formatResponseStatus(response),
    body: formatResponseBody(response),
  };
}

export function HermesTerminalDialog() {
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [transcript]);

  function submitInstruction() {
    const trimmedInstruction = instruction.trim();
    if (!trimmedInstruction) {
      toast.error("Écris une instruction pour Hermes.");
      return;
    }

    setInstruction("");
    setTranscript((entries) => [
      ...entries,
      {
        id: entryId(),
        at: terminalTime(),
        tone: "command",
        title: "$ hermes",
        body: trimmedInstruction,
      },
      {
        id: entryId(),
        at: terminalTime(),
        tone: "status",
        title: "Envoi au webhook Hermes...",
        body: `Chemin courant: ${window.location.pathname}`,
      },
    ]);

    setIsSubmitting(true);
    void (async () => {
      try {
        const result = await sendHermesTerminalInstructionAction({
          instruction: trimmedInstruction,
          currentPath: window.location.pathname,
        });

        if (result?.error) {
          toast.error(result.error);
          setTranscript((entries) => [
            ...entries,
            result.response
              ? responseEntry(result.response, "error")
              : {
                  id: entryId(),
                  at: terminalTime(),
                  tone: "error",
                  title: "Échec appel Hermes",
                  body: result.error,
                },
          ]);
          return;
        }

        toast.success("Instruction envoyée au terminal Hermes du VPS.");
        const response = result.response;
        if (response) {
          setTranscript((entries) => [...entries, responseEntry(response, "success")]);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Échec appel Hermes";
        toast.error(message);
        setTranscript((entries) => [
          ...entries,
          {
            id: entryId(),
            at: terminalTime(),
            tone: "error",
            title: "Échec appel Hermes",
            body: message,
          },
        ]);
      }
    })().finally(() => setIsSubmitting(false));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={buttonVariants({ variant: "outline", size: "sm", className: "gap-1.5" })}>
        <Terminal className="size-4" />
        <span className="hidden sm:inline">Terminal Hermes</span>
        <span className="sm:hidden">Hermes</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Terminal Hermes VPS</DialogTitle>
          <DialogDescription>
            Envoie une instruction directe à Hermes sur le VPS, indépendamment d’un projet Todo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div
            ref={transcriptRef}
            className="h-[320px] overflow-y-auto rounded-md border bg-zinc-950 p-3 font-mono text-xs text-zinc-100"
            aria-live="polite"
          >
            {transcript.length === 0 ? (
              <div className="text-zinc-400">
                <div>[Hermes terminal prêt]</div>
                <div>Entrée pour envoyer, Maj+Entrée pour une nouvelle ligne.</div>
              </div>
            ) : (
              <div className="space-y-3">
                {transcript.map((entry) => (
                  <div key={entry.id} className="space-y-1">
                    <div
                      className={
                        entry.tone === "error"
                          ? "text-red-300"
                          : entry.tone === "success"
                            ? "text-emerald-300"
                            : entry.tone === "command"
                              ? "text-sky-300"
                              : "text-zinc-400"
                      }
                    >
                      <span className="text-zinc-500">[{entry.at}]</span> {entry.title}
                    </div>
                    {entry.body ? (
                      <pre className="whitespace-pre-wrap break-words text-zinc-100">{entry.body}</pre>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="hermes-terminal-instruction">Commande</Label>
            <Textarea
              id="hermes-terminal-instruction"
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  if (!isSubmitting) submitInstruction();
                }
              }}
              placeholder="Ex: Vérifie les logs de la gateway Hermes et dis-moi si le webhook Facturation répond."
              className="min-h-24 font-mono text-sm"
              maxLength={8000}
              disabled={isSubmitting}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Les réponses affichent uniquement le statut HTTP et un extrait nettoyé du corps renvoyé par Hermes.
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setTranscript([])} disabled={isSubmitting || transcript.length === 0}>
            <Eraser className="size-4" />
            Effacer
          </Button>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Fermer
          </Button>
          <Button type="button" onClick={submitInstruction} disabled={isSubmitting || !instruction.trim()}>
            <Send className="size-4" />
            {isSubmitting ? "Envoi..." : "Envoyer à Hermes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
