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

function getGmailConfig() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    return null;
  }

  return { user, pass };
}

export function isGmailEmailConfigured() {
  return Boolean(getGmailConfig());
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
  const config = getGmailConfig();
  if (!config) {
    return {
      error:
        "Envoi email non configuré. Ajoute GMAIL_USER et GMAIL_APP_PASSWORD.",
    };
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  await transporter.sendMail({
    from: `"${fromName}" <${config.user}>`,
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
  const config = getGmailConfig();
  if (!config) {
    return {
      error:
        "Envoi email non configuré. Ajoute GMAIL_USER et GMAIL_APP_PASSWORD.",
    };
  }
  if (entries.length === 0) return { success: true };

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
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
    from: `"${fromName}" <${config.user}>`,
    to,
    replyTo,
    subject,
    text: lines.join("\n"),
  });

  return { success: true };
}
