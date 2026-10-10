import { supabase } from "@/lib/supabaseClient";

export const RECEIPT_BUCKET = "iconfam-receipts";
export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;
const OK_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"];

// Phone photos are often 4-8 MB. Shrinking them keeps the upload quick on a weak
// connection while the text on the receipt stays readable. PDFs and formats the
// browser can't draw (HEIC on most desktops) go up unchanged.
async function shrinkImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.size < 700 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

export function checkReceiptFile(file: File): string | null {
  if (!OK_TYPES.includes(file.type)) return "Use a photo (JPG, PNG, HEIC) or a PDF.";
  if (file.size > RECEIPT_MAX_BYTES) return "That file is over 10 MB. Try a smaller photo or screenshot.";
  return null;
}

// Uploads to <case>/<payment>/<timestamp>.<ext> and returns the storage path.
export async function uploadReceipt(
  caseId: string,
  paymentId: string,
  file: File
): Promise<{ path: string } | { error: string }> {
  const problem = checkReceiptFile(file);
  if (problem) return { error: problem };
  const body = await shrinkImage(file);
  const ext = body.type === "image/jpeg" ? "jpg" : body.type === "application/pdf" ? "pdf" : (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "bin";
  const path = `${caseId}/${paymentId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(RECEIPT_BUCKET)
    .upload(path, body, { contentType: body.type || file.type, upsert: false });
  if (error) return { error: "We couldn't upload that file. Check your connection and try again." };
  return { path };
}
