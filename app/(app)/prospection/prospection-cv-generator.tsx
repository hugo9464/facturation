"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Download, HelpCircle, Sparkles } from "lucide-react";
import {
  askCvRefinementQuestionsAction,
  generateTailoredCvAction,
} from "@/actions/prospection-cv";
import type {
  CvAnswer,
  CvQuestion,
  ProspectionCvGenerationView,
  ProspectionResumeView,
} from "@/lib/prospection-cv";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ProspectionCvGenerator({
  resumes,
  generations,
}: {
  resumes: ProspectionResumeView[];
  generations: ProspectionCvGenerationView[];
}) {
  const router = useRouter();
  const [offerDescription, setOfferDescription] = useState("");
  const [title, setTitle] = useState("");
  const [selectedResumeIds, setSelectedResumeIds] = useState<string[]>(() =>
    resumes[0] ? [resumes[0].id] : [],
  );
  const [questions, setQuestions] = useState<CvQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [questionsPending, startQuestions] = useTransition();
  const [generationPending, startGeneration] = useTransition();

  const canAskQuestions =
    offerDescription.trim().length >= 80 && selectedResumeIds.length > 0;
  const canGenerate = canAskQuestions && questions.length > 0;

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
      toast.success("Questions prêtes");
    });
  }

  function setAnswer(question: string, answer: string) {
    setAnswers((current) => ({ ...current, [question]: answer }));
  }

  function onGenerate() {
    startGeneration(async () => {
      const payloadAnswers: CvAnswer[] = questions.map((question) => ({
        question: question.question,
        answer: answers[question.question] ?? "",
      }));
      const result = await generateTailoredCvAction({
        title,
        offerDescription,
        resumeIds: selectedResumeIds,
        questions,
        answers: payloadAnswers,
      });
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("CV généré");
      setTitle("");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
      <div className="space-y-4 rounded-md border p-4">
        <div className="space-y-2">
          <Label htmlFor="generation-title">Titre interne</Label>
          <Input
            id="generation-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ex: Candidature Lead Next.js - Acme"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="offer-description">Descriptif de l&apos;offre *</Label>
          <Textarea
            id="offer-description"
            value={offerDescription}
            onChange={(event) => setOfferDescription(event.target.value)}
            rows={10}
            placeholder="Colle ici l'annonce, le contexte mission, les attendus, la stack, les responsabilités et les critères importants..."
          />
        </div>

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
                      {resume.photoDataUrl ? "Photo incluse" : "Sans photo"}
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
            disabled={!canAskQuestions || questionsPending || generationPending}
          >
            <HelpCircle className="size-4" />
            {questionsPending ? "Analyse..." : "Poser les questions"}
          </Button>
          <Button
            type="button"
            onClick={onGenerate}
            disabled={!canGenerate || generationPending || questionsPending}
          >
            <Sparkles className="size-4" />
            {generationPending ? "Génération..." : "Générer le CV PDF"}
          </Button>
        </div>

        {questions.length > 0 ? (
          <div className="space-y-3 border-t pt-4">
            <div>
              <h3 className="text-sm font-medium">Questions d&apos;affinage</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Réponds seulement aux points utiles, l&apos;IA prendra le reste depuis
                les CV sélectionnés.
              </p>
            </div>
            {questions.map((question) => (
              <div key={question.id} className="space-y-2">
                <Label htmlFor={`question-${question.id}`}>
                  {question.question}
                </Label>
                <Textarea
                  id={`question-${question.id}`}
                  value={answers[question.question] ?? ""}
                  onChange={(event) =>
                    setAnswer(question.question, event.target.value)
                  }
                  rows={2}
                />
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-4">
        {latestGeneration ? (
          <div className="rounded-md border p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Dernier CV généré</p>
                <h3 className="mt-1 truncate text-base font-medium">
                  {latestGeneration.title}
                </h3>
                <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
                  {latestGeneration.generatedCv.summary}
                </p>
              </div>
              <a
                className={buttonVariants({ variant: "outline", size: "sm" })}
                href={`/api/prospection/cv-generations/${latestGeneration.id}/pdf`}
                target="_blank"
                rel="noreferrer"
              >
                <Download className="size-4" />
                PDF
              </a>
            </div>
          </div>
        ) : null}

        <div className="rounded-md border">
          <div className="border-b p-4">
            <h3 className="text-sm font-medium">CV générés</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {generations.length} version{generations.length > 1 ? "s" : ""}
            </p>
          </div>
          {generations.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Les PDF générés apparaîtront ici.
            </p>
          ) : (
            <div className="divide-y">
              {generations.map((generation) => (
                <article
                  key={generation.id}
                  className="flex items-start justify-between gap-3 p-4"
                >
                  <div className="min-w-0">
                    <h4 className="truncate text-sm font-medium">
                      {generation.title}
                    </h4>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {generation.generatedCv.headline}
                    </p>
                  </div>
                  <a
                    className={buttonVariants({
                      variant: "ghost",
                      size: "icon-sm",
                    })}
                    href={`/api/prospection/cv-generations/${generation.id}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Ouvrir le PDF"
                  >
                    <Download className="size-4" />
                  </a>
                </article>
              ))}
            </div>
          )}
        </div>

        {selectedResumes.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Base active: {selectedResumes.map((resume) => resume.title).join(", ")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
