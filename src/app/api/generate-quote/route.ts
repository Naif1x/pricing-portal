import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

export const runtime = "nodejs";

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
    lineItems: {
      description: string;
      quantity: number;
      unitPrice: number;
      discount: number;
      total: number;
      category: string;
    }[];
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
    validUntil: string;
    notes: string;
  };
  solutions: SolutionPayload[];
  grandTotal: number;
}

const PRIMARY = "002933";
const ACCENT = "0099A8";
const WHITE = "FFFFFF";
const LIGHT_BG = "E6F5F6";
const BORDER_COLOR = "B2DEE0";

function applyHeaderStyle(
  row: ExcelJS.Row,
  bgColor = PRIMARY,
  fontColor = WHITE
) {
  row.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: bgColor },
    };
    cell.font = { bold: true, color: { argb: fontColor }, size: 11, name: "Arial" };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: BORDER_COLOR } },
      bottom: { style: "thin", color: { argb: BORDER_COLOR } },
      left: { style: "thin", color: { argb: BORDER_COLOR } },
      right: { style: "thin", color: { argb: BORDER_COLOR } },
    };
  });
}

function applyDataStyle(row: ExcelJS.Row, isAlt = false) {
  row.eachCell((cell) => {
    if (isAlt) {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: LIGHT_BG },
      };
    }
    cell.font = { size: 10, name: "Arial" };
    cell.alignment = { vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: BORDER_COLOR } },
      bottom: { style: "thin", color: { argb: BORDER_COLOR } },
      left: { style: "thin", color: { argb: BORDER_COLOR } },
      right: { style: "thin", color: { argb: BORDER_COLOR } },
    };
  });
}

function sarFormat(cell: ExcelJS.Cell) {
  cell.numFmt = '#,##0.00 "SAR"';
  cell.alignment = { ...cell.alignment, horizontal: "right" };
}

function pctFormat(cell: ExcelJS.Cell) {
  cell.numFmt = "0%";
  cell.alignment = { ...cell.alignment, horizontal: "center" };
}

function getExecutiveSummary(payload: QuotePayload): string {
  const solutionNames = payload.solutions.map((s) => s.name).join(", ");
  return `Trustangle Technology Solutions is pleased to present this technology solutions proposal for ${payload.client.companyName}. This comprehensive quote encompasses ${payload.solutions.length} solution${payload.solutions.length > 1 ? "s" : ""} — ${solutionNames} — tailored to your business requirements, covering annual licensing, professional services, and implementation support. Our team is committed to delivering a seamless implementation experience and ensuring maximum value from your technology investment.`;
}

