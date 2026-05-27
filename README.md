This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Preview login pour les tâches Todo

Les liens de preview enregistrés par les callbacks Todo peuvent pointer vers une route d'auto-login uniquement active sur les déploiements Vercel Preview :

`/api/dev/preview-login?token=...&next=/page-a-tester`

Variables d'environnement à configurer sur Vercel, scope Preview :

- `PREVIEW_LOGIN_SECRET` : secret long et aléatoire ajouté au lien généré.
- `PREVIEW_LOGIN_EMAIL` : email du compte Supabase de test.
- `PREVIEW_LOGIN_PASSWORD` : mot de passe du compte Supabase de test.

Optionnel mais recommandé si les previews Vercel sont protégées : activer Protection Bypass for Automation dans Vercel. Si `VERCEL_AUTOMATION_BYPASS_SECRET` est disponible, les liens générés incluent aussi `x-vercel-protection-bypass` et `x-vercel-set-bypass-cookie=true` pour éviter l'écran de login Vercel.

La route refuse de fonctionner hors `VERCEL_ENV=preview`, même si le secret est connu.

## Prospection Collective.work

Un cron Vercel appelle `/api/prospection/collective-work/cron` toutes les heures pour importer les nouvelles missions Collective.work qui correspondent aux CV de prospection enregistrés.

Variables d'environnement :

- `CRON_SECRET` : secret utilisé par Vercel Cron dans l'en-tête `Authorization: Bearer ...`.
- `OPENAI_API_KEY` : active le matching IA. Sans clé, un fallback par mots-clés est utilisé.
- `GMAIL_USER` et `GMAIL_APP_PASSWORD` : envoi du digest email des nouvelles missions.
- `COLLECTIVE_WORK_SCAN_PAGES` : nombre de pages Collective.work à scanner, 3 par défaut.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
