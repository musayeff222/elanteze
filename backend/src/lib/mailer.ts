import nodemailer from "nodemailer";
import { config } from "../config";
import { MailTemplate } from "../emails/templates";

export async function sendMail(to: string, template: MailTemplate) {
  if (!config.smtp.host) {
    console.info(`[poçt] ${to} | ${template.subject}\n${template.text}`);
    return { delivered: false, logged: true };
  }

  const transport = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  });

  await transport.sendMail({
    from: config.smtp.from,
    to,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });
  return { delivered: true, logged: false };
}
