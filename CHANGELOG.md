# Changelog

## [0.2.0] - 2026-05-13

### Features
- feat: workflow centré projets (`app/(app)/projects/`) avec formulaire et page détail
- feat: envoi d'emails (factures/devis) via `lib/email.ts` + nodemailer, suivi `invoice_email_sent_at`
- feat: simplification des statuts todo (suppression des statuts secondaires)

### Refactor
- refactor: suppression complète de Drizzle ORM (drizzle-orm, drizzle-kit, drizzle.config.ts, db/index.ts, scripts SQL) au profit d'un accès direct via Supabase (`lib/supabase/db.ts`)
- refactor: refonte de `db/schema.ts` pour s'aligner sur le nouveau modèle Supabase
- refactor: ajustements UI (clients, invoices, quotes, time, todo, layout, app-shell, settings)

### Database
- migration 0006: project-centric workflow
- migration 0007: remove secondary todo statuses
- migration 0008: invoice email sent_at
