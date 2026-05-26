"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type {
  TailoredCv,
  TailoredCvEducation,
  TailoredCvExperience,
  TailoredCvSkill,
} from "@/lib/prospection-cv";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

function linesToArray(value: string) {
  return value.split("\n");
}

function arrayToLines(values: string[]) {
  return values.join("\n");
}

function emptyExperience(): TailoredCvExperience {
  return {
    role: "",
    organization: "",
    period: "",
    location: "",
    bullets: ["", ""],
  };
}

function emptyEducation(): TailoredCvEducation {
  return { label: "", organization: "", period: "" };
}

function emptySkill(): TailoredCvSkill {
  return { name: "", level: 4 };
}

function SkillLevelControl({
  level,
  onChange,
}: {
  level: number;
  onChange: (level: number) => void;
}) {
  return (
    <div className="flex h-8 items-center gap-1" aria-label="Score de maîtrise">
      {[1, 2, 3, 4, 5].map((point) => (
        <button
          key={point}
          type="button"
          className={cn(
            "size-4 rounded-full border border-primary/60 transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            point <= level ? "bg-primary" : "bg-background",
          )}
          onClick={() => onChange(point)}
          aria-label={`${point} point${point > 1 ? "s" : ""}`}
          aria-pressed={point <= level}
        />
      ))}
    </div>
  );
}

