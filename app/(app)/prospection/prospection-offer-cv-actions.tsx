"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Download,
  ExternalLink,
  FileCheck2,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import {
  askCvRefinementQuestionsAction,
  draftTailoredCvAction,
  saveTailoredCvAction,
} from "@/actions/prospection-cv";
import type { ProspectionEntryView } from "@/lib/prospection";
import type {
  CvAnswer,
  CvQuestion,
  ProspectionCvGenerationView,
  ProspectionResumeView,
  TailoredCv,
} from "@/lib/prospection-cv";
import {
  CvRefinementQuestions,
  areCvQuestionsAnswered,
} from "./cv-refinement-questions";
import { TailoredCvEditor } from "./tailored-cv-editor";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

function pdfUrl(generationId: string, download = false) {
  return `/api/prospection/cv-generations/${generationId}/pdf${download ? "?download=1" : ""}`;
}

export function ProspectionOfferCvActions({
  entry,
  resumes,
  generations,
}: {
  entry: ProspectionEntryView;
  resumes: ProspectionResumeView[];
  generations: ProspectionCvGenerationView[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedResumeIds, setSelectedResumeIds] = useState<string[]>(() =>
    resumes[0] ? [resumes[0].id] : [],
  );
  const [questions, setQuestions] = useState<CvQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [draftCv, setDraftCv] = useState<TailoredCv | null>(null);
  const [draftModel, setDraftModel] = useState("");
  const [questionsPending, startQuestions] = useTransition();
  const [draftPending, startDraft] = useTransition();
  const [savePending, startSave] = useTransition();
  const offerDescription = entry.notes?.trim() ?? "";
  const canUseOffer = offerDescription.length >= 80;
  const canAskQuestions = canUseOffer && selectedResumeIds.length > 0;
  const canDraft =
    canAskQuestions && questions.length > 0 && areCvQuestionsAnswered(questions, answers);
  const canSave = canDraft && draftCv !== null;
  const latestGeneration = generations[0];

  const selectedResumes = useMemo(
    () => resumes.filter((resume) => selectedResumeIds.includes(resume.id)),
    [resumes, selectedResumeIds],
  );

  function toggleResume(id: string) {
    setSelectedResumeIds((current) =>
      current.includes(id)
        ? current.filter((candidate) => candidate !== id)
        : [...current, id],
    );
  }

  function onAskQuestions() {
    startQuestions(async () => {
      const result = await askCvRefinementQuestionsAction({
        offerDescription,
        resumeIds: selectedResumeIds,
      });
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      if (!("questions" in result)) return;
      setQuestions(result.questions);
      setAnswers({});
      setDraftCv(null);
      setDraftModel("");
      toast.success("Questions prêtes");
    });
  }

  function setAnswer(question: string, answer: string) {
    setAnswers((current) => ({ ...current, [question]: answer }));
  }

  function payloadAnswers(): CvAnswer[] {
    return questions.map((question) => ({
      question: question.question,
      answer: answers[question.question] ?? "",
    }));
  }

  function onPrepareDraft() {
    startDraft(async () => {
      const result = await draftTailoredCvAction({
        title: entry.title,
        offerDescription,
        resumeIds: selectedResumeIds,
        questions,
        answers: payloadAnswers(),
      });
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      if (!("cv" in result)) return;
      setDraftCv(result.cv);
      setDraftModel(result.model);
      toast.success("Contenu du CV prêt à valider");
    });
  }

  function onSavePdf() {
    if (!draftCv) return;
    startSave(async () => {
      const result = await saveTailoredCvAction({
        title: entry.title,
        offerDescription,
        resumeIds: selectedResumeIds,
        questions,
        answers: payloadAnswers(),
        generatedCv: draftCv,
        model: draftModel,
      });
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("CV PDF généré");
      setQuestions([]);
      setAnswers({});
      setDraftCv(null);
      setDraftModel("");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {latestGeneration ? (
        <>
          <a
            className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
            href={pdfUrl(latestGeneration.id)}
            target="_blank"
            rel="noreferrer"
            aria-label="Afficher le CV PDF"
          >
            <ExternalLink className="size-4" />
          </a>
          <a
            className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
            href={pdfUrl(latestGeneration.id, true)}
            aria-label="Télécharger le CV PDF"
          >
            <Download className="size-4" />
          </a>
        </>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <Sparkles className="size-4" />
          Générer CV
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Générer un CV pour {entry.title}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {!canUseOffer ? (
              <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                Ajoute d&apos;abord le contenu de l&apos;offre dans la fiche pour
                générer un CV adapté.
              </p>
            ) : null}

            <div className="space-y-2">
              <Label>CV sources *</Label>
              {resumes.length === 0 ? (
                <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  Ajoute d&apos;abord un CV dans l&apos;onglet Mes CV.
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {resumes.map((resume) => (
                    <label
                      key={resume.id}
                      className="flex cursor-pointer items-start gap-2 rounded-md border p-3 hover:bg-muted"
                    >
                      <Checkbox
                        checked={selectedResumeIds.includes(resume.id)}
                        onCheckedChange={() => toggleResume(resume.id)}
                        className="mt-0.5"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {resume.title}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {resume.sourceFileName ?? "PDF analysé"}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onAskQuestions}
                disabled={!canAskQuestions || questionsPending || draftPending || savePending}
              >
                <HelpCircle className="size-4" />
                {questionsPending ? "Analyse..." : "Préparer"}
              </Button>
              <Button
                type="button"
                variant={draftCv ? "outline" : "default"}
                onClick={onPrepareDraft}
                disabled={!canDraft || draftPending || questionsPending || savePending}
              >
                <Sparkles className="size-4" />
                {draftPending
                  ? "Préparation..."
                  : draftCv
                    ? "Regénérer le contenu"
                    : "Préparer le contenu"}
              </Button>
              <Button
                type="button"
                onClick={onSavePdf}
                disabled={!canSave || savePending || draftPending || questionsPending}
              >
                <FileCheck2 className="size-4" />
                {savePending ? "Génération..." : "Valider le PDF"}
              </Button>
            </div>

            {questions.length > 0 ? (
              <CvRefinementQuestions
                idPrefix={`offer-${entry.id}-question`}
                questions={questions}
                answers={answers}
                onAnswer={setAnswer}
              />
            ) : null}

            {draftCv ? (
              <div className="space-y-4 border-t pt-4">
                <div>
                  <h3 className="text-sm font-medium">Contenu du CV à valider</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Modifie le contenu avant de créer le PDF final.
                  </p>
                </div>
                <TailoredCvEditor value={draftCv} onChange={setDraftCv} />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={onSavePdf}
                    disabled={savePending || draftPending || questionsPending}
                  >
                    <FileCheck2 className="size-4" />
                    {savePending ? "Génération..." : "Valider et générer le PDF"}
                  </Button>
                </div>
              </div>
            ) : null}

            {generations.length > 0 ? (
              <div className="space-y-2 border-t pt-4">
                <h3 className="text-sm font-medium">CV générés pour cette offre</h3>
                <div className="divide-y rounded-md border">
                  {generations.map((generation) => (
                    <article
                      key={generation.id}
                      className="flex items-center justify-between gap-3 p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {generation.title}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {generation.generatedCv.headline}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <a
                          className={buttonVariants({
                            variant: "outline",
                            size: "sm",
                          })}
                          href={pdfUrl(generation.id)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Afficher
                        </a>
                        <a
                          className={buttonVariants({
                            variant: "ghost",
                            size: "icon-sm",
                          })}
                          href={pdfUrl(generation.id, true)}
                          aria-label="Télécharger le CV PDF"
                        >
                          <Download className="size-4" />
                        </a>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}

            {selectedResumes.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                Base active: {selectedResumes
                  .map((resume) => resume.title)
                  .join(", ")}
              </p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
