import { z } from "zod";
import { adminRoute, json, parseBody, parseId } from "@/lib/api";
import { saveVerification } from "@/lib/operators/admin";
import { isoDate, optionalText, optionalUrl } from "@/lib/validation/common";

const schema = z.object({
  businessType: optionalText(80),
  tradeLicenceNo: optionalText(80),
  address: optionalText(300),
  mapsUrl: optionalUrl,
  phoneVerified: z.boolean(),
  visited: z.boolean(),
  documentsNote: optionalText(1000),
  adminNotes: optionalText(2000),
  drivingLicenceNumber: optionalText(40),
  drivingLicenceExpiry: isoDate.nullish(),
});

export const PUT = adminRoute<{ id: string }>(async (req, { id }) => {
  await saveVerification(parseId(id), await parseBody(req, schema));
  return json({ ok: true });
});
