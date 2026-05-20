"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { FileText, ImagePlus, Plus, Trash2 } from "lucide-react";
import {
  createProspectionResumeAction,
  deleteProspectionResumeAction,
} from "@/actions/prospection-cv";
import type { ProspectionResumeView } from "@/lib/prospection-cv";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const MAX_PHOTO_BYTES = 450_000;

function emptyValues() {
  return {
    title: "",
    content: "",
    notes: "",
    photoDataUrl: "",
  };
}

export function ProspectionCvManager({
  resumes,
}: {
  resumes: ProspectionResumeView[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState(emptyValues);
  const [pending, start] = useTransition();

  function setValue<K extends keyof ReturnType<typeof emptyValues>>(
    key: K,
    value: ReturnType<typeof emptyValues>[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
  }

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
        setValue("photoDataUrl", reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    start(async () => {
      const result = await createProspectionResumeAction(values);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("CV ajouté");
      setValues(emptyValues());
      if (fileInputRef.current) fileInputRef.current.value = "";
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
      <form onSubmit={onSubmit} className="space-y-4 rounded-md border p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="cv-title">Nom du CV *</Label>
            <Input
              id="cv-title"
              value={values.title}
              onChange={(event) => setValue("title", event.target.value)}
              placeholder="Ex: CV freelance Next.js"
              required
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="cv-content">Contenu du CV *</Label>
            <Textarea
              id="cv-content"
              value={values.content}
              onChange={(event) => setValue("content", event.target.value)}
              rows={13}
              placeholder="Colle ici le texte de ton CV existant: profil, expériences, missions, compétences, formations..."
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cv-photo">Photo</Label>
            <Input
              ref={fileInputRef}
              id="cv-photo"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={onPhotoChange}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cv-notes">Notes</Label>
            <Input
              id="cv-notes"
              value={values.notes}
              onChange={(event) => setValue("notes", event.target.value)}
              placeholder="Ex: version profil produit"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            <Plus className="size-4" />
            {pending ? "Ajout..." : "Ajouter le CV"}
          </Button>
        </div>
      </form>

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
                className="grid gap-3 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto]"
              >
                <div className="flex size-12 items-center justify-center overflow-hidden rounded-md border bg-muted">
                  {resume.photoDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt=""
                      src={resume.photoDataUrl}
                      className="size-full object-cover"
                    />
                  ) : (
                    <ImagePlus className="size-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-medium">{resume.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {resume.notes || resume.content}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Supprimer le CV"
                  onClick={() => onDelete(resume.id)}
                  disabled={pending}
                >
                  <Trash2 className="size-4" />
                </Button>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
