"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { upsertProfileAction } from "@/actions/profile";
import type { Profile } from "@/db/schema";
import {
  resolveTodoPromptTemplate,
  TODO_PROMPT_PLACEHOLDERS,
} from "@/lib/todo";

export function SettingsForm({
  initial,
  userEmail,
}: {
  initial: Profile | null;
  userEmail: string;
}) {
  const [state, formAction, pending] = useActionState(
    upsertProfileAction,
    null,
  );
  return (
    <form action={formAction} className="space-y-6">
      <section className="space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground">Identité</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="business_name">Nom commercial / Prénom Nom *</Label>
            <Input
              id="business_name"
              name="business_name"
              defaultValue={initial?.businessName ?? ""}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="siret">SIRET *</Label>
            <Input
              id="siret"
              name="siret"
              defaultValue={initial?.siret ?? ""}
              placeholder="14 chiffres"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={initial?.email ?? userEmail}
              required
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="address">Adresse complète *</Label>
            <Textarea
              id="address"
              name="address"
              defaultValue={initial?.address ?? ""}
              rows={3}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Téléphone</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={initial?.phone ?? ""}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground">
          Paiement & banque
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="iban">IBAN</Label>
            <Input
              id="iban"
              name="iban"
              defaultValue={initial?.iban ?? ""}
              placeholder="FR76…"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bic">BIC</Label>
            <Input id="bic" name="bic" defaultValue={initial?.bic ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="default_payment_terms_days">
              Délai de règlement (jours) *
            </Label>
            <Input
              id="default_payment_terms_days"
              name="default_payment_terms_days"
              type="number"
              min={0}
              max={365}
              defaultValue={initial?.defaultPaymentTermsDays ?? 30}
              required
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground">
          Statut & mentions légales
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="plafond_type">Activité (plafond) *</Label>
            <Select
              name="plafond_type"
              defaultValue={initial?.plafondType ?? "BNC"}
            >
              <SelectTrigger id="plafond_type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BNC">
                  BNC — Prestations de services (77 700 €)
                </SelectItem>
                <SelectItem value="BIC">
                  BIC — Vente de marchandises (188 700 €)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 pt-7">
            <Checkbox
              id="rcs_exempt"
              name="rcs_exempt"
              defaultChecked={initial?.rcsExempt ?? true}
            />
            <Label htmlFor="rcs_exempt" className="font-normal">
              Dispensé d&apos;immatriculation au RCS et au RM
            </Label>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="legal_mention_extra">Mention légale custom</Label>
            <Textarea
              id="legal_mention_extra"
              name="legal_mention_extra"
              defaultValue={initial?.legalMentionExtra ?? ""}
              rows={2}
              placeholder="Ex: Assurance RC pro souscrite chez …"
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground">
          Prompt d&apos;implémentation (To-do)
        </h2>
        <div className="space-y-2">
          <Label htmlFor="todo_prompt_template">
            Modèle de prompt copié depuis une tâche
          </Label>
          <Textarea
            id="todo_prompt_template"
            name="todo_prompt_template"
            defaultValue={resolveTodoPromptTemplate(initial?.todoPromptTemplate)}
            rows={14}
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            Variables disponibles :{" "}
            {TODO_PROMPT_PLACEHOLDERS.map((placeholder, index) => (
              <span key={placeholder.token}>
                {index > 0 && ", "}
                <code className="rounded bg-muted px-1 py-0.5">
                  {placeholder.token}
                </code>{" "}
                ({placeholder.label})
              </span>
            ))}
            . Laisse vide pour revenir au modèle par défaut.
          </p>
        </div>
      </section>

      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      {state?.success && (
        <p className="text-sm text-emerald-600">{state.success}</p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </form>
  );
}
