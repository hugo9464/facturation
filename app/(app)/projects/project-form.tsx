"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { createTodoProjectAction } from "@/actions/todo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import type { Client } from "@/db/schema";

export function ProjectForm({ clients }: { clients: Client[] }) {
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [pending, start] = useTransition();
  const selectedClient = clients.find((client) => client.id === clientId);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    start(async () => {
      const result = await createTodoProjectAction({
        name,
        clientId: clientId || null,
      });
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Projet créé");
      setName("");
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-md border p-4 md:grid-cols-[minmax(0,1fr)_minmax(220px,280px)_auto]">
      <div className="space-y-2">
        <Label htmlFor="project-name">Nom du projet</Label>
        <Input
          id="project-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ex: Refonte site vitrine"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="project-client">Client</Label>
        <Select value={clientId} onValueChange={(value) => value && setClientId(value)}>
          <SelectTrigger id="project-client" className="w-full">
            <span className="truncate">
              {selectedClient?.name ?? "Client"}
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
          <Plus className="size-4" />
          Créer
        </Button>
      </div>
    </form>
  );
}
