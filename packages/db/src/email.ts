import nodemailer from "nodemailer";

export function emailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

/** Server-configured SMTP only. Never log credentials or message content. */
export async function sendEmail(input: { to: string; subject: string; text: string; messageId?: string }) {
  if (!emailConfigured()) throw new Error("email_not_configured");
  const port = Number(process.env.SMTP_PORT ?? 587);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: process.env.NODE_ENV === "production",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    disableFileAccess: true,
    disableUrlAccess: true,
    logger: false,
    debug: false,
  });
  try {
    await transport.sendMail({ from: process.env.SMTP_FROM, ...input });
  } finally {
    transport.close();
  }
}