export function TailoredCvEditor({
  value,
  onChange,
}: {
  value: TailoredCv;
  onChange: (value: TailoredCv) => void;
}) {
  function patch(next: Partial<TailoredCv>) {
    onChange({ ...value, ...next });
  }

  function updateExperience(
    index: number,
    next: Partial<TailoredCvExperience>,
  ) {
    patch({
      experiences: value.experiences.map((experience, candidateIndex) =>
        candidateIndex === index ? { ...experience, ...next } : experience,
      ),
    });
  }

  function updateEducation(index: number, next: Partial<TailoredCvEducation>) {
    patch({
      education: value.education.map((education, candidateIndex) =>
        candidateIndex === index ? { ...education, ...next } : education,
      ),
    });
  }

  function updateSkill(index: number, next: Partial<TailoredCvSkill>) {
    patch({
      skills: value.skills.map((skill, candidateIndex) =>
        candidateIndex === index ? { ...skill, ...next } : skill,
      ),
    });
  }

  function moveExperience(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= value.experiences.length) return;

    const nextExperiences = [...value.experiences];
    const currentExperience = nextExperiences[index];
    const targetExperience = nextExperiences[targetIndex];
    if (!currentExperience || !targetExperience) return;

    nextExperiences[index] = targetExperience;
    nextExperiences[targetIndex] = currentExperience;
    patch({ experiences: nextExperiences });
  }

  function moveSkill(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= value.skills.length) return;

    const nextSkills = [...value.skills];
    const currentSkill = nextSkills[index];
    const targetSkill = nextSkills[targetIndex];
    if (!currentSkill || !targetSkill) return;

    nextSkills[index] = targetSkill;
    nextSkills[targetIndex] = currentSkill;
    patch({ skills: nextSkills });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="cv-full-name">Nom</Label>
          <Input
            id="cv-full-name"
            value={value.fullName}
            onChange={(event) => patch({ fullName: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cv-headline">Titre</Label>
          <Input
            id="cv-headline"
            value={value.headline}
            onChange={(event) => patch({ headline: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cv-location">Localisation</Label>
          <Input
            id="cv-location"
            value={value.location}
            onChange={(event) => patch({ location: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cv-email">Email</Label>
          <Input
            id="cv-email"
            value={value.email}
            onChange={(event) => patch({ email: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cv-phone">Téléphone</Label>
          <Input
            id="cv-phone"
            value={value.phone}
            onChange={(event) => patch({ phone: event.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cv-summary">Synthèse</Label>
        <Textarea
          id="cv-summary"
          value={value.summary}
          onChange={(event) => patch({ summary: event.target.value })}
          rows={4}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <Label>Compétences</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => patch({ skills: [...value.skills, emptySkill()] })}
            >
              <Plus className="size-4" />
              Ajouter
            </Button>
          </div>
          <div className="space-y-2">
            {value.skills.map((skill, index) => (
              <div
                key={index}
                className="grid gap-2 rounded-md border p-2 sm:grid-cols-[auto_minmax(0,1fr)_7rem_auto] sm:items-center"
              >
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Monter la compétence"
                    onClick={() => moveSkill(index, -1)}
                    disabled={index === 0}
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Descendre la compétence"
                    onClick={() => moveSkill(index, 1)}
                    disabled={index === value.skills.length - 1}
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                </div>
                <Input
                  value={skill.name}
                  onChange={(event) =>
                    updateSkill(index, { name: event.target.value })
                  }
                  placeholder="Compétence"
                />
                <SkillLevelControl
                  level={skill.level}
                  onChange={(level) => updateSkill(index, { level })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Supprimer la compétence"
                  onClick={() =>
                    patch({
                      skills: value.skills.filter(
                        (_, candidateIndex) => candidateIndex !== index,
                      ),
                    })
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cv-languages">Langues</Label>
          <Textarea
            id="cv-languages"
            value={arrayToLines(value.languages)}
            onChange={(event) =>
              patch({ languages: linesToArray(event.target.value) })
            }
            rows={8}
          />
        </div>
      </div>

      <div className="space-y-3 border-t pt-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium">Expériences</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              patch({ experiences: [...value.experiences, emptyExperience()] })
            }
          >
            <Plus className="size-4" />
            Ajouter
          </Button>
        </div>
        {value.experiences.map((experience, index) => (
          <div key={index} className="space-y-3 rounded-md border p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium text-muted-foreground">
                Expérience {index + 1}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Monter l'expérience"
                  onClick={() => moveExperience(index, -1)}
                  disabled={index === 0}
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Descendre l'expérience"
                  onClick={() => moveExperience(index, 1)}
                  disabled={index === value.experiences.length - 1}
                >
                  <ArrowDown className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Supprimer l'expérience"
                  onClick={() =>
                    patch({
                      experiences: value.experiences.filter(
                        (_, candidateIndex) => candidateIndex !== index,
                      ),
                    })
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                value={experience.role}
                onChange={(event) =>
                  updateExperience(index, { role: event.target.value })
                }
                placeholder="Poste"
              />
              <Input
                value={experience.organization}
                onChange={(event) =>
                  updateExperience(index, { organization: event.target.value })
                }
                placeholder="Organisation"
              />
              <Input
                value={experience.period}
                onChange={(event) =>
                  updateExperience(index, { period: event.target.value })
                }
                placeholder="Période"
              />
              <Input
                value={experience.location}
                onChange={(event) =>
                  updateExperience(index, { location: event.target.value })
                }
                placeholder="Localisation"
              />
            </div>
            <Textarea
              value={arrayToLines(experience.bullets)}
              onChange={(event) =>
                updateExperience(index, {
                  bullets: linesToArray(event.target.value),
                })
              }
              rows={4}
              placeholder="Une puce par ligne"
            />
          </div>
        ))}
      </div>

      <div className="space-y-3 border-t pt-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium">Formation</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => patch({ education: [...value.education, emptyEducation()] })}
          >
            <Plus className="size-4" />
            Ajouter
          </Button>
        </div>
        {value.education.map((education, index) => (
          <div key={index} className="grid gap-3 rounded-md border p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_9rem_auto]">
            <Input
              value={education.label}
              onChange={(event) =>
                updateEducation(index, { label: event.target.value })
              }
              placeholder="Diplôme"
            />
            <Input
              value={education.organization}
              onChange={(event) =>
                updateEducation(index, { organization: event.target.value })
              }
              placeholder="École"
            />
            <Input
              value={education.period}
              onChange={(event) =>
                updateEducation(index, { period: event.target.value })
              }
              placeholder="Année"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Supprimer la formation"
              onClick={() =>
                patch({
                  education: value.education.filter(
                    (_, candidateIndex) => candidateIndex !== index,
                  ),
                })
              }
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <Label htmlFor="cv-certifications">Certifications</Label>
        <Textarea
          id="cv-certifications"
          value={arrayToLines(value.certifications)}
          onChange={(event) =>
            patch({ certifications: linesToArray(event.target.value) })
          }
          rows={4}
        />
      </div>
    </div>
  );
}
