import dotenv from 'dotenv';
dotenv.config();

import nodemailer from 'nodemailer';
import { Resend } from 'resend';

// EMAIL_PROVIDER=gmail | resend  (default: gmail)
const PROVIDER = (process.env.EMAIL_PROVIDER || 'gmail').toLowerCase();

// ── Gmail (nodemailer) ────────────────────────────────────────────────────────
let transporter = null;

if (PROVIDER === 'gmail') {
    console.log('[emailService] Provider: Gmail SMTP');
    console.log('[emailService] EMAIL_USER set:', !!process.env.EMAIL_USER);
    console.log('[emailService] EMAIL_PASS set:', !!process.env.EMAIL_PASS);

    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    transporter.verify((error) => {
        if (error) {
            console.error('❌ Email service error:', error.message);
        } else {
            console.log('✅ Email service is ready (Gmail)');
        }
    });
}

// ── Resend ────────────────────────────────────────────────────────────────────
let resend = null;

if (PROVIDER === 'resend') {
    console.log('[emailService] Provider: Resend');
    console.log('[emailService] RESEND_API_KEY set:', !!process.env.RESEND_API_KEY);
    resend = new Resend(process.env.RESEND_API_KEY);
}

// ── from address ──────────────────────────────────────────────────────────────
const fromAddress = (name) => {
    const appName = name || process.env.APP_NAME || 'Your App';
    if (PROVIDER === 'resend') {
        // Use EMAIL_FROM for Resend (must be a verified domain, e.g. noreply@yourdomain.com)
        // Falls back to Resend's sandbox sender for testing
        return `"${appName}" <${process.env.EMAIL_FROM || 'onboarding@resend.dev'}>`;
    }
    return `"${appName}" <${process.env.EMAIL_USER}>`;
};

// ── internal send helper ──────────────────────────────────────────────────────
const sendMail = async ({ to, subject, html, fromName }) => {
    if (PROVIDER === 'resend') {
        const { error } = await resend.emails.send({
            from: fromAddress(fromName),
            to,
            subject,
            html
        });
        if (error) throw new Error(error.message);
    } else {
        await transporter.sendMail({ from: fromAddress(fromName), to, subject, html });
    }
};

// ── Exports ───────────────────────────────────────────────────────────────────

export const sendVerificationEmail = async (email, code) => {
    try {
        await sendMail({
            to: email,
            subject: 'Verify Your Email Address',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
                        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 5px 5px; }
                        .code { background: #4F46E5; color: white; font-size: 32px; font-weight: bold; padding: 15px; text-align: center; letter-spacing: 5px; border-radius: 5px; margin: 20px 0; }
                        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #6b7280; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>Email Verification</h1>
                        </div>
                        <div class="content">
                            <p>Hello!</p>
                            <p>Thank you for registering. Please use the following verification code to verify your email address:</p>
                            <div class="code">${code}</div>
                            <p>This code will expire in 24 hours.</p>
                            <p>If you didn't request this verification, please ignore this email.</p>
                        </div>
                        <div class="footer">
                            <p>© ${new Date().getFullYear()} ${process.env.APP_NAME || 'Your App'}. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        });
        console.log('✅ Verification email sent to:', email);
        return { success: true };
    } catch (error) {
        console.error('❌ Error sending verification email:', error);
        throw error;
    }
};

