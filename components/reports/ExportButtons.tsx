import React, { useState } from "react";
import { FileSpreadsheet, FileText, File as FilePdf, ChevronDown, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export interface ExportSection {
  title: string;
  headers: string[];
  data: any[];
}

interface ExportButtonsProps {
  /** Legacy single-section usage */
  data?: any[];
  filename: string;
  headers?: string[];
  title: string;
  /** Multi-section usage: each entry becomes its own sheet/section */
  sections?: ExportSection[];
}

const ExportButtons: React.FC<ExportButtonsProps> = ({ data, filename, headers, title, sections }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Normalise: always work with an array of sections
  const allSections: ExportSection[] = sections && sections.length > 0
    ? sections
    : [{ title, headers: headers || (data && data.length > 0 ? Object.keys(data[0]) : []), data: data || [] }];

  // ── Excel ──────────────────────────────────────────────────────────────────
  const exportToExcel = () => {
    const workbook = XLSX.utils.book_new();
    allSections.forEach((section, idx) => {
      const rows = section.data.length > 0 ? section.data : [{}];
      // Build rows using only the declared header order
      const sheetData = rows.map((item: any) =>
        section.headers.reduce((acc: any, h) => { acc[h] = item[h] ?? ""; return acc; }, {})
      );
      const worksheet = XLSX.utils.json_to_sheet(sheetData, { header: section.headers });
      // Sheet names must be ≤ 31 chars and unique
      let sheetName = section.title.replace(/[\\\/:*?[\]]/g, "").slice(0, 28);
      if (workbook.SheetNames.includes(sheetName)) sheetName = `${sheetName}_${idx + 1}`;
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    });
    XLSX.writeFile(workbook, `${filename}.xlsx`);
  };

  // ── ODS ────────────────────────────────────────────────────────────────────
  const exportToODS = () => {
    const workbook = XLSX.utils.book_new();
    allSections.forEach((section, idx) => {
      const rows = section.data.length > 0 ? section.data : [{}];
      const sheetData = rows.map((item: any) =>
        section.headers.reduce((acc: any, h) => { acc[h] = item[h] ?? ""; return acc; }, {})
      );
      const worksheet = XLSX.utils.json_to_sheet(sheetData, { header: section.headers });
      let sheetName = section.title.replace(/[\\\/:*?[\]]/g, "").slice(0, 28);
      if (workbook.SheetNames.includes(sheetName)) sheetName = `${sheetName}_${idx + 1}`;
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    });
    XLSX.writeFile(workbook, `${filename}.ods`, { bookType: "ods" });
  };

  // ── CSV ────────────────────────────────────────────────────────────────────
  const exportToCSV = () => {
    const csvParts: string[] = [];
    allSections.forEach((section) => {
      // Section title header
      csvParts.push(`"=== ${section.title} ==="`);
      if (section.data.length === 0) {
        csvParts.push(section.headers.map(h => `"${h}"`).join(","));
        csvParts.push("");
        return;
      }
      const rows = section.data.map((item: any) =>
        section.headers.reduce((acc: any, h) => { acc[h] = item[h] ?? ""; return acc; }, {})
      );
      const worksheet = XLSX.utils.json_to_sheet(rows, { header: section.headers });
      csvParts.push(XLSX.utils.sheet_to_csv(worksheet));
      csvParts.push(""); // blank line separator
    });
    const csv = csvParts.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", `${filename}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── PDF ────────────────────────────────────────────────────────────────────
  const exportToPDF = () => {
    const doc = new jsPDF();
    let currentY = 15;
    doc.setFontSize(14);
    doc.text(title, 14, currentY);
    currentY += 8;

    allSections.forEach((section) => {
      doc.setFontSize(11);
      doc.setTextColor(45, 154, 165);
      doc.text(section.title, 14, currentY);
      currentY += 4;
      doc.setTextColor(0, 0, 0);

      const rows = section.data.length > 0
        ? section.data.map((item: any) => section.headers.map(h => String(item[h] ?? "")))
        : [[...section.headers.map(() => "")]];

      autoTable(doc, {
        head: [section.headers],
        body: rows,
        startY: currentY,
        styles: { fontSize: 7 },
        headStyles: { fillColor: [45, 154, 165] },
        margin: { left: 14, right: 14 },
      });
      currentY = (doc as any).lastAutoTable.finalY + 10;
    });

    doc.save(`${filename}.pdf`);
  };

  // ── ODF (Text Document) ───────────────────────────────────────────────────
  const exportToODF = () => {
    const odfContent = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0">
  <office:body>
    <office:text>
      <text:p text:style-name="Heading">${title}</text:p>
${allSections.map(section => `
      <text:p text:style-name="Heading2">${section.title}</text:p>
      <text:table table:name="${section.title.replace(/\s+/g, '_')}">
        <text:table-header-rows>
          <text:table-row>
            ${section.headers.map(header => `<text:table-cell><text:p>${header}</text:p></text:table-cell>`).join('')}
          </text:table-row>
        </text:table-header-rows>
        <text:table-rows>
          ${section.data.map(row => `<text:table-row>${section.headers.map(header => `<text:table-cell><text:p>${String(row[header] ?? '')}</text:p></text:table-cell>`).join('')}</text:table-row>`).join('')}
        </text:table-rows>
      </text:table>`).join('')}
    </office:text>
  </office:body>
</office:document-content>`;
    
    const blob = new Blob([odfContent], { type: "application/vnd.oasis.opendocument.text" });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", `${filename}.odt`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportFunctions = {
    CSV: exportToCSV,
    Excel: exportToExcel,
    PDF: exportToPDF,
    ODS: exportToODS,
    ODF: exportToODF
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700"
      >
        <Download className="w-4 h-4" />
        <span>Export</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          {Object.entries(exportFunctions).map(([format, fn]) => (
            <button
              key={format}
              onClick={() => {
                fn();
                setIsOpen(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
            >
              {format === 'CSV' && <FileText className="w-4 h-4 text-green-600" />}
              {format === 'Excel' && <FileSpreadsheet className="w-4 h-4 text-teal-600" />}
              {format === 'PDF' && <FilePdf className="w-4 h-4 text-red-600" />}
              {format === 'ODS' && <FileSpreadsheet className="w-4 h-4 text-blue-600" />}
              {format === 'ODF' && <FileText className="w-4 h-4 text-purple-600" />}
              {format}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ExportButtons;
