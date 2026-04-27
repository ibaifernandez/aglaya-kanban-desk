const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM   = process.env.SMTP_FROM ?? `AGLAYA Kanban Desk <${process.env.SMTP_USER}>`;

async function sendEmail({ to, subject, html }) {
  const { data, error } = await resend.emails.send({ from: FROM, to, subject, html });
  if (error) throw new Error(error.message);
  return { messageId: data.id };
}

module.exports = { sendEmail };
