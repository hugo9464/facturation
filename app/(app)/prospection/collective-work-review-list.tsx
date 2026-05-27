"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Archive, CheckCircle2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  archiveProspectionOfferReviewAction,
  importProspectionOfferReviewAction,
} from "@/actions/prospection";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  PROSPECTION_OFFER_REVIEW_STATUS_LABELS,
  type ProspectionOfferReviewView,
} from "@/lib/prospection";

function scoreLabel(review: ProspectionOfferReviewView) {
  const parts = [
    review.accepted ? "IA retenue" : "IA écartée",
    review.score !== null ? `Score ${Math.round(review.score)}/100` : null,
    `Préfiltre ${review.heuristicScore}`,
  ];
  return parts.filter(Boolean).join(" · ");
}

export function CollectiveWorkReviewList({
  reviews,
}: {
  reviews: ProspectionOfferReviewView[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const acceptedReviews = reviews.filter((review) => review.accepted);
  const rejectedReviews = reviews.filter((review) => !review.accepted);

  function importReview(id: string) {
    start(async () => {
      const result = await importProspectionOfferReviewAction(id);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Offre importée dans le suivi");
      router.refresh();
    });
  }

  function archiveReview(id: string) {
    start(async () => {
      const result = await archiveProspectionOfferReviewAction(id);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Offre archivée");
      router.refresh();
    });
  }

  if (reviews.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center">
        <p className="text-sm text-muted-foreground">
          Aucune offre Collective.work à revoir.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ReviewSection
        title="Retenues par l'IA"
        emptyText="Aucune offre retenue par l'IA à revoir."
        reviews={acceptedReviews}
        pending={pending}
        onImport={importReview}
        onArchive={archiveReview}
      />
      <ReviewSection
        title="Autres offres analysées"
        emptyText="Aucune autre offre analysée à revoir."
        reviews={rejectedReviews}
        pending={pending}
        onImport={importReview}
        onArchive={archiveReview}
      />
    </div>
  );
}

function ReviewSection({
  title,
  emptyText,
  reviews,
  pending,
  onImport,
  onArchive,
}: {
  title: string;
  emptyText: string;
  reviews: ProspectionOfferReviewView[];
  pending: boolean;
  onImport: (id: string) => void;
  onArchive: (id: string) => void;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium">{title}</h2>
        <Badge variant="outline">{reviews.length}</Badge>
      </div>
      {reviews.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <div className="divide-y">
            {reviews.map((review) => (
              <article
                key={review.id}
                className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto]"
              >
                <div className="min-w-0 space-y-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <Badge variant="outline">
                      {PROSPECTION_OFFER_REVIEW_STATUS_LABELS[review.status]}
                    </Badge>
                    <Badge variant="outline">Collective.work</Badge>
                    <a
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
                      href={review.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Lien
                      <ExternalLink className="size-3" />
                    </a>
                  </div>
                  <div>
                    <h3 className="truncate text-base font-medium">
                      {review.title}
                    </h3>
                    {[review.organization, review.location, review.dailyRate]
                      .filter(Boolean)
                      .length > 0 ? (
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {[
                          review.organization,
                          review.location,
                          review.dailyRate,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {scoreLabel(review)}
                  </p>
                  {review.fitSignals.length > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Signaux: {review.fitSignals.join(", ")}
                    </p>
                  ) : null}
                  {review.reason ? (
                    <p className="text-sm text-muted-foreground">
                      {review.reason}
                    </p>
                  ) : null}
                </div>
                {review.status === "PENDING" ? (
                  <div className="flex flex-wrap items-start justify-end gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => onImport(review.id)}
                      disabled={pending}
                    >
                      <CheckCircle2 className="size-4" />
                      Importer
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onArchive(review.id)}
                      disabled={pending}
                    >
                      <Archive className="size-4" />
                      Archiver
                    </Button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
