"use client";

import type { CvQuestion } from "@/lib/prospection-cv";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function areCvQuestionsAnswered(
  questions: CvQuestion[],
  answers: Record<string, string>,
) {
  return questions.every((question) => answers[question.question]?.trim());
}

export function CvRefinementQuestions({
  idPrefix,
  questions,
  answers,
  onAnswer,
}: {
  idPrefix: string;
  questions: CvQuestion[];
  answers: Record<string, string>;
  onAnswer: (question: string, answer: string) => void;
}) {
  return (
    <div className="space-y-3 border-t pt-4">
      <div>
        <h3 className="text-sm font-medium">Questions d&apos;affinage</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Choisis une réponse pour chaque question avant de préparer le contenu.
        </p>
      </div>
      {questions.map((question) => {
        const selectedAnswer = answers[question.question] ?? "";
        return (
          <div key={question.id} className="space-y-2">
            <Label id={`${idPrefix}-${question.id}`}>{question.question}</Label>
            <div
              role="radiogroup"
              aria-labelledby={`${idPrefix}-${question.id}`}
              className="flex flex-wrap gap-2"
            >
              {question.options.map((option) => {
                const selected = option === selectedAnswer;
                return (
                  <Button
                    key={option}
                    type="button"
                    variant={selected ? "default" : "outline"}
                    size="sm"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => onAnswer(question.question, option)}
                  >
                    {option}
                  </Button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
