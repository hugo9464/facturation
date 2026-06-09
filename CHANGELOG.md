# Changelog

## [0.4.6] - 2026-06-09

### Fixes
- fix: compatibilité Vercel avec les environnements Supabase qui utilisent encore `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## [0.4.5] - 2026-06-09

### Features
- feat: nouveau prompt par défaut pour les tâches todo, orienté test local dans le Browser Codex et données Morimont 72
- feat: remplacement automatique de l'ancien prompt todo intégré par le nouveau prompt par défaut, tout en conservant les prompts personnalisés
- feat: détails du scan manuel Collective.work avec offres scannées, offres analysées, scores et signaux de matching

### Fixes
- fix: meilleure gestion des erreurs du scan Collective.work côté client et serveur
- fix: affichage du verdict final des offres Collective.work après seuil de matching

## [0.4.4] - 2026-06-05

### Fixes
- fix: changement inline de difficulté sans réordonner les tâches, avec bouton d'avancement déplacé à côté de la difficulté

## [0.4.3] - 2026-06-05

### Features
- feat: difficulté des tâches affichée en début de ligne et modifiable inline sans ouvrir le détail

## [0.4.2] - 2026-06-05

### Features
- feat: niveau de difficulté sur les tâches de projet, avec choix `Rapide` / `Complexe`, badge inline coloré et contexte transmis à Hermes

### Database
- migration 20260604120000: enum `todo_difficulty` et colonne `difficulty` sur `todo_task`

## [0.4.1] - 2026-05-20

### Features
- feat: espace prospection enrichi avec onglets de suivi, bibliothèque de CV sources, génération de CV adapté par IA et export PDF

### Database
- migration 20260520110000: table `prospection_entry` pour le suivi des opportunités
- migration 20260520192830: tables `prospection_resume` et `prospection_cv_generation` pour les CV sources et versions générées

## [0.4.0] - 2026-05-14

### Features
- feat: suivi de la date de fin des tâches todo — `completedAt` posé automatiquement au passage en « À valider » / « Terminé », conservé tant que la tâche y reste, effacé si elle revient en amont ; affichage de la date sur la ligne de tâche et dans la modale

### Database
- migration 20260514120000: colonne `completed_at` sur `todo_task`

### Chore
- chore: ajout des dépendances `pg` / `@types/pg`
- chore: ignore `.claude/worktrees/` et `.lanes/` (outillage local)

## [0.3.0] - 2026-05-14

### Features
- feat: liens de déploiement sur les tâches todo — le prompt copié demande d'ouvrir une PR et d'enregistrer le lien de preview Vercel ; route API `POST /api/todo/tasks/[id]/preview` (auth par jeton HMAC par tâche) ; les liens PR/preview s'affichent en boutons sur la tâche
- feat: résumé IA des tâches d'un projet via Haiku, limité aux tâches « À valider »
- feat: dark mode en gris foncé avec primary indigo

### Refactor
- refactor: migration des clients Supabase vers les clés publishable/secret (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`)

### Database
- migration 20260514000000: colonnes `preview_url` / `pr_url` sur `todo_task` (appliquée via Supabase CLI)

## [0.2.1] - 2026-05-14

### Chore
- chore: ajout de `.worktreeinclude` pour copier `.env.local` dans les worktrees créés par Claude Code

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
