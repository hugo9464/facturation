import {
  ExternalLink,
  Search,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import {
  getSupabaseDb,
  toProspectionApplicationQuestion,
  toProspectionCvGeneration,
  toProspectionCvProfile,
  toProspectionEntry,
  toProspectionOfferReview,
  toProspectionResume,
} from "@/lib/supabase/db";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  isClosedProspectionStatus,
  isProspectionApplicationQuestionsSchemaError,
  isProspectionOfferReviewSchemaError,
  prospectionPrimaryLine,
  serializeProspectionOfferReview,
  serializeProspectionApplicationQuestion,
  serializeProspectionEntry,
  sortProspectionApplicationQuestions,
  sortProspectionEntries,
  sortProspectionOfferReviews,
} from "@/lib/prospection";
import {
  serializeProspectionCvGeneration,
  serializeProspectionCvProfile,
  serializeProspectionResume,
  sortProspectionCvGenerations,
  sortProspectionResumes,
} from "@/lib/prospection-cv";
import { ProspectionForm } from "./prospection-form";
import { ProspectionRowActions } from "./prospection-row-actions";
import { ProspectionCvManager } from "./prospection-cv-manager";
import { ProspectionStatusSelect } from "./prospection-status-select";
import { ProspectionOfferCvActions } from "./prospection-offer-cv-actions";
import { ProspectionApplicationQuestions } from "./prospection-application-questions";
import { CollectiveWorkScanButton } from "./collective-work-scan-button";
import { CollectiveWorkReviewList } from "./collective-work-review-list";
import { Badge } from "@/components/ui/badge";

export default async function ProspectionPage() {
  const user = await requireUser();
  const supabase = await getSupabaseDb();
  const [
    entriesResult,
    resumesResult,
    generationsResult,
    cvProfileResult,
    applicationQuestionsResult,
    offerReviewsResult,
  ] = await Promise.all([
    supabase
      .from("prospection_entry")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("prospection_resume")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("prospection_cv_generation")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("prospection_cv_profile")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("prospection_application_question")
      .select("*")
      .eq("user_id", user.id)
      .order("order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("prospection_offer_review")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
  ]);
  if (entriesResult.error) throw entriesResult.error;
  if (resumesResult.error) throw resumesResult.error;
  if (generationsResult.error) throw generationsResult.error;
  if (cvProfileResult.error) throw cvProfileResult.error;
  if (
    applicationQuestionsResult.error &&
    !isProspectionApplicationQuestionsSchemaError(
      applicationQuestionsResult.error,
    )
  ) {
    throw applicationQuestionsResult.error;
  }
  if (
    offerReviewsResult.error &&
    !isProspectionOfferReviewSchemaError(offerReviewsResult.error)
  ) {
    throw offerReviewsResult.error;
  }

  const rows = sortProspectionEntries(
    (entriesResult.data ?? []).map(toProspectionEntry),
  );
  const resumes = sortProspectionResumes(
    (resumesResult.data ?? []).map(toProspectionResume),
  ).map(serializeProspectionResume);
  const generations = sortProspectionCvGenerations(
    (generationsResult.data ?? []).map(toProspectionCvGeneration),
  ).map(serializeProspectionCvGeneration);
  const cvProfile = cvProfileResult.data
    ? serializeProspectionCvProfile(toProspectionCvProfile(cvProfileResult.data))
    : null;
  const offerReviews = sortProspectionOfferReviews(
    offerReviewsResult.error
      ? []
      : (offerReviewsResult.data ?? []).map(toProspectionOfferReview),
  ).map(serializeProspectionOfferReview);
  const pendingOfferReviews = offerReviews.filter(
    (review) => review.status === "PENDING",
  );
  const activeRows = rows.filter(
    (row) => !isClosedProspectionStatus(row.status),
  );
  const applicationQuestionsByEntry = new Map<
    string,
    ReturnType<typeof serializeProspectionApplicationQuestion>[]
  >();
  const applicationQuestionsData = applicationQuestionsResult.error
    ? []
    : (applicationQuestionsResult.data ?? []);
  for (const question of sortProspectionApplicationQuestions(
    applicationQuestionsData.map(toProspectionApplicationQuestion),
  )) {
    const existing = applicationQuestionsByEntry.get(question.entryId) ?? [];
    existing.push(serializeProspectionApplicationQuestion(question));
    applicationQuestionsByEntry.set(question.entryId, existing);
  }
  const closedRows = rows.length - activeRows.length;

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Prospection</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeRows.length} offre{activeRows.length > 1 ? "s" : ""}{" "}
            active{activeRows.length > 1 ? "s" : ""}
            {closedRows > 0
              ? ` · ${closedRows} archivée${closedRows > 1 ? "s" : ""}`
              : ""}
          </p>
        </div>
        <CollectiveWorkScanButton />
      </div>

      <Tabs defaultValue="tracking">
          <TabsList>
            <TabsTrigger value="tracking">Suivi</TabsTrigger>
            <TabsTrigger value="review">
              Revue
              {pendingOfferReviews.length > 0
                ? ` (${pendingOfferReviews.length})`
                : ""}
            </TabsTrigger>
            <TabsTrigger value="resumes">Mes CV</TabsTrigger>
          </TabsList>

        <TabsContent value="tracking" className="space-y-4 pt-4">
          <ProspectionForm />

          {rows.length === 0 ? (
            <div className="rounded-lg border border-dashed p-12 text-center">
              <Search className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                Ajoute une offre à suivre.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <div className="divide-y">
                {rows.map((entry) => {
                  const serialized = serializeProspectionEntry(entry);
                  const offerDescription = entry.notes?.trim() ?? "";
                  const entryGenerations = offerDescription
                    ? generations.filter(
                        (generation) =>
                          generation.offerDescription.trim() ===
                          offerDescription,
                      )
                    : [];
                  return (
                    <article
                      key={entry.id}
                      className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto]"
                    >
                      <div className="min-w-0 space-y-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <ProspectionStatusSelect
                            entryId={entry.id}
                            status={entry.status}
                          />
                          {entry.sourceUrl?.includes("collective.work") ? (
                            <Badge variant="outline">Collective.work</Badge>
                          ) : null}
                          {entry.sourceUrl ? (
                            <a
                              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
                              href={entry.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Lien
                              <ExternalLink className="size-3" />
                            </a>
                          ) : null}
                        </div>
                        <div>
                          <h2 className="truncate text-base font-medium">
                            {prospectionPrimaryLine(entry)}
                          </h2>
                          {[entry.organization, entry.location]
                            .filter(Boolean)
                            .length > 0 ? (
                            <p className="mt-1 truncate text-sm text-muted-foreground">
                              {[entry.organization, entry.location]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-start justify-end gap-2">
                        <ProspectionApplicationQuestions
                          entry={serialized}
                          initialQuestions={
                            applicationQuestionsByEntry.get(entry.id) ?? []
                          }
                        />
                        <ProspectionOfferCvActions
                          entry={serialized}
                          resumes={resumes}
                          generations={entryGenerations}
                        />
                        <ProspectionRowActions entry={serialized} />
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}
          </TabsContent>

          <TabsContent value="review" className="space-y-4 pt-4">
            <CollectiveWorkReviewList reviews={pendingOfferReviews} />
          </TabsContent>

          <TabsContent value="resumes" className="pt-4">
          <ProspectionCvManager cvProfile={cvProfile} resumes={resumes} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