export async function POST(request: Request) {
  try {
    const payload: QuotePayload = await request.json();

    const summary = getExecutiveSummary(payload);

    const wb = new ExcelJS.Workbook();
    wb.creator = "Trustangle Pricing Portal";
    wb.created = new Date();

    // ─── Cover Sheet ─────────────────────────────────────
    const cover = wb.addWorksheet("Cover", {
      properties: { defaultColWidth: 18 },
    });
    cover.columns = [
      { width: 5 },
      { width: 30 },
      { width: 30 },
      { width: 5 },
    ];

    // Trustangle header
    cover.mergeCells("B2:C2");
    const titleCell = cover.getCell("B2");
    titleCell.value = "TRUSTANGLE";
    titleCell.font = { size: 28, bold: true, color: { argb: PRIMARY }, name: "Arial" };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };

    cover.mergeCells("B3:C3");
    const subtitleCell = cover.getCell("B3");
    subtitleCell.value = "Technology Solutions Proposal";
    subtitleCell.font = { size: 14, color: { argb: ACCENT }, name: "Arial" };
    subtitleCell.alignment = { horizontal: "center" };

    // Divider
    cover.getRow(4).height = 5;
    cover.mergeCells("B4:C4");
    cover.getCell("B4").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ACCENT },
    };

    // Client info
    const clientRows: [string, string][] = [
      ["Prepared For:", payload.client.companyName],
      ["Contact:", payload.client.contactName],
      ["Email:", payload.client.email || "—"],
      ["Phone:", payload.client.phone || "—"],
      ["Date:", payload.client.date],
      ["Valid Until:", payload.client.validUntil],
    ];
    let r = 6;
    for (const [label, val] of clientRows) {
      cover.getCell(`B${r}`).value = label;
      cover.getCell(`B${r}`).font = {
        bold: true,
        size: 11,
        color: { argb: "5A6A7E" },
        name: "Arial",
      };
      cover.getCell(`C${r}`).value = val;
      cover.getCell(`C${r}`).font = { size: 11, name: "Arial" };
      r++;
    }

    // Executive summary
    r += 1;
    cover.mergeCells(`B${r}:C${r}`);
    cover.getCell(`B${r}`).value = "Executive Summary";
    cover.getCell(`B${r}`).font = {
      bold: true,
      size: 13,
      color: { argb: PRIMARY },
      name: "Arial",
    };
    r++;
    cover.mergeCells(`B${r}:C${r + 2}`);
    const summaryCell = cover.getCell(`B${r}`);
    summaryCell.value = summary;
    summaryCell.font = { size: 10, name: "Arial", color: { argb: "5A6A7E" } };
    summaryCell.alignment = { wrapText: true, vertical: "top" };

    // Grand total on cover
    r += 4;
    cover.mergeCells(`B${r}:C${r}`);
    const gtCell = cover.getCell(`B${r}`);
    gtCell.value = `Grand Total: SAR ${payload.grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
    gtCell.font = { bold: true, size: 16, color: { argb: PRIMARY }, name: "Arial" };
    gtCell.alignment = { horizontal: "center" };
    gtCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "E6F5F6" },
    };
    gtCell.border = {
      top: { style: "medium", color: { argb: PRIMARY } },
      bottom: { style: "medium", color: { argb: PRIMARY } },
    };

    // ─── Terms & Conditions (first content page) ────────
    const terms = wb.addWorksheet("Terms & Conditions");
    terms.columns = [{ width: 5 }, { width: 60 }, { width: 5 }];

    terms.mergeCells("B1:B1");
    terms.getCell("B1").value = "Terms & Conditions";
    terms.getCell("B1").font = { bold: true, size: 14, color: { argb: PRIMARY }, name: "Arial" };

    const termsList = [
      "1. All prices are in Saudi Riyals (SAR) unless otherwise stated.",
      "2. Prices are exclusive of Value Added Tax (VAT) at 15%.",
      "3. Annual license fees are payable in advance.",
      "4. Professional services are billed upon delivery.",
      "5. Hardware is billed upon delivery and installation.",
      `6. This quotation is valid until ${payload.client.validUntil || "30 days from the date of issue"}.`,
      "7. Payment terms: Net 30 days from invoice date.",
      "8. Implementation timelines will be confirmed upon project kick-off.",
      "9. Travel expenses for on-site implementation are billed separately.",
      "10. This proposal is confidential and intended solely for the named recipient.",
    ];

    termsList.forEach((term, i) => {
      const termRow = terms.getRow(3 + i);
      termRow.getCell(2).value = term;
      termRow.getCell(2).font = { size: 10, name: "Arial", color: { argb: "5A6A7E" } };
    });

    if (payload.client.notes) {
      const notesRow = 3 + termsList.length + 1;
      terms.getCell(`B${notesRow}`).value = "Additional Notes:";
      terms.getCell(`B${notesRow}`).font = {
        bold: true,
        size: 10,
        name: "Arial",
        color: { argb: PRIMARY },
      };
      terms.getCell(`B${notesRow + 1}`).value = payload.client.notes;
      terms.getCell(`B${notesRow + 1}`).font = {
        size: 10,
        name: "Arial",
        color: { argb: "5A6A7E" },
      };
    }

    // ─── Summary Sheet ───────────────────────────────────
    const summarySheet = wb.addWorksheet("Summary");
    summarySheet.columns = [
      { header: "#", width: 5 },
      { header: "Solution", width: 28 },
      { header: "Type", width: 22 },
      { header: "Annual License", width: 18 },
      { header: "Hardware", width: 16 },
      { header: "Professional Services", width: 22 },
      { header: "Total", width: 18 },
    ];

    // Title row
    summarySheet.spliceRows(1, 0, []);
    summarySheet.mergeCells("A1:G1");
    const sumTitle = summarySheet.getCell("A1");
    sumTitle.value = `Pricing Summary — ${payload.client.companyName}`;
    sumTitle.font = { bold: true, size: 14, color: { argb: PRIMARY }, name: "Arial" };
    sumTitle.alignment = { horizontal: "left", vertical: "middle" };
    summarySheet.getRow(1).height = 30;

    // Headers
    const headerRow = summarySheet.getRow(2);
    headerRow.values = [
      "#",
      "Solution",
      "Type",
      "Annual License (SAR)",
      "Hardware (SAR)",
      "Professional Services (SAR)",
      "Total (SAR)",
    ];
    applyHeaderStyle(headerRow);
    headerRow.height = 25;

    // Data
    payload.solutions.forEach((sol, i) => {
      const dataRow = summarySheet.getRow(3 + i);
      dataRow.values = [
        i + 1,
        sol.name,
        sol.solutionType,
        sol.result.annualLicense,
        sol.result.hardware,
        sol.result.professionalServices,
        sol.result.total,
      ];
      applyDataStyle(dataRow, i % 2 === 1);
      sarFormat(dataRow.getCell(4));
      sarFormat(dataRow.getCell(5));
      sarFormat(dataRow.getCell(6));
      sarFormat(dataRow.getCell(7));
    });

    // Totals row
    const totalsRowNum = 3 + payload.solutions.length;
    const totalsRow = summarySheet.getRow(totalsRowNum);
    totalsRow.values = [
      "",
      "",
      "GRAND TOTAL",
      payload.solutions.reduce((s, sol) => s + sol.result.annualLicense, 0),
      payload.solutions.reduce((s, sol) => s + sol.result.hardware, 0),
      payload.solutions.reduce((s, sol) => s + sol.result.professionalServices, 0),
      payload.grandTotal,
    ];
    applyHeaderStyle(totalsRow, ACCENT, WHITE);
    sarFormat(totalsRow.getCell(4));
    sarFormat(totalsRow.getCell(5));
    sarFormat(totalsRow.getCell(6));
    sarFormat(totalsRow.getCell(7));

    // ─── Individual Solution Sheets ──────────────────────
    for (const sol of payload.solutions) {
      const sheetName = sol.name.slice(0, 31).replace(/[\\/*?[\]]/g, "");
      const ws = wb.addWorksheet(sheetName);

      ws.columns = [
        { width: 5 },
        { width: 35 },
        { width: 10 },
        { width: 16 },
        { width: 12 },
        { width: 18 },
      ];

      // Solution title
      ws.mergeCells("B1:F1");
      const solTitle = ws.getCell("B1");
      solTitle.value = sol.name;
      solTitle.font = { bold: true, size: 14, color: { argb: PRIMARY }, name: "Arial" };
      ws.getRow(1).height = 28;

      ws.mergeCells("B2:F2");
      ws.getCell("B2").value = sol.solutionType;
      ws.getCell("B2").font = { size: 10, color: { argb: "5A6A7E" }, name: "Arial" };

      // Line items header
      const hdr = ws.getRow(4);
      hdr.values = [
        "",
        "Description",
        "Qty",
        "Unit Price (SAR)",
        "Discount",
        "Total (SAR)",
      ];
      applyHeaderStyle(hdr);

      // Line items
      let row = 5;
      let currentCategory = "";
      const categories: Record<string, string> = {
        license: "Annual Licenses",
        hardware: "Hardware",
        "professional-services": "Professional Services",
      };

      const sortedItems = [...sol.result.lineItems].sort((a, b) => {
        const order = { license: 0, hardware: 1, "professional-services": 2 };
        return (
          (order[a.category as keyof typeof order] || 0) -
          (order[b.category as keyof typeof order] || 0)
        );
      });

      for (const item of sortedItems) {
        if (item.category !== currentCategory) {
          currentCategory = item.category;
          const catRow = ws.getRow(row);
          ws.mergeCells(`B${row}:F${row}`);
          catRow.getCell(2).value = categories[currentCategory] || currentCategory;
          catRow.getCell(2).font = {
            bold: true,
            size: 10,
            color: { argb: PRIMARY },
            name: "Arial",
          };
          catRow.getCell(2).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "E6F5F6" },
          };
          row++;
        }
        const dataRow = ws.getRow(row);
        dataRow.values = [
          "",
          item.description,
          item.quantity,
          item.unitPrice,
          item.discount,
          item.total,
        ];
        applyDataStyle(dataRow, (row - 5) % 2 === 0);
        sarFormat(dataRow.getCell(4));
        pctFormat(dataRow.getCell(5));
        sarFormat(dataRow.getCell(6));
        dataRow.getCell(3).alignment = { horizontal: "center", vertical: "middle" };
        row++;
      }

      // Subtotals
      row++;
      const subLabels: [string, number][] = [
        ["Annual License", sol.result.annualLicense],
        ["Hardware", sol.result.hardware],
        ["Professional Services", sol.result.professionalServices],
      ];
      for (const [label, val] of subLabels) {
        if (val === 0 && label === "Hardware") continue;
        const subRow = ws.getRow(row);
        subRow.getCell(2).value = label;
        subRow.getCell(2).font = { size: 10, name: "Arial", color: { argb: "5A6A7E" } };
        subRow.getCell(6).value = val;
        sarFormat(subRow.getCell(6));
        subRow.getCell(6).font = { size: 10, name: "Arial" };
        row++;
      }

      // Total
      const totalRow = ws.getRow(row);
      totalRow.getCell(2).value = "TOTAL";
      totalRow.getCell(2).font = {
        bold: true,
        size: 12,
        color: { argb: PRIMARY },
        name: "Arial",
      };
      totalRow.getCell(6).value = sol.result.total;
      sarFormat(totalRow.getCell(6));
      totalRow.getCell(6).font = {
        bold: true,
        size: 12,
        color: { argb: PRIMARY },
        name: "Arial",
      };
      totalRow.getCell(6).border = {
        top: { style: "medium", color: { argb: PRIMARY } },
        bottom: { style: "double", color: { argb: PRIMARY } },
      };

      // Notes
      if (sol.result.notes && sol.result.notes.length > 0) {
        row += 2;
        ws.getCell(`B${row}`).value = "Notes:";
        ws.getCell(`B${row}`).font = {
          bold: true,
          size: 9,
          color: { argb: "5A6A7E" },
          name: "Arial",
        };
        for (const note of sol.result.notes) {
          row++;
          ws.getCell(`B${row}`).value = `• ${note}`;
          ws.getCell(`B${row}`).font = {
            size: 9,
            color: { argb: "5A6A7E" },
            name: "Arial",
          };
        }
      }
    }

    // Footer on all sheets
    for (const ws of wb.worksheets) {
      ws.headerFooter.oddFooter =
        "&L&8Trustangle Technology Solutions&C&8Confidential&R&8Page &P of &N";
    }

    // Generate buffer
    const buffer = await wb.xlsx.writeBuffer();

    return new NextResponse(buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Trustangle_Quote_${payload.client.companyName.replace(/\s+/g, "_")}.xlsx"`,
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
