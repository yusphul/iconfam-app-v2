import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type {
  Case,
  CaseRecommendation,
  DocumentRow,
  Milestone,
  Report,
  ReportStatusFlag,
  RecommendationVerdict,
} from "@/lib/types";
import {
  CASE_STATUS_LABELS,
  CASE_TYPE_LABELS,
  MILESTONE_STATUS_LABELS,
  REPORT_FLAG_LABELS,
  VERDICT_LABELS,
} from "@/lib/types";

// The client-facing case report as a standard, printable PDF.
//
// It is built entirely from what the signed-in client can already see on the
// case page (the database only returns approved-and-shared reports/documents
// and the published recommendation), so the PDF can never contain more than
// the screen does. Staff are shown by role ("Lawyer", "Field agent"), never by
// name.
//
// Layout, in the order a reader expects: cover block with reference and date,
// case details, iConfam's recommendation, a one-glance steps table, detailed
// findings per step (with photo evidence), supporting documents, and an
// important-notice paragraph. Every page carries a reference + page number.

type RGB = [number, number, number];

const M = 18; // page margin, mm
const NAVY: RGB = [16, 24, 40];
const STAMP: RGB = [232, 98, 44];
const GREY: RGB = [100, 116, 139];
const LIGHT: RGB = [228, 233, 239];
const GREEN: RGB = [5, 150, 105];
const AMBER: RGB = [217, 119, 6];
const RED: RGB = [220, 38, 38];

const VERDICT_RGB: Record<RecommendationVerdict, RGB> = {
  proceed: GREEN,
  proceed_with_caution: AMBER,
  do_not_proceed: RED,
  inconclusive: GREY,
};
const FLAG_RGB: Record<ReportStatusFlag, RGB> = {
  confirmed_good: GREEN,
  confirmed_issue: RED,
  unable_to_verify: AMBER,
  escalation_needed: RED,
};
const MILESTONE_RGB: Record<string, RGB> = {
  pending: GREY,
  in_progress: [37, 99, 235],
  confirmed: GREEN,
  issue_found: RED,
};

export interface PdfImage {
  dataUrl: string;
  /** natural pixel size, used only for the aspect ratio */
  width: number;
  height: number;
  format: "JPEG" | "PNG";
}

export interface CaseReportInput {
  caseRow: Case;
  clientName: string;
  milestones: Milestone[];
  reports: Report[];
  documents: DocumentRow[];
  recommendation: CaseRecommendation | null;
  /** Photos per report id. Optional: the PDF is complete without them. */
  images?: Record<string, PdfImage[]>;
  /** Photos that exist but were not embedded (cap, failed download, video). */
  omittedMedia?: Record<string, number>;
  generatedAt?: Date;
}

