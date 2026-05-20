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
  PROSPECTION_STATUS_LABELS,
  PROSPECTION_TYPE_LABELS,
  type ProspectionEntryView,
} from "@/lib/prospection";
import { prospectionStatusEnum, prospectionTypeEnum } from "@/db/schema";
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

function initialValues(entry?: ProspectionEntryView): Values {
  return {
    type: entry?.type ?? "OFFER",
    status: entry?.status ?? "TO_APPLY",
    title: entry?.title ?? "",
    organization: entry?.organization ?? "",
    contactName: entry?.contactName ?? "",
    email: entry?.email ?? "",
    phone: entry?.phone ?? "",
    sourceUrl: entry?.sourceUrl ?? "",
    location: entry?.location ?? "",
    targetDate: entry?.targetDate ?? "",
    appliedAt: entry?.appliedAt ?? "",
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
      toast.success(
        isEditing ? "Prospection mise à jour" : "Prospection ajoutée",
      );
      if (!entry) setValues(initialValues());
      onSaved?.();
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-md border p-4">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor={entry ? `type-${entry.id}` : "type"}>Type</Label>
          <Select
            value={values.type}
            onValueChange={(value) => setValue("type", value as Values["type"])}
          >
            <SelectTrigger
              id={entry ? `type-${entry.id}` : "type"}
              className="w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {prospectionTypeEnum.enumValues.map((type) => (
                <SelectItem key={type} value={type}>
                  {PROSPECTION_TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {prospectionStatusEnum.enumValues.map((status) => (
                <SelectItem key={status} value={status}>
                  {PROSPECTION_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor={entry ? `title-${entry.id}` : "title"}>Titre *</Label>
          <Input
            id={entry ? `title-${entry.id}` : "title"}
            value={values.title}
            onChange={(event) => setValue("title", event.target.value)}
            placeholder="Ex: Développeur Next.js freelance"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={entry ? `organization-${entry.id}` : "organization"}>
            Entreprise
          </Label>
          <Input
            id={entry ? `organization-${entry.id}` : "organization"}
            value={values.organization}
            onChange={(event) => setValue("organization", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={entry ? `contact-${entry.id}` : "contact"}>Contact</Label>
          <Input
            id={entry ? `contact-${entry.id}` : "contact"}
            value={values.contactName}
            onChange={(event) => setValue("contactName", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={entry ? `email-${entry.id}` : "email"}>Email</Label>
          <Input
            id={entry ? `email-${entry.id}` : "email"}
            type="email"
            value={values.email}
            onChange={(event) => setValue("email", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={entry ? `phone-${entry.id}` : "phone"}>
            Téléphone
          </Label>
          <Input
            id={entry ? `phone-${entry.id}` : "phone"}
            value={values.phone}
            onChange={(event) => setValue("phone", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={entry ? `source-${entry.id}` : "source"}>Lien</Label>
          <Input
            id={entry ? `source-${entry.id}` : "source"}
            type="url"
            value={values.sourceUrl}
            onChange={(event) => setValue("sourceUrl", event.target.value)}
            placeholder="https://"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={entry ? `location-${entry.id}` : "location"}>
            Lieu
          </Label>
          <Input
            id={entry ? `location-${entry.id}` : "location"}
            value={values.location}
            onChange={(event) => setValue("location", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={entry ? `target-${entry.id}` : "target"}>Échéance</Label>
          <Input
            id={entry ? `target-${entry.id}` : "target"}
            type="date"
            value={values.targetDate}
            onChange={(event) => setValue("targetDate", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={entry ? `applied-${entry.id}` : "applied"}>
            Date candidature
          </Label>
          <Input
            id={entry ? `applied-${entry.id}` : "applied"}
            type="date"
            value={values.appliedAt}
            onChange={(event) => setValue("appliedAt", event.target.value)}
          />
        </div>
        <div className="space-y-2 md:col-span-4">
          <Label htmlFor={entry ? `notes-${entry.id}` : "notes"}>Notes</Label>
          <Textarea
            id={entry ? `notes-${entry.id}` : "notes"}
            value={values.notes}
            onChange={(event) => setValue("notes", event.target.value)}
            rows={entry ? 3 : 2}
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
