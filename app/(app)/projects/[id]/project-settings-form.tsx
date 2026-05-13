"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { updateTodoProjectAction } from "@/actions/todo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import type { Client, TodoProject } from "@/db/schema";

export function ProjectSettingsForm({
  project,
  clients,
}: {
  project: TodoProject;
  clients: Client[];
}) {
  const [name, setName] = useState(project.name);
  const [clientId, setClientId] = useState(project.clientId ?? "");
  const [pending, start] = useTransition();
  const selectedClient = clients.find((client) => client.id === clientId);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    start(async () => {
      const result = await updateTodoProjectAction(project.id, {
        name,
        clientId: clientId || null,
      });
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Projet mis à jour");
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-md border p-4 md:grid-cols-[minmax(0,1fr)_minmax(220px,280px)_auto]">
      <div className="space-y-2">
        <Label htmlFor="settings-project-name">Nom du projet</Label>
        <Input
          id="settings-project-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="settings-project-client">Client</Label>
        <Select value={clientId} onValueChange={(value) => value && setClientId(value)}>
          <SelectTrigger id="settings-project-client" className="w-full">
            <span className="truncate">
              {selectedClient?.name ?? "Client à assigner"}
            </span>
          </SelectTrigger>
          <SelectContent>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-end">
        <Button type="submit" disabled={pending || clients.length === 0}>
          <Save className="size-4" />
          Enregistrer
        </Button>
      </div>
    </form>
  );
}
