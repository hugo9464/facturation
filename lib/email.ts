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
  const subject =
    entries.length === 1
      ? "Nouvelle opportunité authentifiée"
      : `${entries.length} nouvelles opportunités authentifiées`;
  const lines = [
    subject,
    "",
    "Voici la liste des nouvelles opportunités ajoutées dans l'onglet Offres d'emploi :",
    "",
    ...entries.flatMap((entry, index) => [
      `${index + 1}. ${entry.title}`,
      entry.company ? `Entreprise: ${entry.company}` : null,
      entry.location ? `Lieu: ${entry.location}` : null,
      entry.contractType ? `Contrat: ${entry.contractType}` : null,
      entry.salary ? `Rémunération: ${entry.salary}` : null,
      `Score: ${entry.matchScore}`,
      entry.matchedKeywords.length > 0
        ? `Mots-clés: ${entry.matchedKeywords.join(", ")}`
        : null,
      `Source: ${entry.source}`,
      `Lien: ${entry.sourceUrl}`,
      "",
    ]),
    "Ces opportunités ont été authentifiées par l'agent Facturation et stockées dans l'app.",
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
