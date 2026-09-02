import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

export const runtime = "nodejs";

interface LineItemPayload {
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  category: string;
}

interface SolutionPayload {
  id: string;
  name: string;
  solutionType: string;
  configuration: Record<string, unknown>;
  result: {
    annualLicense: number;
    hardware: number;
    professionalServices: number;
    total: number;
    lineItems: LineItemPayload[];
    notes?: string[];
  };
}

interface QuotePayload {
  client: {
    companyName: string;
    contactName: string;
    email: string;
    phone: string;
    date: string;
    validityDays: number;
    notes: string;
  };
  solutions: SolutionPayload[];
  grandTotal: number;
}

function sar(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function pct(n: number): string {
  return n > 0 ? `${Math.round(n * 100)}%` : "—";
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatDate(d: string): string {
  const date = new Date(d + "T00:00:00");
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function validUntilDate(d: string, days: number): string {
  const date = new Date(d + "T00:00:00");
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function iconForSolution(solutionType: string): string {
  const t = solutionType.toLowerCase();
  if (t.includes("erp")) return "ic-erp";
  if (t.includes("pos")) return "ic-pos";
  if (t.includes("hr") || t.includes("hcm")) return "ic-hcm";
  if (t.includes("crm") || t.includes("loyalty")) return "ic-loyalty";
  if (t.includes("reservation") || t.includes("f&b")) return "ic-fnb";
  if (t.includes("mobile") || t.includes("web") || t.includes("app")) return "ic-mobile";
  if (t.includes("integration") || t.includes("e-invoicing") || t.includes("bi")) return "ic-ipaas";
  if (t.includes("supply") || t.includes("warehouse") || t.includes("order")) return "ic-inv";
  if (t.includes("fleet") || t.includes("maintenance") || t.includes("field")) return "ic-inv";
  if (t.includes("contact")) return "ic-hcm";
  if (t.includes("work")) return "ic-erp";
  if (t.includes("ai") || t.includes("data")) return "ic-erp";
  if (t.includes("drive")) return "ic-pos";
  return "ic-erp";
}

let logoBase64Cache: string | null = null;
function getLogoBase64(): string {
  if (!logoBase64Cache) {
    const logoPath = join(process.cwd(), "public", "trustangle-logo.png");
    const buf = readFileSync(logoPath);
    logoBase64Cache = buf.toString("base64");
  }
  return logoBase64Cache;
}

export async function POST(request: Request) {
  try {
    const payload: QuotePayload = await request.json();
    const logoB64 = getLogoBase64();

    const totalLicense = payload.solutions.reduce((s, sol) => s + sol.result.annualLicense, 0);
    const totalImpl = payload.solutions.reduce(
      (s, sol) => s + sol.result.professionalServices + sol.result.hardware, 0
    );

    const solCount = payload.solutions.length;

    // 5-year cost projection
    const year1Total = payload.grandTotal;
    const yearNTotal = totalLicense;
    const fiveYearTotal = year1Total + yearNTotal * 4;
    const yearNMonthly = Math.round(yearNTotal / 12);
    const savingsPct = year1Total > 0 ? Math.round(((year1Total - yearNTotal) / year1Total) * 100) : 0;
    const maxBar = Math.max(year1Total, 1);
    const years = [
      { label: "Year 1", total: year1Total, impl: totalImpl, lic: totalLicense },
      { label: "Year 2", total: yearNTotal, impl: 0, lic: yearNTotal },
      { label: "Year 3", total: yearNTotal, impl: 0, lic: yearNTotal },
      { label: "Year 4", total: yearNTotal, impl: 0, lic: yearNTotal },
      { label: "Year 5", total: yearNTotal, impl: 0, lic: yearNTotal },
    ];

    // Build solution cards for page 1
    const solCards = payload.solutions.map((sol) => {
      const impl = sol.result.professionalServices + sol.result.hardware;
      const icon = iconForSolution(sol.solutionType);
      return `<div class="sol"><div class="sol-accent" style="background:var(--teal-deep)"></div>
        <div class="sol-top"><div class="sol-title-row"><div class="sol-icon icon-teal"><svg><use href="#${icon}"/></svg></div><div><div class="sol-name">${esc(sol.name)}</div></div></div><div class="sol-badge">${esc(sol.solutionType)}</div></div>
        <div class="sol-prices"><div><div class="sp-lbl">License / Yr</div><div class="sp-val">${sar(sol.result.annualLicense)}</div></div><div><div class="sp-lbl">Impl.</div><div class="sp-val">${sar(impl)}</div></div><div class="sp-total"><div class="sp-lbl">Year 1</div><div class="sp-val">${sar(sol.result.total)}</div></div></div>
      </div>`;
    }).join("\n");

    // Build detail sections for page 2+ with height estimation for page splitting
    const detailBlocks: { html: string; height: number }[] = payload.solutions.map((sol) => {
      const licenseItems = sol.result.lineItems.filter((i) => i.category === "license");
      const implItems = sol.result.lineItems.filter(
        (i) => i.category === "professional-services" || i.category === "hardware"
      );
      const icon = iconForSolution(sol.solutionType);

      let licenseTable = "";
      if (licenseItems.length > 0) {
        const rows = licenseItems.map((item) =>
          `<tr><td>${esc(item.description)}</td><td>${item.quantity}</td><td>${sar(item.unitPrice)}</td><td>${pct(item.discount)}</td><td>${sar(item.total)}</td></tr>`
        ).join("\n");
        licenseTable = `
          <div class="det-tbl-label">Annual Subscription License</div>
          <table class="dt"><thead><tr><th>Item</th><th>Qty</th><th>Unit Price / Yr</th><th>Discount</th><th>Total / Yr</th></tr></thead><tbody>
            ${rows}
            <tr class="sub"><td colspan="4">Total Annual License</td><td>${sar(sol.result.annualLicense)}</td></tr>
          </tbody></table>`;
      }

      let implTable = "";
      if (implItems.length > 0) {
        const rows = implItems.map((item) =>
          `<tr><td>${esc(item.description)}</td><td>${item.quantity}</td><td>${sar(item.unitPrice)}</td><td>${sar(item.total)}</td></tr>`
        ).join("\n");
        const implTotal = sol.result.professionalServices + sol.result.hardware;
        implTable = `
          <div class="det-tbl-label mt">Implementation &amp; Professional Services</div>
          <table class="dt"><thead><tr><th>Service</th><th>Man-Days</th><th>Rate / Day</th><th>Total</th></tr></thead><tbody>
            ${rows}
            <tr class="sub"><td colspan="3">Total Implementation</td><td>${sar(implTotal)}</td></tr>
          </tbody></table>`;
      }

      let notesHtml = "";
      const noteCount = sol.result.notes?.length ?? 0;
      if (sol.result.notes && noteCount > 0) {
        notesHtml = `<div style="margin-top:8px;padding-top:6px;border-top:1px solid #F2F3F5">
          ${sol.result.notes.map((n) => `<div style="font-size:8px;color:var(--gray);margin-bottom:2px">• ${esc(n)}</div>`).join("")}
        </div>`;
      }

      const html = `<div class="det">
        <div class="det-head"><div class="det-head-left"><div class="det-head-icon" style="color:#fff"><svg><use href="#${icon}"/></svg></div><span class="det-head-name">${esc(sol.name)}</span><span class="det-head-type">${esc(sol.solutionType)}</span></div><div class="det-head-total">SAR ${sar(sol.result.total)}</div></div>
        <div class="det-body">${licenseTable}${implTable}${notesHtml}</div>
      </div>`;

      // Estimate block height in px for page-split decisions (conservative)
      // det-head: ~38px, det-body padding: ~28px, margin-bottom: 16px = 82px base
      let height = 82;
      if (licenseItems.length > 0) {
        // label(22) + thead(26) + rows(28 each) + subtotal(30)
        height += 22 + 26 + licenseItems.length * 28 + 30;
      }
      if (implItems.length > 0) {
        // label-mt(36) + thead(26) + rows(28 each) + subtotal(30)
        height += 36 + 26 + implItems.length * 28 + 30;
      }
      if (noteCount > 0) {
        height += 18 + noteCount * 18;
      }

      return { html, height };
    });

    // Build summary table rows for final page
    const summaryRows = payload.solutions.map((sol) => {
      const icon = iconForSolution(sol.solutionType);
      const impl = sol.result.professionalServices + sol.result.hardware;
      return `<tr><td class="s-icon"><svg class="icon-teal"><use href="#${icon}"/></svg></td><td><span class="s-name">${esc(sol.name)}</span><span class="s-type">${esc(sol.solutionType)}</span></td><td class="s-lic">${sar(sol.result.annualLicense)}</td><td class="s-imp">${sar(impl)}</td><td class="s-tot">${sar(sol.result.total)}</td></tr>`;
    }).join("\n");

    // Notes
    const notesItems = [
      "All prices are in SAR, exclusive of applicable VAT (15%).",
      "Annual license / subscription fees are recurring per year.",
      "Implementation fees are one-time.",
      "This is a budgetary estimate; final pricing is subject to detailed scoping.",
      `Pricing validity is ${payload.client.validityDays} calendar days from the date of issue.`,
      "Payment terms to be agreed upon contract signing.",
      "Hardware (if applicable) is quoted separately and excluded from the above totals unless confirmed.",
    ];
    const notesHtml = notesItems.map((n, i) =>
      `<div class="note"><span class="note-n">${String(i + 1).padStart(2, "0")}</span><span class="note-t">${esc(n)}</span></div>`
    ).join("\n");

    // Pack detail blocks into pages based on estimated height
    // A4 = 297mm ≈ 1122px. Subtract teal-accent(3), body padding(26+16=42), footer(~35) = ~1042px usable.
    // Use conservative value to account for font rendering / line-height variance.
    const PAGE_USABLE_HEIGHT = 960;
    const SECTION_TITLE_HEIGHT = 40;
    const detailPages: string[][] = [];
    let currentPage: string[] = [];
    let currentHeight = SECTION_TITLE_HEIGHT;

    for (const block of detailBlocks) {
      if (currentPage.length > 0 && currentHeight + block.height > PAGE_USABLE_HEIGHT) {
        detailPages.push(currentPage);
        currentPage = [block.html];
        currentHeight = block.height;
      } else {
        currentPage.push(block.html);
        currentHeight += block.height;
      }
    }
    if (currentPage.length > 0) {
      detailPages.push(currentPage);
    }

    const totalPages = 1 + detailPages.length + 1;

    const detailPagesHtml = detailPages.map((blocks, pageIdx) => `
<div class="page">
  <div class="geo-tr"></div><div class="geo-bl"></div>
  <div class="page-content">
    <div class="teal-accent"></div>
    <div class="body" style="padding-top:26px">
      ${pageIdx === 0 ? '<div class="sec" style="font-size:9.5px;margin-bottom:18px">Solution Details — Line Item Breakdown</div>' : ""}
      ${blocks.join("\n")}
    </div>
    <div class="ft"><div class="ft-brand"><img src="data:image/png;base64,${logoB64}" class="ft-logo-img" alt="trustangle"></div><div>www.trustangle.com &nbsp;·&nbsp; Budgetary Quotation &nbsp;·&nbsp; Page ${pageIdx + 2} of ${totalPages}</div></div>
  </div>
</div>`).join("\n");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Budgetary Quotation — ${esc(payload.client.companyName)} — trustangle</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root {
    --teal-deep: #0D7D7E;
    --teal: #0099A8;
    --teal-mid: #2AAFB6;
    --teal-10: rgba(13,125,126,0.10);
    --teal-06: rgba(13,125,126,0.06);
    --teal-04: rgba(13,125,126,0.04);
    --gray: #7A7C81;
    --gray-light: #A0A3A8;
    --dark: #2D3436;
    --body: #555B63;
    --border: #E6E8EB;
    --card-shadow: 0 1px 6px rgba(13,125,126,0.05);
    --gradient-h: linear-gradient(135deg, #0B6B6C 0%, #0D7D7E 35%, #1FA5A7 100%);
  }
  body { font-family: 'Poppins', sans-serif; color: var(--dark); background: #c8c8c8; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { width: 210mm; height: 297mm; margin: 16px auto; background: #FAF9F7; background-image: radial-gradient(ellipse at 15% 30%, rgba(255,255,255,0.7) 0%, transparent 60%), radial-gradient(ellipse at 85% 15%, rgba(255,255,255,0.5) 0%, transparent 50%), radial-gradient(ellipse at 50% 85%, rgba(210,206,200,0.15) 0%, transparent 45%); position: relative; overflow: hidden; page-break-after: always; box-shadow: 0 4px 40px rgba(0,0,0,0.12); }
  @media print { body { background: #fff; } .page { margin: 0; box-shadow: none; } }
  .page-content { position: relative; z-index: 1; height: 100%; display: flex; flex-direction: column; }
  .geo-tr { position: absolute; top: -30px; right: -30px; width: 160px; height: 160px; border: 1px solid rgba(13,125,126,0.04); transform: rotate(45deg); pointer-events: none; z-index: 0; }
  .geo-bl { position: absolute; bottom: -20px; left: -20px; width: 120px; height: 120px; border: 1px solid rgba(13,125,126,0.03); transform: rotate(45deg); pointer-events: none; z-index: 0; }
  .header { background: var(--gradient-h); padding: 20px 40px 16px; position: relative; overflow: hidden; }
  .header::before { content: ''; position: absolute; top: -50px; right: -50px; width: 180px; height: 180px; border-radius: 50%; background: rgba(255,255,255,0.04); }
  .header-top { display: flex; justify-content: space-between; align-items: flex-start; position: relative; z-index: 1; }
  .header-logo { height: 28px; width: auto; display: block; filter: brightness(0) invert(1); }
  .doc-label { color: rgba(255,255,255,0.85); font-size: 9px; letter-spacing: 2px; text-transform: uppercase; font-weight: 600; text-align: right; }
  .header-bottom { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.12); position: relative; z-index: 1; }
  .client-for { color: rgba(255,255,255,0.65); font-size: 7.5px; letter-spacing: 2px; text-transform: uppercase; font-weight: 500; margin-bottom: 2px; }
  .client-name { color: #fff; font-size: 18px; font-weight: 700; letter-spacing: -0.2px; }
  .meta-row { display: flex; gap: 24px; }
  .meta-item { text-align: right; }
  .meta-lbl { color: rgba(255,255,255,0.6); font-size: 7px; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 500; margin-bottom: 1px; }
  .meta-val { color: rgba(255,255,255,0.95); font-size: 10.5px; font-weight: 500; }
  .cred-strip { padding: 9px 40px; display: flex; justify-content: center; gap: 28px; border-bottom: 1px solid var(--border); background: rgba(13,125,126,0.02); }
  .cred-item { display: flex; align-items: center; gap: 7px; }
  .cred-icon { width: 14px; height: 14px; flex-shrink: 0; }
  .cred-icon svg { width: 14px; height: 14px; }
  .cred-num { color: var(--teal-deep); font-size: 12px; font-weight: 700; }
  .cred-label { color: var(--gray); font-size: 8.5px; font-weight: 500; }
  .body { padding: 22px 40px 16px; flex: 1; min-height: 0; overflow: hidden; }
  .sec { font-size: 8.5px; font-weight: 700; color: var(--teal-deep); letter-spacing: 1.8px; text-transform: uppercase; margin-bottom: 10px; }
  .inv-row { display: flex; gap: 14px; margin-bottom: 20px; }
  .inv-hero { flex: 5; background: var(--gradient-h); border-radius: 14px; padding: 22px 28px; position: relative; overflow: hidden; }
  .inv-hero::before { content:''; position:absolute; top:-15px; right:-15px; width:90px; height:90px; border-radius:50%; background:rgba(255,255,255,0.05); }
  .inv-hero::after { content:''; position:absolute; bottom:-25px; right:50px; width:65px; height:65px; border-radius:50%; background:rgba(255,255,255,0.03); }
  .inv-label { color: rgba(255,255,255,0.45); font-size: 8px; letter-spacing: 2px; text-transform: uppercase; font-weight: 500; margin-bottom: 5px; }
  .inv-amount { color: #fff; font-size: 32px; font-weight: 800; letter-spacing: -0.5px; line-height: 1; position: relative; z-index: 1; }
  .inv-note { color: rgba(255,255,255,0.5); font-size: 9px; margin-top: 8px; font-weight: 400; position: relative; z-index: 1; }
  .inv-side { flex: 3; display: flex; flex-direction: column; gap: 10px; }
  .inv-card { flex: 1; background: #fff; border-radius: 12px; padding: 13px 18px; border: 1px solid var(--border); box-shadow: var(--card-shadow); }
  .inv-card-lbl { color: var(--gray); font-size: 7.5px; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 600; margin-bottom: 2px; }
  .inv-card-val { color: var(--teal-deep); font-size: 19px; font-weight: 700; }
  .inv-card-tag { font-size: 9px; font-weight: 500; margin-top: 1px; }
  .recurring { color: var(--teal-mid); }
  .onetime { color: var(--gray-light); }
  .projection { margin-bottom: 20px; }
  .proj-wrap { background: #fff; border: 1px solid var(--border); border-radius: 12px; padding: 18px 22px; box-shadow: var(--card-shadow); }
  .proj-chart { display: flex; align-items: flex-end; justify-content: center; gap: 16px; padding: 0 10px; margin-bottom: 14px; }
  .proj-col { display: flex; flex-direction: column; align-items: center; flex: 1; }
  .proj-val { font-size: 8px; font-weight: 600; color: var(--dark); margin-bottom: 4px; white-space: nowrap; }
  .proj-bar { display: flex; flex-direction: column; width: 100%; max-width: 72px; border-radius: 6px 6px 0 0; overflow: hidden; }
  .proj-seg-impl { background: var(--teal-mid); }
  .proj-seg-lic { background: var(--teal-deep); }
  .proj-yr { font-size: 8px; color: var(--gray); font-weight: 500; margin-top: 5px; }
  .proj-yr-active { color: var(--teal-deep); font-weight: 700; }
  .proj-legend { display: flex; justify-content: center; gap: 20px; margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px solid #F2F3F5; }
  .proj-legend-item { display: flex; align-items: center; gap: 5px; font-size: 8px; color: var(--gray); font-weight: 500; }
  .proj-dot { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }
  .proj-insights { display: flex; gap: 14px; }
  .proj-insight { flex: 1; text-align: center; padding: 10px 8px; background: var(--teal-04); border-radius: 8px; }
  .proj-insight-val { font-size: 14px; font-weight: 700; line-height: 1.2; }
  .proj-insight-lbl { font-size: 7.5px; color: var(--gray); font-weight: 500; margin-top: 2px; }
  .sol-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
  .sol { background: #fff; border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px 11px; position: relative; overflow: hidden; box-shadow: var(--card-shadow); }
  .sol-accent { position: absolute; top: 0; left: 0; width: 3px; height: 100%; }
  .sol-top { display: flex; justify-content: space-between; align-items: flex-start; }
  .sol-title-row { display: flex; align-items: center; gap: 8px; }
  .sol-icon { width: 22px; height: 22px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
  .sol-icon svg { width: 18px; height: 18px; }
  .sol-name { font-weight: 600; font-size: 11px; color: var(--dark); line-height: 1.2; }
  .sol-badge { font-size: 7px; font-weight: 600; padding: 2px 7px; border-radius: 10px; letter-spacing: 0.4px; flex-shrink: 0; background: var(--teal-04); color: var(--teal-deep); }
  .sol-prices { display: flex; gap: 14px; margin-top: 8px; padding-top: 7px; border-top: 1px solid #F2F3F5; }
  .sp-lbl { font-size: 6.5px; color: var(--gray-light); letter-spacing: 0.5px; text-transform: uppercase; font-weight: 600; }
  .sp-val { font-size: 11px; font-weight: 600; color: var(--dark); margin-top: 1px; }
  .sp-total { margin-left: auto; text-align: right; }
  .sp-total .sp-val { color: var(--teal-deep); font-weight: 700; }
  .det { margin-bottom: 16px; }
  .det-head { display: flex; justify-content: space-between; align-items: center; padding: 9px 16px; background: var(--gradient-h); border-radius: 10px 10px 0 0; }
  .det-head-left { display: flex; align-items: center; gap: 8px; }
  .det-head-icon svg { width: 16px; height: 16px; }
  .det-head-name { color: #fff; font-weight: 600; font-size: 12px; }
  .det-head-type { color: rgba(255,255,255,0.6); font-size: 9.5px; margin-left: 6px; font-weight: 400; }
  .det-head-total { color: #fff; font-weight: 700; font-size: 13px; }
  .det-body { background: #fff; border: 1px solid var(--border); border-top: none; border-radius: 0 0 10px 10px; padding: 14px 16px; box-shadow: 0 2px 6px rgba(0,0,0,0.02); }
  .det-tbl-label { font-size: 7.5px; font-weight: 700; color: var(--teal-deep); letter-spacing: 1px; text-transform: uppercase; margin-bottom: 5px; }
  .det-tbl-label.mt { margin-top: 12px; }
  table.dt { width: 100%; border-collapse: collapse; font-size: 9px; }
  table.dt thead th { background: var(--teal-04); color: var(--teal-deep); font-weight: 600; font-size: 7.5px; letter-spacing: 0.3px; text-transform: uppercase; padding: 6px 10px; border-bottom: 1px solid var(--teal-06); }
  table.dt thead th:first-child { text-align: left; border-radius: 4px 0 0 0; }
  table.dt thead th:last-child { border-radius: 0 4px 0 0; }
  table.dt thead th:not(:first-child) { text-align: right; }
  table.dt tbody td { padding: 6px 10px; border-bottom: 1px solid #F4F5F6; color: var(--body); font-weight: 400; }
  table.dt tbody td:first-child { color: var(--dark); font-weight: 500; }
  table.dt tbody td:not(:first-child) { text-align: right; }
  tr.sub td { border-top: 2px solid var(--teal-deep) !important; border-bottom: none !important; font-weight: 600 !important; color: var(--dark) !important; padding-top: 7px !important; }
  tr.sub td:last-child { color: var(--teal-deep) !important; font-weight: 700 !important; font-size: 10px !important; }
  .summ-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  .summ-table tr { border-bottom: 1px solid var(--border); }
  .summ-table tr:last-child { border-bottom: none; }
  .summ-table td { padding: 9px 0; vertical-align: middle; }
  .summ-table .s-icon { width: 32px; }
  .summ-table .s-icon svg { width: 16px; height: 16px; vertical-align: middle; }
  .summ-table .s-name { color: var(--dark); font-size: 11px; font-weight: 500; }
  .summ-table .s-type { color: var(--gray-light); font-size: 9px; font-weight: 400; margin-left: 6px; }
  .summ-table .s-lic, .summ-table .s-imp { text-align: right; color: var(--body); font-size: 10px; font-weight: 400; width: 90px; }
  .summ-table .s-tot { text-align: right; color: var(--teal-deep); font-size: 11px; font-weight: 700; width: 100px; }
  .summ-hdr td { font-size: 7px !important; color: var(--gray-light) !important; font-weight: 600 !important; letter-spacing: 0.5px; text-transform: uppercase; padding-bottom: 5px !important; border-bottom: 1px solid var(--teal-06) !important; }
  .summ-totals { border-top: 2px solid var(--teal-deep); margin-top: 2px; }
  .summ-totals td { padding: 7px 0 !important; font-weight: 600 !important; color: var(--dark) !important; font-size: 10px !important; }
  .summ-totals td.s-tot { color: var(--teal-deep) !important; font-weight: 700 !important; }
  .grand-row { display: flex; justify-content: space-between; align-items: baseline; margin-top: 14px; padding: 16px 20px; background: var(--gradient-h); border-radius: 10px; }
  .grand-label { color: rgba(255,255,255,0.8); font-size: 13px; font-weight: 600; }
  .grand-val { color: #fff; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
  .notes-sec { margin-top: 24px; }
  .note { display: flex; gap: 10px; margin-bottom: 6px; }
  .note-n { color: var(--teal-deep); font-weight: 700; font-size: 9px; min-width: 16px; flex-shrink: 0; opacity: 0.6; }
  .note-t { color: var(--body); font-size: 9px; line-height: 1.55; font-weight: 400; }
  .next-box { margin-top: 22px; padding: 18px 24px; background: #fff; border-radius: 12px; border: 1px solid var(--border); border-left: 3px solid var(--teal-deep); box-shadow: var(--card-shadow); }
  .next-title { font-size: 9px; font-weight: 700; color: var(--teal-deep); letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 8px; }
  .next-text { color: var(--body); font-size: 10px; line-height: 1.6; font-weight: 400; margin-bottom: 14px; }
  .contact-row { display: flex; gap: 28px; }
  .contact-item { display: flex; align-items: center; gap: 8px; }
  .contact-icon { width: 16px; height: 16px; flex-shrink: 0; }
  .contact-icon svg { width: 16px; height: 16px; }
  .contact-lbl { font-size: 7px; color: var(--gray-light); letter-spacing: 1px; text-transform: uppercase; font-weight: 600; }
  .contact-val { font-size: 10px; color: var(--dark); font-weight: 500; }
  .closing { text-align: center; margin-top: auto; padding-bottom: 10px; }
  .closing-logo { height: 28px; width: auto; }
  .closing-tag { color: var(--gray-light); font-size: 7.5px; letter-spacing: 2px; text-transform: uppercase; margin-top: 4px; font-weight: 400; }
  .closing-slogan { color: var(--gray); font-size: 8px; margin-top: 6px; font-weight: 400; font-style: italic; }
  .ft { padding: 9px 40px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); font-size: 7.5px; color: var(--gray-light); font-weight: 500; margin-top: auto; }
  .ft-logo-img { height: 14px; width: auto; }
  .teal-accent { height: 3px; background: var(--gradient-h); }
  .icon-teal { color: var(--teal-deep); }
</style>
</head>
<body>
<svg xmlns="http://www.w3.org/2000/svg" style="display:none">
  <symbol id="ic-erp" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></symbol>
  <symbol id="ic-hcm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="7" r="3"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><circle cx="17" cy="9" r="2.5"/><path d="M21 21v-1.5a3 3 0 0 0-2-2.83"/></symbol>
  <symbol id="ic-pos" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="12" rx="2"/><path d="M6 20h12"/><path d="M12 16v4"/></symbol>
  <symbol id="ic-fnb" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v7c0 1.1.9 2 2 2h3a2 2 0 0 0 2-2V3"/><path d="M7 3v18"/><path d="M21 15V3c-2.5 0-5 2-5 5v4a2 2 0 0 0 2 2h1"/><path d="M19 12v9"/></symbol>
  <symbol id="ic-inv" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></symbol>
  <symbol id="ic-ipaas" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></symbol>
  <symbol id="ic-mobile" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></symbol>
  <symbol id="ic-loyalty" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></symbol>
  <symbol id="ic-mail" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></symbol>
  <symbol id="ic-phone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92Z"/></symbol>
  <symbol id="ic-globe" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></symbol>
  <symbol id="ic-building" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="1"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></symbol>
  <symbol id="ic-folder" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></symbol>
  <symbol id="ic-users" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.87"/></symbol>
  <symbol id="ic-briefcase" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></symbol>
  <symbol id="ic-handshake" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88"/><path d="m3 7 3 3"/><path d="m21 7-3 3"/></symbol>
</svg>

<!-- PAGE 1 — EXECUTIVE SUMMARY -->
<div class="page">
  <div class="geo-tr"></div><div class="geo-bl"></div>
  <div class="page-content">
    <div class="teal-accent"></div>
    <div class="header">
      <div class="header-top">
        <img src="data:image/png;base64,${logoB64}" class="header-logo" alt="trustangle">
        <div><div class="doc-label">Budgetary Quotation</div></div>
      </div>
      <div class="header-bottom">
        <div><div class="client-for">Prepared For</div><div class="client-name">${esc(payload.client.companyName)}</div></div>
        <div class="meta-row">
          <div class="meta-item"><div class="meta-lbl">Date</div><div class="meta-val">${formatDate(payload.client.date)}</div></div>
          <div class="meta-item"><div class="meta-lbl">Valid Until</div><div class="meta-val">${validUntilDate(payload.client.date, payload.client.validityDays)}</div></div>
          <div class="meta-item"><div class="meta-lbl">Currency</div><div class="meta-val">SAR</div></div>
        </div>
      </div>
    </div>

    <div class="cred-strip">
      <div class="cred-item"><svg class="cred-icon icon-teal"><use href="#ic-building"/></svg><span class="cred-num">250+</span><span class="cred-label">Employees</span></div>
      <div class="cred-item"><svg class="cred-icon icon-teal"><use href="#ic-folder"/></svg><span class="cred-num">1,200+</span><span class="cred-label">Projects</span></div>
      <div class="cred-item"><svg class="cred-icon icon-teal"><use href="#ic-users"/></svg><span class="cred-num">450+</span><span class="cred-label">Clients</span></div>
      <div class="cred-item"><svg class="cred-icon icon-teal"><use href="#ic-briefcase"/></svg><span class="cred-num">15+</span><span class="cred-label">Industries</span></div>
      <div class="cred-item"><svg class="cred-icon icon-teal"><use href="#ic-handshake"/></svg><span class="cred-num">60+</span><span class="cred-label">Partners</span></div>
    </div>

    <div class="body">
      <div class="inv-row">
        <div class="inv-hero">
          <div class="inv-label">Year 1 Total Investment</div>
          <div class="inv-amount">SAR ${sar(payload.grandTotal)}</div>
          <div class="inv-note">${solCount} solution${solCount > 1 ? "s" : ""} · Exclusive of VAT (15%)</div>
        </div>
        <div class="inv-side">
          <div class="inv-card"><div class="inv-card-lbl">Annual Licenses</div><div class="inv-card-val">${sar(totalLicense)}</div><div class="inv-card-tag recurring">Recurring yearly</div></div>
          <div class="inv-card"><div class="inv-card-lbl">Implementation</div><div class="inv-card-val">${sar(totalImpl)}</div><div class="inv-card-tag onetime">One-time</div></div>
        </div>
      </div>

      <div class="projection">
        <div class="sec">5-Year Investment Projection</div>
        <div class="proj-wrap">
          <div class="proj-chart">
            ${years.map((yr, i) => {
              const barH = Math.max(8, Math.round((yr.total / maxBar) * 62));
              const licH = yr.lic > 0 ? Math.max(4, Math.round((yr.lic / maxBar) * 62)) : 0;
              const implH = barH - licH;
              return `<div class="proj-col">
                <div class="proj-val">${sar(yr.total)}</div>
                <div class="proj-bar" style="height:${barH}px">
                  ${implH > 0 ? `<div class="proj-seg-impl" style="height:${implH}px"></div>` : ""}
                  <div class="proj-seg-lic" style="height:${licH}px"></div>
                </div>
                <div class="proj-yr${i === 0 ? " proj-yr-active" : ""}">${yr.label}</div>
              </div>`;
            }).join("\n")}
          </div>
          <div class="proj-legend">
            <div class="proj-legend-item"><div class="proj-dot" style="background:var(--teal-deep)"></div><span>License (recurring)</span></div>
            <div class="proj-legend-item"><div class="proj-dot" style="background:var(--teal-mid)"></div><span>Implementation (one-time)</span></div>
          </div>
          <div class="proj-insights">
            <div class="proj-insight">
              <div class="proj-insight-val" style="color:#059669">SAR ${sar(yearNMonthly)}<span style="font-size:8px;font-weight:400;color:var(--gray)">/mo</span></div>
              <div class="proj-insight-lbl">From Year 2 onwards</div>
            </div>
            <div class="proj-insight">
              <div class="proj-insight-val" style="color:#059669">${savingsPct}%</div>
              <div class="proj-insight-lbl">Lower than Year 1</div>
            </div>
            <div class="proj-insight">
              <div class="proj-insight-val" style="color:var(--teal-deep)">SAR ${sar(fiveYearTotal)}</div>
              <div class="proj-insight-lbl">5-Year Total Cost</div>
            </div>
          </div>
        </div>
      </div>

      <div class="sec">Solution Overview</div>
      <div class="sol-grid">
        ${solCards}
      </div>
    </div>

    <div class="ft"><div class="ft-brand"><img src="data:image/png;base64,${logoB64}" class="ft-logo-img" alt="trustangle"></div><div>www.trustangle.com &nbsp;·&nbsp; Budgetary Quotation &nbsp;·&nbsp; Page 1 of ${totalPages}</div></div>
  </div>
</div>

${detailPagesHtml}

<!-- FINAL PAGE — SUMMARY + NOTES + CLOSE -->
<div class="page">
  <div class="geo-tr"></div><div class="geo-bl"></div>
  <div class="page-content">
    <div class="teal-accent"></div>
    <div class="body" style="padding-top:26px">
      <div class="sec">Investment Summary</div>
      <table class="summ-table">
        <tr class="summ-hdr"><td class="s-icon"></td><td>Solution</td><td class="s-lic">License / Yr</td><td class="s-imp">Implementation</td><td class="s-tot">Year 1 Total</td></tr>
        ${summaryRows}
        <tr class="summ-totals"><td class="s-icon"></td><td>Total</td><td class="s-lic">${sar(totalLicense)}</td><td class="s-imp">${sar(totalImpl)}</td><td class="s-tot">${sar(payload.grandTotal)}</td></tr>
      </table>

      <div class="grand-row">
        <span class="grand-label">Year 1 Total (excl. VAT)</span>
        <span class="grand-val">SAR ${sar(payload.grandTotal)}</span>
      </div>

      <div class="notes-sec">
        <div class="sec">Notes &amp; Assumptions</div>
        ${notesHtml}
      </div>

      <div class="next-box">
        <div class="next-title">Next Steps</div>
        <div class="next-text">To proceed or discuss this quotation in detail, please reach out to your trustangle account contact.</div>
        <div class="contact-row">
          <div class="contact-item"><div class="contact-icon icon-teal"><svg><use href="#ic-mail"/></svg></div><div><div class="contact-lbl">Email</div><div class="contact-val">info@trustangle.com</div></div></div>
          <div class="contact-item"><div class="contact-icon icon-teal"><svg><use href="#ic-phone"/></svg></div><div><div class="contact-lbl">Phone</div><div class="contact-val">+966 9200 33605</div></div></div>
          <div class="contact-item"><div class="contact-icon icon-teal"><svg><use href="#ic-globe"/></svg></div><div><div class="contact-lbl">Web</div><div class="contact-val">www.trustangle.com</div></div></div>
        </div>
      </div>

      <div class="closing">
        <img src="data:image/png;base64,${logoB64}" class="closing-logo" alt="trustangle">
        <div class="closing-tag">Technology Shifting</div>
        <div class="closing-slogan">Trusted Consultancy. Transformative Technology.</div>
      </div>
    </div>

    <div class="ft"><div class="ft-brand"><img src="data:image/png;base64,${logoB64}" class="ft-logo-img" alt="trustangle"></div><div>www.trustangle.com &nbsp;·&nbsp; Budgetary Quotation &nbsp;·&nbsp; Page ${totalPages} of ${totalPages}</div></div>
  </div>
</div>

</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (err) {
    console.error("Quote generation error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate quote" },
      { status: 500 }
    );
  }
}
