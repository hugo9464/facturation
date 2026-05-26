"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Eye, FileText, ImagePlus, Trash2 } from "lucide-react";
import {
  createProspectionResumeAction,
  deleteProspectionCvPhotoAction,
  deleteProspectionResumeAction,
  saveProspectionCvPhotoAction,
} from "@/actions/prospection-cv";
import type {
  ProspectionCvProfileView,
  ProspectionResumeView,
  ResumeMemory,
} from "@/lib/prospection-cv";
import { hasResumeMemory } from "@/lib/prospection-cv";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MAX_PHOTO_BYTES = 450_000;
const MAX_PDF_BYTES = 5 * 1024 * 1024;

function compactList(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean);
}

function ResumeMemoryPreview({ memory }: { memory: ResumeMemory }) {
  const skills = compactList(memory.skills.map((skill) => skill.name));
  const contact = compactList([
    memory.candidate.email,
    memory.candidate.phone,
    memory.candidate.location,
    ...memory.candidate.links,
  ]);

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h3 className="text-xs font-medium uppercase text-muted-foreground">
          Profil
        </h3>
        <div>
          {memory.candidate.fullName ? (
            <p className="font-medium">{memory.candidate.fullName}</p>
          ) : null}
          {memory.candidate.headline ? (
            <p className="text-sm text-muted-foreground">
              {memory.candidate.headline}
            </p>
          ) : null}
          {contact.length ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {contact.join(" · ")}
            </p>
          ) : null}
        </div>
        {memory.summary ? (
          <p className="whitespace-pre-line text-sm leading-6">
            {memory.summary}
          </p>
        ) : null}
      </section>

      {skills.length ? (
        <section className="space-y-2 border-t pt-4">
          <h3 className="text-xs font-medium uppercase text-muted-foreground">
            Compétences
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {skills.slice(0, 32).map((skill) => (
              <Badge key={skill} variant="secondary">
                {skill}
              </Badge>
            ))}
          </div>
        </section>
      ) : null}

      {memory.experiences.length ? (
        <section className="space-y-3 border-t pt-4">
          <h3 className="text-xs font-medium uppercase text-muted-foreground">
            Expériences
          </h3>
          {memory.experiences.map((experience, index) => (
            <article key={`${experience.role}-${index}`} className="space-y-1">
              <div>
                <p className="text-sm font-medium">
                  {[experience.role, experience.organization]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {[experience.period, experience.location]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              {experience.context ? (
                <p className="text-sm text-muted-foreground">
                  {experience.context}
                </p>
              ) : null}
              {experience.achievements.length ? (
                <ul className="list-disc space-y-1 pl-4 text-sm">
                  {experience.achievements.map((achievement) => (
                    <li key={achievement}>{achievement}</li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
        </section>
      ) : null}

      {memory.education.length ||
      memory.certifications.length ||
      memory.languages.length ? (
        <section className="space-y-3 border-t pt-4">
          <h3 className="text-xs font-medium uppercase text-muted-foreground">
            Formation
          </h3>
          {memory.education.map((education, index) => (
            <p key={`${education.label}-${index}`} className="text-sm">
              {[education.label, education.organization, education.period]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ))}
          {memory.certifications.length ? (
            <p className="text-sm text-muted-foreground">
              Certifications: {memory.certifications.join(", ")}
            </p>
          ) : null}
          {memory.languages.length ? (
            <p className="text-sm text-muted-foreground">
              Langues: {memory.languages.join(", ")}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

export function ProspectionCvManager({
  cvProfile,
  resumes,
}: {
  cvProfile: ProspectionCvProfileView | null;
  resumes: ProspectionResumeView[];
}) {
  const router = useRouter();
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState(
    cvProfile?.photoDataUrl ?? "",
  );
  const [selectedResume, setSelectedResume] =
    useState<ProspectionResumeView | null>(null);
  const [pending, start] = useTransition();
  const [photoPending, startPhoto] = useTransition();

  function onPhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choisis une image");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error("Photo trop lourde, vise moins de 450 Ko");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        const dataUrl = reader.result;
        startPhoto(async () => {
          const result = await saveProspectionCvPhotoAction({
            photoDataUrl: dataUrl,
          });
          if ("error" in result && result.error) {
            toast.error(result.error);
            return;
          }
          setPhotoDataUrl(dataUrl);
          toast.success("Photo mise à jour");
          router.refresh();
        });
      }
    };
    reader.readAsDataURL(file);
  }

  function onPdfChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type && file.type !== "application/pdf") {
      toast.error("Choisis un PDF");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      toast.error("PDF trop lourd, limite 5 Mo");
      event.target.value = "";
      return;
    }
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    start(async () => {
      const result = await createProspectionResumeAction(formData);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("CV ajouté");
      if (pdfInputRef.current) pdfInputRef.current.value = "";
      router.refresh();
    });
  }

  function onDeletePhoto() {
    startPhoto(async () => {
      const result = await deleteProspectionCvPhotoAction();
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      setPhotoDataUrl("");
      if (photoInputRef.current) photoInputRef.current.value = "";
      toast.success("Photo supprimée");
      router.refresh();
    });
  }

  function onDelete(id: string) {
    if (!window.confirm("Supprimer ce CV source ?")) return;
    start(async () => {
      const result = await deleteProspectionResumeAction(id);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("CV supprimé");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <div className="space-y-4">
        <form onSubmit={onSubmit} className="space-y-4 rounded-md border p-4">
          <div className="space-y-2">
            <Label htmlFor="cv-pdf">PDF du CV *</Label>
            <Input
              ref={pdfInputRef}
              id="cv-pdf"
              name="pdfFile"
              type="file"
              accept="application/pdf,.pdf"
              onChange={onPdfChange}
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? "Analyse..." : "Ajouter le PDF"}
            </Button>
          </div>
        </form>

        <div className="space-y-4 rounded-md border p-4">
          <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)]">
            <div className="flex size-20 items-center justify-center overflow-hidden rounded-md border bg-muted">
              {photoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt=""
                  src={photoDataUrl}
                  className="size-full object-cover"
                />
              ) : (
                <ImagePlus className="size-6 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="cv-photo">Photo</Label>
              <Input
                ref={photoInputRef}
                id="cv-photo"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={onPhotoChange}
                disabled={photoPending}
              />
              {photoDataUrl ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onDeletePhoto}
                  disabled={photoPending}
                >
                  Supprimer la photo
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-md border">
        {resumes.length === 0 ? (
          <div className="p-10 text-center">
            <FileText className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Ajoute au moins un CV source avant de générer une candidature.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {resumes.map((resume) => (
              <article
                key={resume.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedResume(resume)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedResume(resume);
                  }
                }}
                className="grid cursor-pointer gap-3 p-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[auto_minmax(0,1fr)_auto]"
              >
                <div className="flex size-12 items-center justify-center rounded-md border bg-muted">
                  <FileText className="size-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-medium">{resume.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {resume.sourceFileName
                      ? `PDF: ${resume.sourceFileName}`
                      : resume.notes || resume.content}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Supprimer le CV"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(resume.id);
                  }}
                  disabled={pending}
                >
                  <Trash2 className="size-4" />
                </Button>
              </article>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={selectedResume !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedResume(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          {selectedResume ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 pr-8">
                  <Eye className="size-4 text-muted-foreground" />
                  {selectedResume.title}
                </DialogTitle>
                <DialogDescription>
                  {selectedResume.sourceFileName ?? "CV source"}
                </DialogDescription>
              </DialogHeader>
              {hasResumeMemory(selectedResume.structuredContent) ? (
                <ResumeMemoryPreview memory={selectedResume.structuredContent} />
              ) : (
                <pre className="max-h-[65vh] whitespace-pre-wrap rounded-md border bg-muted/35 p-4 text-xs leading-5">
                  {selectedResume.content}
                </pre>
              )}
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
