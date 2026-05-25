import nodemailer from 'nodemailer';

export const sendEmail = async ({ to, subject, html }: { to: string; subject: string; html: string }) => {
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    const info = await transporter.sendMail({
        from: `"Auradime Notifications" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to,
        subject,
        html,
    });

    return info;
};