export const sendPasswordResetEmail = async (email, token) => {
    try {
        const resetUrl = `${process.env.FRONTEND_URL}/auth/reset-password/${token}`;

        await sendMail({
            to: email,
            subject: 'Reset Your Password',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: #DC2626; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
                        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 5px 5px; }
                        .button { display: inline-block; background: #DC2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #6b7280; }
                        .warning { background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 10px; margin: 15px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>Password Reset Request</h1>
                        </div>
                        <div class="content">
                            <p>Hello!</p>
                            <p>You requested to reset your password. Click the button below to reset it:</p>
                            <div style="text-align: center;">
                                <a href="${resetUrl}" class="button">Reset Password</a>
                            </div>
                            <p>Or copy and paste this link into your browser:</p>
                            <p style="word-break: break-all; color: #4F46E5;">${resetUrl}</p>
                            <div class="warning">
                                <strong>⚠️ Security Note:</strong> This link will expire in 1 hour.
                            </div>
                            <p>If you didn't request this password reset, please ignore this email and your password will remain unchanged.</p>
                        </div>
                        <div class="footer">
                            <p>© ${new Date().getFullYear()} ${process.env.APP_NAME || 'Your App'}. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        });
        console.log('✅ Password reset email sent to:', email);
        return { success: true };
    } catch (error) {
        console.error('❌ Error sending password reset email:', error);
        throw error;
    }
};

export const sendWelcomeEmail = async (email, name) => {
    try {
        await sendMail({
            to: email,
            subject: `Welcome to ${process.env.APP_NAME || 'Our Platform'}!`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: #10B981; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
                        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 5px 5px; }
                        .button { display: inline-block; background: #10B981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #6b7280; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>Welcome Aboard!</h1>
                        </div>
                        <div class="content">
                            <p>Hello ${name}!</p>
                            <p>Welcome to ${process.env.APP_NAME || 'our platform'}! We're excited to have you here.</p>
                            <p>Your account has been successfully created and verified. You can now enjoy all the features we have to offer.</p>
                            <div style="text-align: center;">
                                <a href="${process.env.FRONTEND_URL}/dashboard" class="button">Get Started</a>
                            </div>
                            <p>If you have any questions, feel free to reach out to our support team.</p>
                        </div>
                        <div class="footer">
                            <p>© ${new Date().getFullYear()} ${process.env.APP_NAME || 'Your App'}. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        });
        console.log('✅ Welcome email sent to:', email);
        return { success: true };
    } catch (error) {
        console.error('❌ Error sending welcome email:', error);
        throw error;
    }
};

export const sendContactNotificationEmail = async ({ name, email, topic, message }) => {
    const adminEmail = process.env.CONTACT_NOTIFY_EMAIL || process.env.EMAIL_USER;
    if (!adminEmail) return;
    try {
        await sendMail({
            to: adminEmail,
            subject: `[Contact] ${topic} — from ${name}`,
            html: `
                <!DOCTYPE html><html><head><style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #C09A3A; color: white; padding: 16px 20px; border-radius: 5px 5px 0 0; }
                .content { background: #f9fafb; padding: 24px; border-radius: 0 0 5px 5px; }
                .row { margin-bottom: 10px; }
                .label { font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: #6b7280; }
                .value { margin-top: 2px; font-size: 14px; color: #111; }
                .msg-box { background: white; border-left: 3px solid #C09A3A; padding: 12px 16px; border-radius: 0 4px 4px 0; margin-top: 16px; white-space: pre-wrap; font-size: 14px; }
                .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #6b7280; }
                </style></head><body>
                <div class="container">
                    <div class="header"><h2 style="margin:0">New Contact Message</h2></div>
                    <div class="content">
                        <div class="row"><div class="label">Name</div><div class="value">${name}</div></div>
                        <div class="row"><div class="label">Email</div><div class="value">${email}</div></div>
                        <div class="row"><div class="label">Topic</div><div class="value">${topic}</div></div>
                        <div class="label">Message</div>
                        <div class="msg-box">${message}</div>
                    </div>
                    <div class="footer">© ${new Date().getFullYear()} ${process.env.APP_NAME || 'ResuCraft'}</div>
                </div>
                </body></html>
            `,
        });
        console.log('✅ Contact notification sent to admin:', adminEmail);
    } catch (err) {
        // Non-fatal — message is already saved to DB
        console.error('❌ Contact notification email failed:', err.message);
    }
};

export const sendSecurityAlertEmail = async (email, alertType, details) => {
    try {
        await sendMail({
            to: email,
            fromName: `${process.env.APP_NAME || 'Your App'} Security`,
            subject: `Security Alert: ${alertType}`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: #EF4444; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
                        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 5px 5px; }
                        .alert-box { background: #FEE2E2; border-left: 4px solid #EF4444; padding: 15px; margin: 15px 0; }
                        .details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
                        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #6b7280; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>Security Alert</h1>
                        </div>
                        <div class="content">
                            <div class="alert-box">
                                <strong>⚠️ ${alertType}</strong>
                            </div>
                            <p>We detected unusual activity on your account:</p>
                            <div class="details">
                                ${Object.entries(details).map(([key, value]) =>
                                    `<p><strong>${key}:</strong> ${value}</p>`
                                ).join('')}
                            </div>
                            <p>If this was you, you can safely ignore this email. If you don't recognize this activity, please:</p>
                            <ul>
                                <li>Change your password immediately</li>
                                <li>Review your active sessions</li>
                                <li>Enable two-factor authentication</li>
                            </ul>
                        </div>
                        <div class="footer">
                            <p>© ${new Date().getFullYear()} ${process.env.APP_NAME || 'Your App'}. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        });
        console.log('✅ Security alert email sent to:', email);
        return { success: true };
    } catch (error) {
        console.error('❌ Error sending security alert email:', error);
        throw error;
    }
};
