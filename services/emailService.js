import dotenv from 'dotenv';
dotenv.config();

import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

transporter.verify((error, success) => {
    if (error) {
        console.error('❌ Email service error:', error);
    } else {
        console.log('✅ Email service is ready');
    }
});

/**
 * Send verification email
 */
export const sendVerificationEmail = async (email, code) => {
    try {
        const mailOptions = {
            from: `"${process.env.APP_NAME || 'Your App'}" <${process.env.EMAIL_USER}>`,
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
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Verification email sent:', info.messageId);
        return { success: true };
    } catch (error) {
        console.error('❌ Error sending verification email:', error);
        throw error;
    }
};

/**
 * Send password reset email
 */
export const sendPasswordResetEmail = async (email, token) => {
    try {
        const resetUrl = `${process.env.FRONTEND_URL}/auth/reset-password/${token}`;

        const mailOptions = {
            from: `"${process.env.APP_NAME || 'Your App'}" <${process.env.EMAIL_USER}>`,
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
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Password reset email sent:', info.messageId);
        return { success: true };
    } catch (error) {
        console.error('❌ Error sending password reset email:', error);
        throw error;
    }
};

/**
 * Send welcome email
 */
export const sendWelcomeEmail = async (email, name) => {
    try {
        const mailOptions = {
            from: `"${process.env.APP_NAME || 'Your App'}" <${process.env.EMAIL_USER}>`,
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
                            <h1>Welcome Aboard! 🎉</h1>
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
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Welcome email sent:', info.messageId);
        return { success: true };
    } catch (error) {
        console.error('❌ Error sending welcome email:', error);
        throw error;
    }
};

/**
 * Send security alert email
 */
export const sendSecurityAlertEmail = async (email, alertType, details) => {
    try {
        const mailOptions = {
            from: `"${process.env.APP_NAME || 'Your App'} Security" <${process.env.EMAIL_USER}>`,
            to: email,
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
                            <h1>🔒 Security Alert</h1>
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
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Security alert email sent:', info.messageId);
        return { success: true };
    } catch (error) {
        console.error('❌ Error sending security alert email:', error);
        throw error;
    }
};