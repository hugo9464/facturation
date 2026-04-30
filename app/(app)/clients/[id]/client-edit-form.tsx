"use client";

import { ClientForm } from "../client-form";
import { updateClientAction } from "@/actions/clients";
import type { Client } from "@/db/schema";

export function ClientEditForm({ initial }: { initial: Client }) {
  const action = async (_prev: unknown, formData: FormData) => {
    return updateClientAction(initial.id, formData);
  };
  return (
    <ClientForm initial={initial} action={action} submitLabel="Mettre à jour" />
  );
}
