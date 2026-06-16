import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getSupabaseDb, toJobOffer, toJobOfferAgentFeedback } from "@/lib/supabase/db";
import { saveJobOfferAgentFeedbackAction, updateJobOfferStatusAction } from "@/actions/job-offers";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { JobOfferStatus } from "@/db/schema";

const STATUS_LABELS: Record<JobOfferStatus | "ALL", string> = {
  ALL: "Toutes",
  NEW: "À regarder",
  SAVED: "Intéressantes",
  IGNORED: "Ignorées",
  APPLIED: "Candidaté",
};

function formatDate(date: Date | null): string {
  if (!date) return "Date inconnue";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function statusVariant(status: JobOfferStatus) {
  if (status === "NEW") return "default" as const;
  if (status === "SAVED") return "secondary" as const;
  if (status === "APPLIED") return "outline" as const;
  return "ghost" as const;
}

function StatusButton({ id, status, children }: { id: string; status: JobOfferStatus; children: React.ReactNode }) {
  return (
    <form action={updateJobOfferStatusAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <Button type="submit" size="sm" variant={status === "IGNORED" ? "ghost" : "outline"}>
        {children}
      </Button>
    </form>
  );
}

export default async function JobOffersPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const requestedStatus = params?.status?.toUpperCase();
  const status = ["NEW", "SAVED", "IGNORED", "APPLIED"].includes(requestedStatus ?? "")
    ? (requestedStatus as JobOfferStatus)
    : "NEW";

  const supabase = await getSupabaseDb();
  let query = supabase
    .from("job_offer")
    .select("*")
    .eq("user_id", user.id)
    .order("match_score", { ascending: false })
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("last_seen_at", { ascending: false })
    .limit(80);

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw error;
  const offers = (data ?? []).map(toJobOffer);

  const { data: feedbackRows, error: feedbackError } = await supabase
    .from("job_offer_agent_feedback")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);
  if (feedbackError) throw feedbackError;
  const feedback = (feedbackRows ?? []).map(toJobOfferAgentFeedback);

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Offres d&apos;emploi</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Agent de veille pour les missions product builder, no-code/low-code et IA.
            Les offres sont rafraîchies toutes les heures.
          </p>
        </div>
        <Badge variant="outline">{offers.length} offre{offers.length > 1 ? "s" : ""}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Adapter l&apos;agent</CardTitle>
          <CardDescription>
            Envoie une consigne en langage naturel. Exemple : “Cherche avec un salaire minimum de 60k€”.
            Elle sera prise en compte lors des prochains rafraîchissements.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={saveJobOfferAgentFeedbackAction} className="space-y-3">
            <textarea
              name="message"
              required
              minLength={3}
              maxLength={1200}
              rows={3}
              placeholder="Ex: privilégie les missions remote, ignore les CDI, salaire minimum 60k€..."
              className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
            />
            <Button type="submit" size="sm">Envoyer à l&apos;agent</Button>
          </form>
          {feedback.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Derniers retours envoyés</p>
              <div className="grid gap-2">
                {feedback.map((item) => (
                  <div key={item.id} className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                    <p>{item.message}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Envoyé le {formatDate(item.createdAt)}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {(["NEW", "SAVED", "APPLIED", "IGNORED"] as JobOfferStatus[]).map((item) => (
          <Link
            key={item}
            href={`/job-offers?status=${item}`}
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
              status === item
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {STATUS_LABELS[item]}
          </Link>
        ))}
      </div>

      {offers.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Aucune offre pour ce filtre</CardTitle>
            <CardDescription>
              L&apos;agent en ajoutera automatiquement au prochain passage horaire si des offres pertinentes sont trouvées.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4">
          {offers.map((offer) => (
            <Card key={offer.id}>
              <CardHeader>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={statusVariant(offer.status)}>{STATUS_LABELS[offer.status]}</Badge>
                      <Badge variant="outline">Score {offer.matchScore}</Badge>
                      <Badge variant="outline">{offer.source}</Badge>
                      {offer.remote ? <Badge variant="secondary">Remote</Badge> : null}
                    </div>
                    <CardTitle className="text-lg">
                      <Link href={offer.sourceUrl} target="_blank" rel="noreferrer" className="hover:underline">
                        {offer.title}
                      </Link>
                    </CardTitle>
                    <CardDescription>
                      {[offer.company, offer.location, offer.contractType, offer.salary]
                        .filter(Boolean)
                        .join(" · ") || "Détails non fournis"}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusButton id={offer.id} status="SAVED">Intéressé</StatusButton>
                    <StatusButton id={offer.id} status="APPLIED">Candidaté</StatusButton>
                    <StatusButton id={offer.id} status="IGNORED">Ignorer</StatusButton>
                    <ButtonLink href={offer.sourceUrl} target="_blank" rel="noreferrer" size="sm" variant="default">
                      Voir <ExternalLink className="size-3" />
                    </ButtonLink>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {offer.description ? (
                  <p className="line-clamp-3 text-sm text-muted-foreground">{offer.description}</p>
                ) : null}
                <div className="flex flex-wrap gap-1.5">
                  {offer.matchedKeywords.slice(0, 10).map((keyword) => (
                    <Badge key={keyword} variant="outline">{keyword}</Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Publiée : {formatDate(offer.publishedAt)} · Vue par l&apos;agent : {formatDate(offer.lastSeenAt)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
