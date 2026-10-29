// Notification fan-out. Email works today; SMS/WhatsApp (MSG91) plugs in here
// later without touching call sites. Nothing here throws: a failed
// notification must never fail the action that triggered it.

import { send, TEAM_EMAIL } from "../email";
import * as t from "./templates";

export const notifyOperatorVerifyCode = (email: string, name: string | null, otp: string) => send({ to: email, ...t.operatorVerifyEmail(name, otp) });
export const notifyOperatorResetCode = (email: string, name: string | null, otp: string) => send({ to: email, ...t.operatorResetEmail(name, otp) });
export const notifyOperatorPending = (email: string, name: string | null, companyName: string) => send({ to: email, ...t.operatorPendingEmail(name, companyName) });
export const notifyOperatorApproved = (email: string, name: string | null, companyName: string) => send({ to: email, ...t.operatorApprovedEmail(name, companyName) });
export const notifyOperatorRejected = (email: string, name: string | null, companyName: string, reason: string | null) => send({ to: email, ...t.operatorRejectedEmail(name, companyName, reason) });
export const notifyOperatorSuspended = (email: string, name: string | null, companyName: string, reason: string | null) => send({ to: email, ...t.operatorSuspendedEmail(name, companyName, reason) });
export const notifyAdminNewOperator = (d: Parameters<typeof t.adminNewOperatorEmail>[0]) => send({ to: TEAM_EMAIL, ...t.adminNewOperatorEmail(d) });
export const notifyListingDecision = (email: string, d: Parameters<typeof t.listingDecisionEmail>[0]) => send({ to: email, ...t.listingDecisionEmail(d) });
export const notifyPaymentDetailsChanged = (email: string, d: Parameters<typeof t.paymentDetailsChangedEmail>[0]) => send({ to: email, ...t.paymentDetailsChangedEmail(d) });
