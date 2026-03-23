import React from "react";
import { FileSpreadsheet, FileText, File as FilePdf } from "lucide-react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface ExportButtonsProps {
  data: any[];
  filename: string;
  headers: string[];
  title: string;
}

const ExportButtons: React.FC<ExportButtonsProps> = ({ data, filename, headers, title }) => {
  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
    XLSX.writeFile(workbook, `${filename}.xlsx`);
  };

  const exportToCSV = () => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text(title, 14, 15);
    
    // Get the keys from the first data object to ensure consistent column order
    const keys = data.length > 0 ? Object.keys(data[0]) : [];
    const tableData = data.map(item => keys.map(key => item[key]));
    
    autoTable(doc, {
      head: [headers],
      body: tableData,
      startY: 20,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [45, 154, 165] } // Teal color #2D9AA5
    });
    doc.save(`${filename}.pdf`);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={exportToCSV}
        className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded text-sm transition-colors shadow-sm"
        title="Download CSV"
      >
        <FileText className="w-4 h-4 text-green-600" />
        CSV
      </button>
      <button
        onClick={exportToExcel}
        className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded text-sm transition-colors shadow-sm"
        title="Download Excel"
      >
        <FileSpreadsheet className="w-4 h-4 text-teal-600" />
        Excel
      </button>
      <button
        onClick={exportToPDF}
        className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded text-sm transition-colors shadow-sm"
        title="Download PDF"
      >
        <FilePdf className="w-4 h-4 text-red-600" />
        PDF
      </button>
    </div>
  );
};

export default ExportButtons;
