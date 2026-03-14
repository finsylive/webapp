import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_APP_PASSWORD,
  },
});

export async function sendCofounderInviteEmail({
  toEmail,
  startupName,
  inviterName,
}: {
  toEmail: string;
  startupName: string;
  inviterName: string;
}): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.ments.app';

  await transporter.sendMail({
    from: `Ments <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: `You've been added as a co-founder of ${startupName}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#fff;">
        <h2 style="font-size:22px;font-weight:700;color:#0f172a;margin-bottom:8px;">
          You're invited to co-found ${startupName}
        </h2>
        <p style="color:#475569;font-size:15px;line-height:1.6;margin-bottom:24px;">
          <strong>${inviterName}</strong> has added you as a co-founder of
          <strong>${startupName}</strong> on Ments.
          Create your account to confirm your role.
        </p>
        <a href="${appUrl}"
           style="display:inline-block;padding:12px 28px;background:#6d28d9;color:#fff;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;">
          Join Ments
        </a>
        <p style="color:#94a3b8;font-size:13px;margin-top:32px;">
          If you weren't expecting this, you can ignore this email.
        </p>
      </div>
    `,
  });
}
