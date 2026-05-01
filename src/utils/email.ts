import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === 'true';

  if (!host || !user || !pass) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
  return transporter;
}

export function isEmailConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );
}

export async function sendInstructorCredentialsEmail(to: string, name: string, email: string, password: string): Promise<boolean> {
  const transport = getTransporter();
  if (!transport) return false;

  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@lms.local';
  const appName = process.env.APP_NAME || 'LMS Pro';
  const loginUrl = process.env.FRONTEND_URL || 'http://localhost:8080';

  try {
    await transport.sendMail({
      from,
      to,
      subject: `Your ${appName} Instructor Account Credentials`,
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
          <h2>Welcome to ${appName}</h2>
          <p>Hi ${name},</p>
          <p>An instructor account has been created for you. Use the credentials below to log in:</p>
          <div style="background: #f4f4f4; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 4px 0;"><strong>Password:</strong> ${password}</p>
          </div>
          <p><a href="${loginUrl}/login" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px;">Log in to ${appName}</a></p>
          <p style="color: #666; font-size: 12px;">For security, please change your password after your first login.</p>
        </div>
      `,
      text: `Welcome to ${appName}\n\nHi ${name},\n\nYour instructor account credentials:\nEmail: ${email}\nPassword: ${password}\n\nLog in at: ${loginUrl}/login\n\nPlease change your password after your first login.`,
    });
    return true;
  } catch (err) {
    console.error('Send instructor credentials email error:', err);
    return false;
  }
}

export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<boolean> {
  const transport = getTransporter();
  if (!transport) return false;

  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@lms.local';
  const appName = process.env.APP_NAME || 'LMS Pro';

  try {
    await transport.sendMail({
      from,
      to,
      subject: `Reset your ${appName} password`,
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
          <h2>Reset your password</h2>
          <p>You requested a password reset for your ${appName} account.</p>
          <p>Click the link below to set a new password (valid for 1 hour):</p>
          <p><a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px;">Reset Password</a></p>
          <p>Or copy this link: <a href="${resetLink}">${resetLink}</a></p>
          <p style="color: #666; font-size: 12px;">If you didn't request this, you can ignore this email.</p>
        </div>
      `,
      text: `Reset your ${appName} password: ${resetLink}\n\nIf you didn't request this, you can ignore this email.`,
    });
    return true;
  } catch (err) {
    console.error('Send email error:', err);
    return false;
  }
}
