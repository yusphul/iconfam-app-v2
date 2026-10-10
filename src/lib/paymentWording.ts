import type { Payment } from "@/lib/types";

// When the admin asks for 100% up front there is no "deposit" in the client's eyes:
// one invoice for the whole fee, no balance. The database still calls that invoice
// kind = "deposit" (it is the one that unlocks the work), but people should read
// "payment", not "initial deposit".
export function isFullPayment(payments: Pick<Payment, "kind">[]): boolean {
  return payments.some((p) => p.kind === "deposit") && !payments.some((p) => p.kind === "balance");
}

/** The invoice name to show. Old rows were saved as "Initial deposit". */
export function invoiceLabel(p: Pick<Payment, "kind" | "description">, full: boolean): string {
  if (full && p.kind === "deposit") return "Payment in full";
  return p.description;
}
