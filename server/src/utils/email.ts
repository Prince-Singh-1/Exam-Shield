import nodemailer from 'nodemailer';

// In a real app, you'd use credentials from process.env
// For development, we'll log the email to the console if SMTP is not configured
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '1025', 10),
  auth: process.env.SMTP_USER ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  } : undefined,
});

export async function sendOtpEmail(to: string, otp: string) {
  const mailOptions = {
    from: '"Exam Shield" <noreply@examshield.local>',
    to,
    subject: 'Your Login OTP - Exam Shield',
    text: `Your One-Time Password (OTP) for login is: ${otp}. It will expire in 5 minutes.`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Exam Shield Login Verification</h2>
        <p>Your One-Time Password (OTP) is:</p>
        <h1 style="color: #d13076; font-size: 32px;">${otp}</h1>
        <p>It will expire in 5 minutes.</p>
        <p>If you didn't request this, you can ignore this email.</p>
      </div>
    `,
  };

  try {
    if (process.env.NODE_ENV === 'development' && !process.env.SMTP_HOST) {
      console.log('\n--- MOCK EMAIL ---');
      console.log(`To: ${to}`);
      console.log(`Subject: ${mailOptions.subject}`);
      console.log(`OTP: ${otp}`);
      console.log('------------------\n');
      return;
    }
    await transporter.sendMail(mailOptions);
    console.log(`OTP email sent to ${to}`);
  } catch (error) {
    console.error('Error sending OTP email:', error);
    // Even if email fails (e.g. no smtp running), we shouldn't crash the server.
    // For local dev, we might still want to see the OTP in console to be able to login
    console.log(`[Fallback] OTP for ${to} is: ${otp}`);
  }
}