export function caseReference(caseId: string): string {
  return `IC-${caseId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export function caseReportFilename(caseId: string): string {
  return `iConfam-Report-${caseReference(caseId)}.pdf`;
}

// jsPDF's built-in fonts only cover Western European text (WinAnsi). Names and
// notes with other characters (Yoruba tone marks, emoji, ...) would come out as
// garbage, so fold accents down to their base letter and replace the rest.
const WINANSI_EXTRA = new Set([..."€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ"]);
export function pdfSafe(input: string | null | undefined): string {
  if (!input) return "";
  let out = "";
  for (const ch of input.normalize("NFC")) {
    const code = ch.codePointAt(0)!;
    if (code === 10) {
      out += ch;
    } else if (code === 9) {
      out += " ";
    } else if (code < 32 || (code >= 0x7f && code < 0xa0)) {
      continue; // control characters
    } else if (code <= 0xff || WINANSI_EXTRA.has(ch)) {
      out += ch;
    } else {
      const base = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
      out += base && base.codePointAt(0)! <= 0xff ? base : "?";
    }
  }
  return out;
}

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function buildCaseReportPdf(input: CaseReportInput): jsPDF {
  const { caseRow, milestones, documents, recommendation } = input;
  const images = input.images ?? {};
  const omitted = input.omittedMedia ?? {};
  const generatedAt = input.generatedAt ?? new Date();
  const ref = caseReference(caseRow.id);

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const CW = PW - M * 2;
  const BOTTOM = PH - 20; // leave room for the footer
  const TOP = 26; // continuation pages start below the running header

  doc.setProperties({
    title: `iConfam verification report ${ref}`,
    subject: pdfSafe(caseRow.title),
    author: "iConfam",
    creator: "iConfam",
  });

  let y = 0;

  const setText = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const font = (style: "normal" | "bold", size: number) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
  };
  const newPage = () => {
    doc.addPage();
    y = TOP;
  };
  const ensureSpace = (h: number) => {
    if (y + h > BOTTOM) newPage();
  };
  const lastTableY = () =>
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;

  // minAfter = how much room the content right after the heading needs, so a
  // heading (or a table header) is never left stranded at the bottom of a page.
  const sectionHeading = (title: string, minAfter = 24) => {
    ensureSpace(minAfter);
    y += 4;
    font("bold", 9);
    setText(STAMP);
    doc.text(title.toUpperCase(), M, y);
    doc.setDrawColor(...LIGHT);
    doc.setLineWidth(0.4);
    doc.line(M, y + 2, PW - M, y + 2);
    y += 8;
  };

  // ---- Cover band -------------------------------------------------------
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PW, 30, "F");
  doc.setFillColor(...STAMP);
  doc.rect(0, 30, PW, 1.2, "F");
  font("bold", 20);
  doc.setTextColor(255, 255, 255);
  doc.text("iConfam", M, 15);
  font("normal", 9);
  doc.setTextColor(200, 210, 222);
  doc.text("Independent verification before your money moves", M, 21.5);
  font("bold", 11);
  doc.setTextColor(255, 255, 255);
  doc.text("VERIFICATION REPORT", PW - M, 14, { align: "right" });
  font("normal", 9);
  doc.setTextColor(200, 210, 222);
  doc.text(ref, PW - M, 20.5, { align: "right" });

  y = 44;
  font("bold", 17);
  setText(NAVY);
  const titleLines = doc.splitTextToSize(pdfSafe(caseRow.title), CW) as string[];
  doc.text(titleLines, M, y);
  y += titleLines.length * 7.2;
  font("normal", 10);
  setText(GREY);
  const subtitle = [
    CASE_TYPE_LABELS[caseRow.case_type],
    caseRow.location_description ? pdfSafe(caseRow.location_description) : null,
  ]
    .filter(Boolean)
    .join("  ·  ");
  const subLines = doc.splitTextToSize(subtitle, CW) as string[];
  doc.text(subLines, M, y);
  y += subLines.length * 5 + 3;

  // ---- Case details -------------------------------------------------------
  const confirmed = milestones.filter((m) => m.status === "confirmed").length;
  const flagged = input.reports.filter(
    (r) => r.status_flag === "confirmed_issue" || r.status_flag === "escalation_needed"
  ).length;
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, top: TOP },
    theme: "plain",
    styles: { font: "helvetica", fontSize: 9.5, cellPadding: { top: 1.6, bottom: 1.6, left: 0, right: 3 } },
    columnStyles: {
      0: { cellWidth: 46, textColor: GREY },
      1: { textColor: NAVY, fontStyle: "bold" },
    },
    body: [
      ["Report reference", ref],
      ["Date issued", formatDate(generatedAt)],
      ["Prepared for", pdfSafe(input.clientName) || "—"],
      ["Case status", CASE_STATUS_LABELS[caseRow.status]],
      ["Case opened", formatDate(caseRow.created_at)],
      [
        "Verification progress",
        milestones.length
          ? `${confirmed} of ${milestones.length} step${milestones.length === 1 ? "" : "s"} confirmed`
          : "No steps defined yet",
      ],
      ["Findings flagged", flagged === 0 ? "None" : `${flagged} issue${flagged === 1 ? "" : "s"} flagged`],
    ],
  });
  y = lastTableY() + 4;

  // ---- Recommendation -----------------------------------------------------
  sectionHeading("Our recommendation");
  if (recommendation && recommendation.published) {
    const tone = VERDICT_RGB[recommendation.verdict];
    type Row = { text: string; style: "label" | "verdict" | "head" | "body" };
    const rows: Row[] = [
      { text: "VERDICT", style: "label" },
      { text: VERDICT_LABELS[recommendation.verdict], style: "verdict" },
    ];
    font("normal", 10);
    const inner = CW - 10;
    rows.push({ text: "SUMMARY", style: "label" });
    for (const l of doc.splitTextToSize(pdfSafe(recommendation.summary), inner) as string[]) {
      rows.push({ text: l, style: "body" });
    }
    if (recommendation.next_steps?.trim()) {
      rows.push({ text: "RECOMMENDED NEXT STEPS", style: "label" });
      for (const l of doc.splitTextToSize(pdfSafe(recommendation.next_steps), inner) as string[]) {
        rows.push({ text: l, style: "body" });
      }
    }
    const heightOf = (r: Row) =>
      r.style === "verdict" ? 8 : r.style === "label" ? 7.4 : 4.9;

    // Draw in chunks so a long recommendation can flow across pages with its
    // coloured bar and tint intact on each.
    let i = 0;
    while (i < rows.length) {
      ensureSpace(24);
      let h = 4;
      let j = i;
      while (j < rows.length && y + h + heightOf(rows[j]) <= BOTTOM - 2) {
        h += heightOf(rows[j]);
        j++;
      }
      if (j === i) {
        newPage();
        continue;
      }
      h += 3;
      doc.setFillColor(tone[0], tone[1], tone[2]);
      doc.setGState(new (doc as unknown as { GState: new (o: object) => object }).GState({ opacity: 0.08 }));
      doc.rect(M, y, CW, h, "F");
      doc.setGState(new (doc as unknown as { GState: new (o: object) => object }).GState({ opacity: 1 }));
      doc.setFillColor(tone[0], tone[1], tone[2]);
      doc.rect(M, y, 1.8, h, "F");
      let ty = y + 4;
      for (let k = i; k < j; k++) {
        const r = rows[k];
        if (r.style === "label") {
          font("bold", 7.5);
          setText(GREY);
          ty += 4.8;
          doc.text(r.text, M + 6, ty);
          ty += 2.6;
        } else if (r.style === "verdict") {
          font("bold", 14);
          setText(tone);
          ty += 5.2;
          doc.text(r.text, M + 6, ty);
          ty += 2.8;
        } else {
          font("normal", 10);
          setText(NAVY);
          ty += 4.1;
          doc.text(r.text, M + 6, ty);
          ty += 0.8;
        }
      }
      y += h + 2;
      i = j;
    }
    font("normal", 8);
    setText(GREY);
    doc.text(
      `Published ${formatDate(recommendation.published_at ?? recommendation.updated_at)}`,
      M,
      y + 2
    );
    y += 6;
  } else {
    ensureSpace(18);
    doc.setFillColor(246, 248, 250);
    doc.rect(M, y, CW, 14, "F");
    doc.setFillColor(...GREY);
    doc.rect(M, y, 1.8, 14, "F");
    font("normal", 10);
    setText(GREY);
    doc.text(
      "Our recommendation will appear here once the verification steps are complete.",
      M + 6,
      y + 8.4
    );
    y += 18;
  }

  // ---- Steps at a glance ---------------------------------------------------
  const reportsByMilestone = new Map<string, Report[]>();
  for (const r of [...input.reports].sort(
    (a, b) => new Date(b.visit_time).getTime() - new Date(a.visit_time).getTime()
  )) {
    const list = reportsByMilestone.get(r.milestone_id) ?? [];
    list.push(r);
    reportsByMilestone.set(r.milestone_id, list);
  }

  sectionHeading("Verification steps at a glance", 44);
  if (milestones.length === 0) {
    font("normal", 10);
    setText(GREY);
    doc.text("No verification steps have been set up for this case yet.", M, y);
    y += 7;
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M, top: TOP },
      theme: "grid",
      styles: { font: "helvetica", fontSize: 9, cellPadding: 2.2, lineColor: LIGHT, lineWidth: 0.2, textColor: NAVY },
      headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [250, 251, 252] },
      columnStyles: { 0: { cellWidth: 10, halign: "center" }, 2: { cellWidth: 30 }, 3: { cellWidth: 42 } },
      head: [["#", "Step", "Status", "Latest finding"]],
      body: milestones.map((m, i) => {
        const latest = reportsByMilestone.get(m.id)?.[0];
        return [
          String(i + 1),
          pdfSafe(m.name),
          MILESTONE_STATUS_LABELS[m.status],
          latest ? REPORT_FLAG_LABELS[latest.status_flag] : "—",
        ];
      }),
      didParseCell: (data) => {
        if (data.section !== "body") return;
        const m = milestones[data.row.index];
        if (data.column.index === 2) {
          data.cell.styles.textColor = MILESTONE_RGB[m.status] ?? GREY;
          data.cell.styles.fontStyle = "bold";
        }
        if (data.column.index === 3) {
          const latest = reportsByMilestone.get(m.id)?.[0];
          if (latest) {
            data.cell.styles.textColor = FLAG_RGB[latest.status_flag];
            data.cell.styles.fontStyle = "bold";
          } else {
            data.cell.styles.textColor = GREY;
          }
        }
      },
    });
    y = lastTableY() + 4;
  }

  // ---- Detailed findings ---------------------------------------------------
  sectionHeading("Detailed findings", 40);
  if (milestones.length === 0) {
    font("normal", 10);
    setText(GREY);
    doc.text("Nothing to report yet.", M, y);
    y += 7;
  }
  milestones.forEach((m, idx) => {
    // The table above shows the latest finding; the detail reads in the order
    // things happened.
    const reports = [...(reportsByMilestone.get(m.id) ?? [])].reverse();
    ensureSpace(24);
    font("bold", 11);
    setText(NAVY);
    const heading = doc.splitTextToSize(`${idx + 1}. ${pdfSafe(m.name)}`, CW - 34) as string[];
    doc.text(heading, M, y);
    font("bold", 9);
    setText(MILESTONE_RGB[m.status] ?? GREY);
    doc.text(MILESTONE_STATUS_LABELS[m.status].toUpperCase(), PW - M, y, { align: "right" });
    y += heading.length * 5 + 1;

    if (reports.length === 0) {
      font("normal", 9.5);
      setText(GREY);
      doc.text(
        m.status === "confirmed"
          ? "Completed. No separate written finding was published for this step."
          : "No report has been published for this step yet.",
        M + 3,
        y + 1
      );
      y += 8;
      return;
    }

    for (const r of reports) {
      ensureSpace(18);
      font("bold", 8.5);
      setText(FLAG_RGB[r.status_flag]);
      const flagText = REPORT_FLAG_LABELS[r.status_flag].toUpperCase();
      doc.text(flagText, M + 3, y + 1);
      const flagW = doc.getTextWidth(flagText);
      font("normal", 8.5);
      setText(GREY);
      doc.text(
        `   ${formatDate(r.visit_time)}${r.author_label ? "  ·  " + pdfSafe(r.author_label) : ""}`,
        M + 3 + flagW,
        y + 1
      );
      y += 5.5;

      font("normal", 10);
      setText(NAVY);
      const lines = doc.splitTextToSize(pdfSafe(r.findings_summary), CW - 6) as string[];
      for (const line of lines) {
        ensureSpace(5);
        doc.text(line, M + 3, y);
        y += 4.9;
      }

      const pics = images[r.id] ?? [];
      if (pics.length > 0) {
        y += 1.5;
        const MAXH = 34;
        const GAP = 3;
        let x = M + 3;
        let rowH = 0;
        for (const p of pics) {
          const ratio = p.width / p.height || 1;
          let h = MAXH;
          let w = h * ratio;
          if (w > 56) {
            w = 56;
            h = w / ratio;
          }
          if (x + w > PW - M && x > M + 3) {
            y += rowH + GAP;
            x = M + 3;
            rowH = 0;
          }
          if (y + h > BOTTOM) {
            newPage();
            x = M + 3;
            rowH = 0;
          }
          doc.addImage(p.dataUrl, p.format, x, y, w, h);
          doc.setDrawColor(...LIGHT);
          doc.setLineWidth(0.3);
          doc.rect(x, y, w, h);
          x += w + GAP;
          rowH = Math.max(rowH, h);
        }
        y += rowH + 2;
      }
      const extra = omitted[r.id] ?? 0;
      if (extra > 0) {
        ensureSpace(6);
        font("normal", 8.5);
        setText(GREY);
        doc.text(
          `${extra} more photo${extra === 1 ? "" : "s"} / video${extra === 1 ? "" : "s"} available on your portal.`,
          M + 3,
          y + 1
        );
        y += 5;
      }
      y += 3;
    }
    y += 2;
  });

  // ---- Documents -----------------------------------------------------------
  sectionHeading("Supporting documents", 44);
  if (documents.length === 0) {
    font("normal", 10);
    setText(GREY);
    const lines = doc.splitTextToSize(
      "No documents were shared on this case. Wherever possible we verify directly with the issuing registry or authority rather than relying on uploaded copies.",
      CW
    ) as string[];
    doc.text(lines, M, y);
    y += lines.length * 5 + 3;
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M, top: TOP },
      theme: "grid",
      styles: { font: "helvetica", fontSize: 9, cellPadding: 2.2, lineColor: LIGHT, lineWidth: 0.2, textColor: NAVY },
      headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: "bold" },
      columnStyles: { 2: { cellWidth: 34 } },
      head: [["Document", "Provided by", "Added"]],
      body: documents.map((d) => [
        pdfSafe(d.doc_type),
        pdfSafe(d.author_label) || "—",
        formatDate(d.created_at),
      ]),
    });
    y = lastTableY() + 3;
    font("normal", 8.5);
    setText(GREY);
    doc.text("Copies are available to view on your iConfam portal.", M, y + 1);
    y += 6;
  }

  // ---- Important notice ----------------------------------------------------
  const notice =
    "This report records what iConfam's independent verification team checked and observed on the dates shown, " +
    "based on the sources and site visits described above. It is an assessment to help you make your own decision. " +
    "It is not legal, financial or investment advice, it is not a guarantee of title, ownership, value or " +
    "quality of work, and it does not replace advice from your own lawyer. Conditions can change after the date of " +
    "each finding. Please keep this report confidential.";
  font("normal", 8.5);
  const noticeLines = doc.splitTextToSize(notice, CW - 8) as string[];
  const noticeH = noticeLines.length * 4.1 + 11;
  ensureSpace(noticeH + 6);
  y += 4;
  doc.setFillColor(246, 248, 250);
  doc.rect(M, y, CW, noticeH, "F");
  font("bold", 8);
  setText(NAVY);
  doc.text("IMPORTANT NOTICE", M + 4, y + 5.5);
  font("normal", 8.5);
  setText(GREY);
  doc.text(noticeLines, M + 4, y + 10.5);
  y += noticeH;

  // ---- Running header + footer on every page ----------------------------
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    if (p > 1) {
      font("bold", 8);
      setText(NAVY);
      doc.text("iConfam", M, 12);
      font("normal", 8);
      setText(GREY);
      doc.text(`Verification report  ·  ${ref}`, PW - M, 12, { align: "right" });
      doc.setDrawColor(...LIGHT);
      doc.setLineWidth(0.3);
      doc.line(M, 15, PW - M, 15);
    }
    doc.setDrawColor(...LIGHT);
    doc.setLineWidth(0.3);
    doc.line(M, PH - 14, PW - M, PH - 14);
    font("normal", 8);
    setText(GREY);
    doc.text(`Confidential  ·  Prepared for ${pdfSafe(input.clientName) || "client"}  ·  ${ref}`, M, PH - 9);
    doc.text(`Page ${p} of ${pages}`, PW - M, PH - 9, { align: "right" });
  }

  return doc;
}

// ---- Browser-only: fetch a signed photo URL and shrink it for the PDF ------
// Photos are re-encoded as JPEG at most 900px wide so a report with many
// photos stays a reasonable size. Any failure (network, CORS, odd format)
// resolves to null and the PDF is built without that photo.
export async function loadPdfImage(url: string): Promise<PdfImage | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) return null;
    const bitmapUrl = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("image decode failed"));
        el.src = bitmapUrl;
      });
      const scale = Math.min(1, 900 / img.naturalWidth);
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      return { dataUrl: canvas.toDataURL("image/jpeg", 0.8), width: w, height: h, format: "JPEG" };
    } finally {
      URL.revokeObjectURL(bitmapUrl);
    }
  } catch {
    return null;
  }
}
