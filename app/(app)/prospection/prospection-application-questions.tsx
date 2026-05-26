"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Clipboard,
  MessageSquareText,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  createProspectionApplicationQuestionAction,
  deleteProspectionApplicationQuestionAction,
  generateProspectionApplicationAnswerAction,
  updateProspectionApplicationQuestionAction,
} from "@/actions/prospection";
import type {
  ProspectionApplicationQuestionView,
  ProspectionEntryView,
} from "@/lib/prospection";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type PendingAction =
  | { id: string; type: "save" | "generate" | "delete" }
  | { id: "new"; type: "create" }
  | null;
type PendingActionType = NonNullable<PendingAction>["type"];

function replaceQuestion(
  questions: ProspectionApplicationQuestionView[],
  nextQuestion: ProspectionApplicationQuestionView,
) {
  return questions.map((question) =>
    question.id === nextQuestion.id ? nextQuestion : question,
  );
}

export function ProspectionApplicationQuestions({
  entry,
  initialQuestions,
}: {
  entry: ProspectionEntryView;
  initialQuestions: ProspectionApplicationQuestionView[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [questions, setQuestions] = useState(initialQuestions);
  const [newQuestion, setNewQuestion] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [pending, start] = useTransition();

  function setQuestionValue(
    id: string,
    key: "question" | "answer",
    value: string,
  ) {
    setQuestions((current) =>
      current.map((question) =>
        question.id === id ? { ...question, [key]: value } : question,
      ),
    );
  }

  function onCreate() {
    const question = newQuestion.trim();
    if (!question) {
      toast.error("Ajoute une question");
      return;
    }

    setPendingAction({ id: "new", type: "create" });
    start(async () => {
      const result = await createProspectionApplicationQuestionAction({
        entryId: entry.id,
        question,
        answer: "",
      });
      setPendingAction(null);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      if (!("question" in result)) return;
      setQuestions((current) => [...current, result.question]);
      setNewQuestion("");
      toast.success("Question ajoutée");
      router.refresh();
    });
  }

  function onSave(question: ProspectionApplicationQuestionView) {
    setPendingAction({ id: question.id, type: "save" });
    start(async () => {
      const result = await updateProspectionApplicationQuestionAction(
        question.id,
        {
          question: question.question,
          answer: question.answer,
        },
      );
      setPendingAction(null);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      if (!("question" in result)) return;
      setQuestions((current) => replaceQuestion(current, result.question));
      toast.success("Question enregistrée");
      router.refresh();
    });
  }

  function onGenerate(question: ProspectionApplicationQuestionView) {
    setPendingAction({ id: question.id, type: "generate" });
    start(async () => {
      const result = await generateProspectionApplicationAnswerAction(
        question.id,
        {
          question: question.question,
          answer: question.answer,
        },
      );
      setPendingAction(null);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      if (!("question" in result)) return;
      setQuestions((current) => replaceQuestion(current, result.question));
      toast.success("Réponse générée");
      router.refresh();
    });
  }

  function onDelete(questionId: string) {
    if (!window.confirm("Supprimer cette question ?")) return;

    setPendingAction({ id: questionId, type: "delete" });
    start(async () => {
      const result = await deleteProspectionApplicationQuestionAction(questionId);
      setPendingAction(null);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      setQuestions((current) =>
        current.filter((question) => question.id !== questionId),
      );
      toast.success("Question supprimée");
      router.refresh();
    });
  }

  async function onCopy(answer: string) {
    if (!answer.trim()) {
      toast.error("Aucune réponse à copier");
      return;
    }

    await navigator.clipboard.writeText(answer);
    toast.success("Réponse copiée");
  }

  function isPending(id: string, type?: PendingActionType) {
    return (
      pending &&
      pendingAction?.id === id &&
      (!type || pendingAction.type === type)
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        <MessageSquareText className="size-4" />
        Questions
        {questions.length > 0 ? (
          <span className="text-muted-foreground">{questions.length}</span>
        ) : null}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Questions de candidature pour {entry.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`application-question-${entry.id}`}>
              Nouvelle question
            </Label>
            <Textarea
              id={`application-question-${entry.id}`}
              value={newQuestion}
              onChange={(event) => setNewQuestion(event.target.value)}
              rows={2}
              placeholder="Ex: Pourquoi souhaitez-vous rejoindre cette mission ?"
            />
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={onCreate}
                disabled={pending}
                size="sm"
              >
                <Plus className="size-4" />
                {isPending("new", "create") ? "Ajout..." : "Ajouter"}
              </Button>
            </div>
          </div>

          {questions.length === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              Ajoute les questions demandées dans le formulaire de candidature.
            </p>
          ) : (
            <div className="space-y-4 border-t pt-4">
              {questions.map((question, index) => (
                <section
                  key={question.id}
                  className="space-y-3 rounded-md border p-3"
                >
                  <div className="space-y-2">
                    <Label htmlFor={`question-${question.id}`}>
                      Question {index + 1}
                    </Label>
                    <Textarea
                      id={`question-${question.id}`}
                      value={question.question}
                      onChange={(event) =>
                        setQuestionValue(
                          question.id,
                          "question",
                          event.target.value,
                        )
                      }
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`answer-${question.id}`}>Réponse</Label>
                    <Textarea
                      id={`answer-${question.id}`}
                      value={question.answer}
                      onChange={(event) =>
                        setQuestionValue(
                          question.id,
                          "answer",
                          event.target.value,
                        )
                      }
                      rows={5}
                      placeholder="Génère une réponse, puis ajuste-la avant de copier."
                    />
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onGenerate(question)}
                      disabled={pending || !question.question.trim()}
                    >
                      <Sparkles className="size-4" />
                      {isPending(question.id, "generate")
                        ? "Génération..."
                        : "Générer"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onCopy(question.answer)}
                    >
                      <Clipboard className="size-4" />
                      Copier
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onSave(question)}
                      disabled={pending || !question.question.trim()}
                    >
                      <Save className="size-4" />
                      {isPending(question.id, "save")
                        ? "Enregistrement..."
                        : "Enregistrer"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Supprimer la question"
                      onClick={() => onDelete(question.id)}
                      disabled={pending}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
