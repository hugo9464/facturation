"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  runCollectiveWorkProspectionAction,
  type ProspectionScanActionResult,
} from "@/actions/prospection";
import { Button } from "@/components/ui/button";

type ScanSuccess = Extract<ProspectionScanActionResult, { ok: true }>;

function scanSummary(result: ScanSuccess) {
  return `${result.scanned} scannée${result.scanned > 1 ? "s" : ""} · ${
    result.candidates
  } analysée${result.candidates > 1 ? "s" : ""} · ${
    result.matched
  } retenue${result.matched > 1 ? "s" : ""} · ${
    result.inserted
  } à revoir`;
}

function scanDetail(result: ScanSuccess) {
  if (result.inserted > 0) {
    return `${result.inserted} nouvelle${
      result.inserted > 1 ? "s" : ""
    } offre${result.inserted > 1 ? "s" : ""} ajoutée${
      result.inserted > 1 ? "s" : ""
    } à la revue.`;
  }
  if (result.matched > 0) {
    return "Les offres retenues étaient déjà en revue, importées ou archivées.";
  }
  if (result.candidates > 0) {
    return "Des offres ont été analysées, mais aucune n'a passé le seuil de matching.";
  }
  if (result.scanned > 0) {
    return "Aucune offre candidate trouvée à partir des mots-clés de tes CV.";
  }
  return "Aucune offre lisible sur Collective.work.";
}

function itemLine(item: {
  title: string;
  organization: string | null;
  location: string | null;
  dailyRate: string | null;
}) {
  const meta = [item.organization, item.location, item.dailyRate ? `${item.dailyRate} EUR` : null]
    .filter(Boolean)
    .join(" · ");
  return meta ? `${item.title} — ${meta}` : item.title;
}

function analysisLine(item: {
  heuristicScore: number;
  aiMatches: boolean | null;
  accepted: boolean | null;
  score: number | null;
}) {
  return [
    `Préfiltre ${item.heuristicScore}`,
    item.aiMatches !== null
      ? `IA ${item.aiMatches ? "compatible" : "non compatible"}`
      : null,
    item.score !== null ? `score ${Math.round(item.score)}/100` : null,
    item.accepted !== null ? (item.accepted ? "retenue" : "écartée") : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function CollectiveWorkScanButton() {
  const router = useRouter();
  const [lastResult, setLastResult] = useState<ScanSuccess | null>(null);
  const [pending, start] = useTransition();

  function onClick() {
    start(async () => {
      try {
        const result = await runCollectiveWorkProspectionAction();
        if ("error" in result) {
          toast.error(result.error);
          return;
        }

        setLastResult(result);
        const summary = scanSummary(result);
        if (result.inserted > 0) {
          toast.success(scanDetail(result), { description: summary });
        } else {
          toast.info(scanDetail(result), { description: summary });
        }
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Impossible de scanner Collective.work",
        );
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <Button type="button" variant="outline" onClick={onClick} disabled={pending}>
        <RefreshCw className={pending ? "size-4 animate-spin" : "size-4"} />
        {pending ? "Scan..." : "Scanner Collective.work"}
      </Button>
      {lastResult ? (
        <div className="w-full max-w-xl space-y-2 text-left text-xs text-muted-foreground sm:text-right">
          <p>{scanSummary(lastResult)}</p>
          <p>{scanDetail(lastResult)}</p>
          {lastResult.errors.length > 0 ? (
            <p className="text-destructive">{lastResult.errors.join(" · ")}</p>
          ) : null}
          {lastResult.details ? (
            <div className="space-y-1 text-left">
              <details className="rounded-md border border-border/70 p-2">
                <summary className="cursor-pointer text-foreground">
                  Offres scannées ({lastResult.details.scanned.length})
                </summary>
                <div className="mt-2 max-h-72 space-y-2 overflow-y-auto pr-1">
                  {lastResult.details.scanned.map((item) => (
                    <a
                      key={item.sourceUrl}
                      className="block rounded-sm hover:text-foreground hover:underline"
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {itemLine(item)}
                    </a>
                  ))}
                </div>
              </details>
              <details className="rounded-md border border-border/70 p-2">
                <summary className="cursor-pointer text-foreground">
                  Offres analysées ({lastResult.details.analyzed.length})
                </summary>
                <div className="mt-2 max-h-72 space-y-3 overflow-y-auto pr-1">
                  {lastResult.details.analyzed.length === 0 ? (
                    <p>Aucune offre n&apos;a franchi le préfiltre par mots-clés.</p>
                  ) : (
                    lastResult.details.analyzed.map((item) => (
                      <article key={item.sourceUrl} className="space-y-1">
                        <a
                          className="font-medium text-foreground hover:underline"
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {itemLine(item)}
                        </a>
                        <p>{analysisLine(item)}</p>
                        {item.matchedTerms.length > 0 ? (
                          <p>Mots-clés: {item.matchedTerms.join(", ")}</p>
                        ) : null}
                        {item.reason ? <p>{item.reason}</p> : null}
                      </article>
                    ))
                  )}
                </div>
              </details>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
