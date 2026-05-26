"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import {
  createProspectionEntryAction,
  updateProspectionEntryAction,
  type ProspectionEntryInput,
} from "@/actions/prospection";
import {
  PROSPECTION_OFFER_STATUSES,
  PROSPECTION_STATUS_LABELS,
  type ProspectionEntryView,
} from "@/lib/prospection";
import type { ProspectionStatus } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Values = Required<ProspectionEntryInput>;

function initialStatus(status?: ProspectionStatus): Values["status"] {
  return PROSPECTION_OFFER_STATUSES.includes(status as Values["status"])
    ? (status as Values["status"])
    : "TO_APPLY";
}

function initialValues(entry?: ProspectionEntryView): Values {
  return {
    type: entry?.type ?? "OFFER",
    status: initialStatus(entry?.status),
    title: entry?.title ?? "",
    sourceUrl: entry?.sourceUrl ?? "",
    notes: entry?.notes ?? "",
  };
}

export function ProspectionForm({
  entry,
  onSaved,
}: {
  entry?: ProspectionEntryView;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(() => initialValues(entry));
  const [pending, start] = useTransition();
  const isEditing = Boolean(entry);

  function setValue<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    start(async () => {
      const result = entry
        ? await updateProspectionEntryAction(entry.id, values)
        : await createProspectionEntryAction(values);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(isEditing ? "Offre mise à jour" : "Offre ajoutée");
      if (!entry) setValues(initialValues());
      onSaved?.();
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-md border p-4">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor={entry ? `status-${entry.id}` : "status"}>Statut</Label>
          <Select
            value={values.status}
            onValueChange={(value) =>
              setValue("status", value as Values["status"])
            }
          >
            <SelectTrigger
              id={entry ? `status-${entry.id}` : "status"}
              className="w-full"
            >
              <SelectValue>{PROSPECTION_STATUS_LABELS[values.status]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PROSPECTION_OFFER_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {PROSPECTION_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 md:col-span-3">
          <Label htmlFor={entry ? `title-${entry.id}` : "title"}>Nom *</Label>
          <Input
            id={entry ? `title-${entry.id}` : "title"}
            value={values.title}
            onChange={(event) => setValue("title", event.target.value)}
            placeholder="Ex: Développeur Next.js freelance"
            required
          />
        </div>
        <div className="space-y-2 md:col-span-4">
          <Label htmlFor={entry ? `source-${entry.id}` : "source"}>Lien</Label>
          <Input
            id={entry ? `source-${entry.id}` : "source"}
            type="url"
            value={values.sourceUrl}
            onChange={(event) => setValue("sourceUrl", event.target.value)}
            placeholder="https://"
          />
        </div>
        <div className="space-y-2 md:col-span-4">
          <Label htmlFor={entry ? `notes-${entry.id}` : "notes"}>
            Contenu de l&apos;offre
          </Label>
          <Textarea
            id={entry ? `notes-${entry.id}` : "notes"}
            value={values.notes}
            onChange={(event) => setValue("notes", event.target.value)}
            rows={entry ? 8 : 6}
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {!isEditing ? <Plus className="size-4" /> : null}
          {pending ? "Enregistrement…" : isEditing ? "Enregistrer" : "Ajouter"}
        </Button>
      </div>
    </form>
  );
}
