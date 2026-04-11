import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/mail';

export async function POST(req: Request) {
    try {
        const { email, subject, message } = await req.json();

        if (!email || !subject) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        await sendEmail({
            to: email,
            subject: subject,
            html: `<div style="font-family: sans-serif; padding: 20px;">
              <h2>AuraMarket Notification</h2>
              <p>${message}</p>
            </div>`,
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}