"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button, ButtonLink, buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  createTimeEntryAction,
  updateTimeEntryAction,
} from "@/actions/time-entries";
import { todayISO } from "@/lib/dates";
import type { Client, RateType, TimeEntry, TodoProject } from "@/db/schema";
import { cn } from "@/lib/utils";

export type TimeEntryProjectOption = TodoProject & {
  client: Pick<Client, "id" | "name" | "defaultRateCents" | "defaultRateType">;
};

const TYPE_LABELS: Record<RateType, string> = {
  DAY: "Jour",
  HALF_DAY: "Demi-journée",
  HOUR: "Heure",
  FORFAIT: "Forfait",
};

const DEFAULT_QTY: Record<RateType, string> = {
  DAY: "1",
  HALF_DAY: "0.5",
  HOUR: "1",
  FORFAIT: "1",
};

export function TimeEntryDialog({
  children,
  projects,
  entry,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  children?: React.ReactNode;
  projects: TimeEntryProjectOption[];
  entry?: TimeEntry;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const [pending, startTransition] = useTransition();

  const isEdit = Boolean(entry);
  const initialProject =
    projects.find((project) => project.id === entry?.projectId) ??
    projects.find((project) => project.clientId === entry?.clientId) ??
    projects[0];
  const initialProjectId = initialProject?.id ?? "";
  const initialType = entry?.type ?? initialProject?.client.defaultRateType ?? "DAY";
  const initialQuantity = entry
    ? entry.quantity
    : DEFAULT_QTY[initialType];
  const initialRateCents =
    entry?.rateCents ?? initialProject?.client.defaultRateCents ?? 0;
  const entryKey = entry?.id ?? "new";

  const [loadedEntryKey, setLoadedEntryKey] = useState(entryKey);
  const [projectId, setProjectId] = useState(initialProjectId);
  const [type, setType] = useState<RateType>(initialType);
  const [quantity, setQuantity] = useState(initialQuantity);
  const [rateCentsOverride, setRateCentsOverride] = useState<number | null>(
    isEdit ? initialRateCents : null,
  );

  if (loadedEntryKey !== entryKey) {
    setLoadedEntryKey(entryKey);
    setProjectId(initialProjectId);
    setType(initialType);
    setQuantity(initialQuantity);
    setRateCentsOverride(isEdit ? initialRateCents : null);
  }

  const selectedProject = projects.find((project) => project.id === projectId);
  const selectedClient = selectedProject?.client;
  const rateCents =
    rateCentsOverride ?? selectedClient?.defaultRateCents ?? 0;

  function onProjectChange(id: string | null) {
    if (!id) return;
    setProjectId(id);
    const project = projects.find((item) => item.id === id);
    if (project && !isEdit) {
      setType(project.client.defaultRateType);
      setQuantity(DEFAULT_QTY[project.client.defaultRateType]);
      setRateCentsOverride(null);
    }
  }

  function onTypeChange(t: string | null) {
    if (!t) return;
    setType(t as RateType);
    if (!isEdit) setQuantity(DEFAULT_QTY[t as RateType]);
  }

  const trigger =
    children !== undefined ? (children as React.ReactElement) : null;
  const triggerProps =
    trigger && "props" in trigger
      ? (trigger.props as {
          children?: React.ReactNode;
          className?: string;
          variant?: React.ComponentProps<typeof Button>["variant"];
          size?: React.ComponentProps<typeof Button>["size"];
        })
      : null;
  const triggerNode = triggerProps ? (
    <DialogTrigger
      className={cn(
        buttonVariants({
          variant: triggerProps.variant ?? "default",
          size: triggerProps.size ?? "default",
          className: triggerProps.className,
        }),
      )}
    >
      {triggerProps.children}
    </DialogTrigger>
  ) : null;

  if (projects.length === 0) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        {triggerNode}
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aucun projet</DialogTitle>
            <DialogDescription>
              Crée d&apos;abord un projet rattaché à un client pour logger du
              temps.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <ButtonLink href="/projects" onClick={() => setOpen(false)}>
              Créer un projet
            </ButtonLink>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {triggerNode}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Modifier la saisie" : "Logger du temps"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Tu peux changer la date, la quantité, le type ou le tarif."
              : "Saisie rapide d'une prestation."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          action={(formData) => {
            startTransition(async () => {
              const result = isEdit
                ? await updateTimeEntryAction(entry!.id, formData)
                : await createTimeEntryAction(formData);
              if (result?.error) {
                toast.error(result.error);
              } else {
                toast.success(isEdit ? "Saisie modifiée" : "Saisie enregistrée");
                setOpen(false);
              }
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="project_id">Projet</Label>
            <Select value={projectId} onValueChange={onProjectChange}>
              <SelectTrigger id="project_id" className="w-full">
                <span className="truncate">
                  {selectedProject
                    ? `${selectedProject.name} · ${selectedProject.client.name}`
                    : "Projet"}
                </span>
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name} · {project.client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="project_id" value={projectId} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                name="date"
                type="date"
                defaultValue={entry?.date ?? todayISO()}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select value={type} onValueChange={onTypeChange}>
                <SelectTrigger id="type" className="w-full">
                  <span className="truncate">{TYPE_LABELS[type]}</span>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="type" value={type} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantité</Label>
              <Input
                id="quantity"
                name="quantity"
                type="number"
                step="0.25"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rate">Tarif unitaire (€)</Label>
              <Input
                id="rate"
                type="number"
                step="0.01"
                min="0"
                value={(rateCents / 100).toFixed(2)}
                onChange={(e) => {
                  const cents = Math.round(
                    Number(e.target.value.replace(",", ".")) * 100,
                  );
                  setRateCentsOverride(cents);
                }}
              />
              <input type="hidden" name="rate_cents" value={rateCents} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              rows={2}
              defaultValue={entry?.description ?? ""}
              placeholder="Ex: Refonte de la page d'accueil"
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending
                ? "Enregistrement…"
                : isEdit
                  ? "Enregistrer"
                  : "Logger"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
