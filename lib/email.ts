import nodemailer from "nodemailer";

type SendInvoiceEmailInput = {
  to: string;
  fromName: string;
  replyTo: string;
  invoiceNumber: string;
  subject: string;
  body: string;
  pdf: Buffer;
};

type ProspectionDigestEntry = {
  title: string;
  organization: string | null;
  location: string | null;
  sourceUrl: string | null;
};

type SendProspectionDigestEmailInput = {
  to: string;
  fromName: string;
  replyTo: string;
  entries: ProspectionDigestEntry[];
};

export type JobOfferDigestEntry = {
  title: string;
  company: string | null;
  location: string | null;
  contractType: string | null;
  salary: string | null;
  description?: string | null;
  tags?: string[];
  matchScore: number;
  matchedKeywords: string[];
  source: string;
  sourceUrl: string;
};

type SendJobOfferDigestEmailInput = {
  to: string;
  fromName: string;
  replyTo: string;
  entries: JobOfferDigestEntry[];
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function compactText(value: string | null | undefined, maxLength = 220) {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}…` : text;
}

function buildOfferInsights(entry: JobOfferDigestEntry) {
  const haystack = [
    entry.title,
    entry.company,
    entry.location,
    entry.contractType,
    entry.salary,
    entry.description,
    ...(entry.tags ?? []),
    ...entry.matchedKeywords,
  ].filter(Boolean).join(" ").toLowerCase();

  const hoursMatch = haystack.match(/(?:^|\D)(\d{1,2})\s*h(?!\s*\/?\s*f)(?:eures?)?(?:\s*(?:\/|par)\s*semaine)?/i);
  const weeklyHours = hoursMatch ? `${Number(hoursMatch[1])}h/semaine` : "Horaires non précisés";
  const morning = /\b(matin|matinale?|ouverture|petit[-\s]?déjeuner|breakfast)\b/i.test(haystack);
  const weekend = /\b(week[-\s]?end|samedi|dimanche|sam\.?|dim\.?)\b/i.test(haystack);
  const evening = /\b(soir|soirée|fermeture|closing|nuit)\b/i.test(haystack);

  return {
    weeklyHours,
    morningLabel: morning ? "Matin" : "Matin non précisé",
    weekendLabel: weekend ? "Week-end" : "Week-end non précisé",
    eveningLabel: evening ? "Soir/fermeture" : "Soir non précisé",
  };
}

function compactScheduleFacts(entry: JobOfferDigestEntry) {
  const insights = buildOfferInsights(entry);
  return [insights.weeklyHours, insights.morningLabel, insights.weekendLabel, insights.eveningLabel]
    .filter((item) => !/non précisé|horaires non précisés/i.test(item));
}

function buildOfferSummary(entry: JobOfferDigestEntry) {
  const fragments = [
    entry.company ? `chez ${entry.company}` : null,
    entry.location ? `à ${entry.location}` : null,
    entry.contractType ? `en ${entry.contractType}` : null,
  ].filter(Boolean).join(" ");
  const details = compactText(entry.description, 260);
  const schedule = compactScheduleFacts(entry).slice(0, 3).join(" · ");
  return compactText(
    [
      `${entry.title}${fragments ? ` — ${fragments}` : ""}.`,
      details,
      schedule ? `À noter : ${schedule}.` : null,
    ].filter(Boolean).join(" "),
    420,
  ) ?? entry.title;
}

export function buildJobOfferDigestEmailContent(entries: JobOfferDigestEntry[]) {
  const subject = entries.length === 1
    ? "1 nouvelle offre sélectionnée pour toi"
    : `${entries.length} nouvelles offres sélectionnées pour toi`;
  const today = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date());
  const textLines = [
    subject,
    `Sélection du ${today}`,
    "",
    ...entries.flatMap((entry, index) => {
      const scheduleFacts = compactScheduleFacts(entry);
      return [
        `${index + 1}. ${entry.title}`,
        entry.company ? `Entreprise: ${entry.company}` : null,
        entry.location ? `Lieu: ${entry.location}` : null,
        entry.contractType ? `Contrat: ${entry.contractType}` : null,
        entry.salary ? `Rémunération: ${entry.salary}` : null,
        `Résumé: ${buildOfferSummary(entry)}`,
        scheduleFacts.length > 0 ? `Horaires: ${scheduleFacts.join(" · ")}` : "Horaires: non précisés",
        `Source: ${entry.source}`,
        `Lien: ${entry.sourceUrl}`,
        "",
      ];
    }),
    "Ces offres ont été authentifiées par l'agent Facturation et stockées dans l'app.",
  ].filter((line): line is string => line !== null);

  const cards = entries.map((entry, index) => {
    const summary = buildOfferSummary(entry);
    const scheduleFacts = compactScheduleFacts(entry);
    const pills = [
      entry.contractType,
      entry.location,
      entry.salary,
    ].filter(Boolean);
    const scheduleLine = scheduleFacts.length > 0 ? scheduleFacts.join(" · ") : "Horaires non précisés";
    return `
      <article style="background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;padding:18px;margin:0 0 14px 0;box-shadow:0 8px 22px rgba(15,23,42,.06);">
        <div style="display:flex;gap:12px;align-items:flex-start;justify-content:space-between;">
          <div>
            <div style="font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:#64748b;font-weight:700;margin-bottom:6px;">#${index + 1} · ${escapeHtml(entry.source)}</div>
            <h2 style="font-family:Inter,Arial,sans-serif;font-size:18px;line-height:1.25;color:#0f172a;margin:0 0 6px 0;">${escapeHtml(entry.title)}</h2>
            <p style="font-size:13px;color:#475569;margin:0;">${escapeHtml([entry.company, entry.location].filter(Boolean).join(" · ") || "Entreprise / lieu à vérifier")}</p>
          </div>
          <div style="background:#eef2ff;color:#4338ca;border-radius:999px;padding:6px 10px;font-weight:800;font-size:12px;white-space:nowrap;">${entry.matchScore}</div>
        </div>
        <div style="margin:12px 0 10px 0;">
          ${pills.map((pill) => `<span style="display:inline-block;background:#f8fafc;border:1px solid #e2e8f0;color:#334155;border-radius:999px;padding:5px 8px;font-size:12px;margin:0 4px 6px 0;">${escapeHtml(String(pill))}</span>`).join("")}
        </div>
        <div style="background:#f8fafc;border-radius:14px;padding:12px;margin:0 0 12px 0;border:1px solid #e2e8f0;">
          <div style="font-size:12px;font-weight:800;color:#0f172a;margin-bottom:4px;">Résumé</div>
          <p style="font-size:13px;line-height:1.45;color:#334155;margin:0;">${escapeHtml(summary)}</p>
        </div>
        <div style="font-size:12px;color:#64748b;margin:0 0 12px 0;">
          ${escapeHtml(scheduleLine)}
        </div>
        <a href="${escapeHtml(entry.sourceUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:12px;padding:10px 14px;font-weight:800;font-size:13px;">Voir l'offre</a>
      </article>`;
  }).join("");

  const html = `<!doctype html>
<html lang="fr">
  <body style="margin:0;background:#f1f5f9;padding:28px 12px;font-family:Inter,Arial,sans-serif;color:#0f172a;">
    <main style="max-width:760px;margin:0 auto;">
      <section style="background:linear-gradient(135deg,#172554,#2563eb);border-radius:28px;padding:30px;margin-bottom:20px;color:#ffffff;box-shadow:0 20px 50px rgba(37,99,235,.25);">
        <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;opacity:.78;font-weight:800;">Facturation · Agent offres</div>
        <h1 style="font-size:30px;line-height:1.15;margin:10px 0 8px 0;">${escapeHtml(subject)}</h1>
        <p style="font-size:16px;line-height:1.55;margin:0;opacity:.9;">Une sélection lisible comme un mini-site d'offres, avec résumé, horaires estimés et accès direct à chaque annonce.</p>
      </section>
      ${cards}
      <p style="text-align:center;color:#64748b;font-size:13px;margin:24px 0 0 0;">Offres authentifiées par l'agent Facturation · ${escapeHtml(today)}</p>
    </main>
  </body>
</html>`;

  return { subject, text: textLines.join("\n"), html };
}

function getEmailConfig() {
  const smtpHost = process.env.SMTP_HOST?.trim();
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPassword = process.env.SMTP_PASSWORD?.trim();
  const smtpFrom = process.env.SMTP_FROM?.trim() || smtpUser;

  if (smtpHost && smtpFrom) {
    const port = Number(process.env.SMTP_PORT ?? "587");
    const secure = process.env.SMTP_SECURE === "true" || port === 465;
    return {
      from: smtpFrom,
      transport: {
        host: smtpHost,
        port,
        secure,
        auth: smtpUser && smtpPassword
          ? {
              user: smtpUser,
              pass: smtpPassword,
            }
          : undefined,
      },
    };
  }

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    return null;
  }

  return {
    from: user,
    transport: {
      service: "gmail",
      auth: {
        user,
        pass,
      },
    },
  };
}

export function isGmailEmailConfigured() {
  return Boolean(getEmailConfig());
}

export async function sendInvoiceEmail({
  to,
  fromName,
  replyTo,
  invoiceNumber,
  subject,
  body,
  pdf,
}: SendInvoiceEmailInput) {
  const config = getEmailConfig();
  if (!config) {
    return {
      error:
        "Envoi email non configuré. Ajoute SMTP_HOST/SMTP_USER/SMTP_PASSWORD/SMTP_FROM ou GMAIL_USER/GMAIL_APP_PASSWORD.",
    };
  }

  const transporter = nodemailer.createTransport(config.transport);

  await transporter.sendMail({
    from: `"${fromName}" <${config.from}>`,
    to,
    replyTo,
    subject,
    text: body,
    attachments: [
      {
        filename: `${invoiceNumber}.pdf`,
        content: pdf,
        contentType: "application/pdf",
      },
    ],
  });

  return { success: true };
}

export async function sendProspectionDigestEmail({
  to,
  fromName,
  replyTo,
  entries,
}: SendProspectionDigestEmailInput) {
  const config = getEmailConfig();
  if (!config) {
    return {
      error:
        "Envoi email non configuré. Ajoute SMTP_HOST/SMTP_USER/SMTP_PASSWORD/SMTP_FROM ou GMAIL_USER/GMAIL_APP_PASSWORD.",
    };
  }
  if (entries.length === 0) return { success: true };

  const transporter = nodemailer.createTransport(config.transport);
  const subject =
    entries.length === 1
      ? "Nouvelle mission Collective.work"
      : `${entries.length} nouvelles missions Collective.work`;
  const lines = [
    subject,
    "",
    ...entries.flatMap((entry, index) => [
      `${index + 1}. ${entry.title}`,
      entry.organization ? `Organisation: ${entry.organization}` : null,
      entry.location ? `Lieu: ${entry.location}` : null,
      entry.sourceUrl ? `Lien: ${entry.sourceUrl}` : null,
      "",
    ]),
    "Ces offres ont été ajoutées dans l'onglet Prospection.",
  ].filter((line): line is string => line !== null);

  await transporter.sendMail({
    from: `"${fromName}" <${config.from}>`,
    to,
    replyTo,
    subject,
    text: lines.join("\n"),
  });

  return { success: true };
}

export async function sendJobOfferDigestEmail({
  to,
  fromName,
  replyTo,
  entries,
}: SendJobOfferDigestEmailInput) {
  const config = getEmailConfig();
  if (!config) {
    return {
      error:
        "Envoi email non configuré. Ajoute SMTP_HOST/SMTP_USER/SMTP_PASSWORD/SMTP_FROM ou GMAIL_USER/GMAIL_APP_PASSWORD.",
    };
  }
  if (entries.length === 0) return { success: true };

  const transporter = nodemailer.createTransport(config.transport);
  const content = buildJobOfferDigestEmailContent(entries);

  await transporter.sendMail({
    from: `"${fromName}" <${config.from}>`,
    to,
    replyTo,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });

  return { success: true };
}
