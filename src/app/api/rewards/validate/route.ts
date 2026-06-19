import { NextResponse } from "next/server";
import { findActiveByCode } from "@/lib/rewards-data";
import { REFERRAL_DISCOUNT, normalizeCode } from "@/lib/rewards";

// Live-validate a referral code from the booking form.
export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get("code");
  if (!code) return NextResponse.json({ valid: false });
  const user = await findActiveByCode(normalizeCode(code));
  if (!user) return NextResponse.json({ valid: false });
  return NextResponse.json({ valid: true, discount: REFERRAL_DISCOUNT });
}
