import { NextResponse } from "next/server";
import { sendContactEmails } from "@/lib/email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ContactPayload = {
  name?: string;
  email?: string;
  phone?: string;
  subject?: string;
  message?: string;
};

export async function POST(req: Request) {
  let body: ContactPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const errors: string[] = [];
  if (!body.name?.trim()) errors.push("Name is required.");
  if (!body.email || !EMAIL_RE.test(body.email)) errors.push("A valid email is required.");
  if (!body.message?.trim()) errors.push("Please include a message.");
  if (errors.length) {
    return NextResponse.json({ error: errors.join(" ") }, { status: 422 });
  }

  await sendContactEmails({
    name: body.name!.trim(),
    email: body.email!.trim(),
    phone: body.phone?.trim() || undefined,
    subject: body.subject?.trim() || undefined,
    message: body.message!.trim(),
  });

  return NextResponse.json({ ok: true });
}
