import {
  BriefcaseBusiness,
  Building2,
  Mail,
  Phone,
  Search,
  UserRound,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import {
  getSupabaseDb,
  toProspectionCvGeneration,
  toProspectionEntry,
  toProspectionResume,
} from "@/lib/supabase/db";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  PROSPECTION_STATUS_LABELS,
  PROSPECTION_TYPE_LABELS,
  isClosedProspectionStatus,
  prospectionPrimaryLine,
  serializeProspectionEntry,
  sortProspectionEntries,
} from "@/lib/prospection";
import {
  serializeProspectionCvGeneration,
  serializeProspectionResume,
  sortProspectionCvGenerations,
  sortProspectionResumes,
} from "@/lib/prospection-cv";
import { ProspectionForm } from "./prospection-form";
import { ProspectionRowActions } from "./prospection-row-actions";
import { ProspectionCvManager } from "./prospection-cv-manager";
import { ProspectionCvGenerator } from "./prospection-cv-generator";
import type { ProspectionEntry } from "@/db/schema";

function formatDate(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function typeIcon(type: ProspectionEntry["type"]) {
  if (type === "COMPANY") return <Building2 className="size-4" />;
  if (type === "CONTACT") return <UserRound className="size-4" />;
  if (type === "MISSION") return <BriefcaseBusiness className="size-4" />;
  return <Search className="size-4" />;
}

export default async function ProspectionPage() {
  const user = await requireUser();
  const supabase = await getSupabaseDb();
  const [entriesResult, resumesResult, generationsResult] = await Promise.all([
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
  ]);
  if (entriesResult.error) throw entriesResult.error;
  if (resumesResult.error) throw resumesResult.error;
  if (generationsResult.error) throw generationsResult.error;

  const rows = sortProspectionEntries(
    (entriesResult.data ?? []).map(toProspectionEntry),
  );
  const resumes = sortProspectionResumes(
    (resumesResult.data ?? []).map(toProspectionResume),
  ).map(serializeProspectionResume);
  const generations = sortProspectionCvGenerations(
    (generationsResult.data ?? []).map(toProspectionCvGeneration),
  ).map(serializeProspectionCvGeneration);
  const activeRows = rows.filter(
    (row) => !isClosedProspectionStatus(row.status),
  );
  const closedRows = rows.length - activeRows.length;

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Prospection</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeRows.length} opportunité{activeRows.length > 1 ? "s" : ""}{" "}
            active{activeRows.length > 1 ? "s" : ""}
            {closedRows > 0
              ? ` · ${closedRows} clôturée${closedRows > 1 ? "s" : ""}`
              : ""}
          </p>
        </div>
      </div>

      <Tabs defaultValue="tracking">
        <TabsList>
          <TabsTrigger value="tracking">Suivi</TabsTrigger>
          <TabsTrigger value="resumes">Mes CV</TabsTrigger>
          <TabsTrigger value="generator">CV adapté</TabsTrigger>
        </TabsList>

        <TabsContent value="tracking" className="space-y-4 pt-4">
          <ProspectionForm />

          {rows.length === 0 ? (
            <div className="rounded-lg border border-dashed p-12 text-center">
              <Search className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                Ajoute une offre, une mission, une entreprise ou un contact à suivre.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <div className="divide-y">
                {rows.map((entry) => {
                  const targetDate = formatDate(entry.targetDate);
                  const appliedAt = formatDate(entry.appliedAt);
                  const serialized = serializeProspectionEntry(entry);
                  return (
                    <article
                      key={entry.id}
                      className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto]"
                    >
                      <div className="min-w-0 space-y-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <Badge variant="outline" className="gap-1">
                            {typeIcon(entry.type)}
                            {PROSPECTION_TYPE_LABELS[entry.type]}
                          </Badge>
                          <Badge
                            variant={
                              isClosedProspectionStatus(entry.status)
                                ? "secondary"
                                : "default"
                            }
                          >
                            {PROSPECTION_STATUS_LABELS[entry.status]}
                          </Badge>
                          {targetDate ? (
                            <span className="text-xs text-muted-foreground">
                              Échéance {targetDate}
                            </span>
                          ) : null}
                          {appliedAt ? (
                            <span className="text-xs text-muted-foreground">
                              Candidaté le {appliedAt}
                            </span>
                          ) : null}
                        </div>
                        <div>
                          <h2 className="truncate text-base font-medium">
                            {prospectionPrimaryLine(entry)}
                          </h2>
                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            {entry.contactName ? (
                              <span>{entry.contactName}</span>
                            ) : null}
                            {entry.location ? <span>{entry.location}</span> : null}
                            {entry.email ? (
                              <a
                                className="inline-flex items-center gap-1 hover:text-foreground"
                                href={`mailto:${entry.email}`}
                              >
                                <Mail className="size-3.5" />
                                {entry.email}
                              </a>
                            ) : null}
                            {entry.phone ? (
                              <a
                                className="inline-flex items-center gap-1 hover:text-foreground"
                                href={`tel:${entry.phone}`}
                              >
                                <Phone className="size-3.5" />
                                {entry.phone}
                              </a>
                            ) : null}
                            {entry.sourceUrl ? (
                              <a
                                className="hover:text-foreground hover:underline"
                                href={entry.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Source
                              </a>
                            ) : null}
                          </div>
                        </div>
                        {entry.notes ? (
                          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                            {entry.notes}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-start justify-end">
                        <ProspectionRowActions entry={serialized} />
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="resumes" className="pt-4">
          <ProspectionCvManager resumes={resumes} />
        </TabsContent>

        <TabsContent value="generator" className="pt-4">
          <ProspectionCvGenerator resumes={resumes} generations={generations} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
