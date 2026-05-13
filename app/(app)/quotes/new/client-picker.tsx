"use client";

import { useState, useTransition, useMemo } from "react";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { createDraftQuoteAction } from "@/actions/quotes";
import {
  getClientMissingFields,
  type MissingField,
} from "@/lib/billing-readiness";
import type { Client, TodoProject } from "@/db/schema";

type ProjectOption = TodoProject & {
  client: Client;
};

export function NewQuotePicker({
  projects,
  preselectedProjectId,
  profileMissing,
}: {
  projects: ProjectOption[];
  preselectedProjectId?: string;
  profileMissing: MissingField[];
}) {
  const [projectId, setProjectId] = useState(
    preselectedProjectId ?? projects[0]?.id ?? "",
  );
  const [pending, start] = useTransition();

  const selectedProject = projects.find((project) => project.id === projectId);
  const selectedClient = selectedProject?.client;
  const clientMissing = useMemo(
    () => (selectedClient ? getClientMissingFields(selectedClient) : []),
    [selectedClient],
  );
  const billable =
    profileMissing.length === 0 && clientMissing.length === 0;

  if (projects.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Aucun projet</CardTitle>
          <CardDescription>
            Crée d&apos;abord un projet rattaché à un client pour pouvoir faire
            un devis.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ButtonLink href="/projects">Créer un projet</ButtonLink>
        </CardContent>
      </Card>
    );
  }

  function onSubmit() {
    if (!projectId) return;
    start(async () => {
      const r = await createDraftQuoteAction({ projectId });
      if (r?.error) toast.error(r.error);
    });
  }

  return (
    <div className="space-y-6">
      {(profileMissing.length > 0 || clientMissing.length > 0) && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-3">
          <div className="flex items-start gap-2 text-destructive">
            <AlertCircle className="size-4 mt-0.5 shrink-0" />
            <p className="text-sm font-medium">
              Informations manquantes pour ce devis
            </p>
          </div>
          {profileMissing.length > 0 && (
            <div className="text-sm pl-6">
              <p className="font-medium">Tes paramètres :</p>
              <ul className="list-disc pl-5 text-muted-foreground mt-1">
                {profileMissing.map((m) => (
                  <li key={m.field}>{m.label}</li>
                ))}
              </ul>
              <ButtonLink
                href="/settings"
                size="sm"
                variant="outline"
                className="mt-2"
              >
                Compléter les paramètres
              </ButtonLink>
            </div>
          )}
          {clientMissing.length > 0 && selectedClient && (
            <div className="text-sm pl-6">
              <p className="font-medium">Client {selectedClient.name} :</p>
              <ul className="list-disc pl-5 text-muted-foreground mt-1">
                {clientMissing.map((m) => (
                  <li key={m.field}>{m.label}</li>
                ))}
              </ul>
              <ButtonLink
                href={`/clients/${selectedClient.id}`}
                size="sm"
                variant="outline"
                className="mt-2"
              >
                Compléter le client
              </ButtonLink>
            </div>
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Projet</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="project">Sélectionne le projet</Label>
            <Select
              value={projectId}
              onValueChange={(v) => v && setProjectId(v)}
            >
              <SelectTrigger id="project" className="w-full">
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
          </div>
        </CardContent>
      </Card>

      <Button
        onClick={onSubmit}
        disabled={pending || !billable || !projectId}
        size="lg"
      >
        {pending ? "Création…" : "Créer le brouillon"}
      </Button>
    </div>
  );
}
