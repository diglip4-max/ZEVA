import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { capitalize, getTokenByPath } from "@/lib/helper";
import Converter from "number-to-words";

const PrintProductSalePage = () => {
  const router = useRouter();
  const { saleId } = router.query;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch product sale data
  useEffect(() => {
    if (!saleId) return;

    const fetchProductSale = async () => {
      try {
        setLoading(true);
        const token = getTokenByPath();
        const response = await fetch(`/api/stocks/product-sales/${saleId}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch product sale");
        }

        const result = await response.json();

        if (result.success && result.data) {
          const saleData = result.data;

          // Calculate totals (no tax)
          let totalAmount = saleData.totalPrice || 0;
          let totalAmountInWords = capitalize(
            Converter.toWords(totalAmount) || "",
          );

          setData({
            patient: {
              name:
                `${saleData.patientId?.firstName || ""} ${saleData.patientId?.lastName || ""}`.trim() ||
                "N/A",
              mobile:
                saleData.patientId?.phone ||
                saleData.patientId?.mobileNumber ||
                "",
              email: saleData.patientId?.email || "",
              age: saleData.patientId?.age || "",
              gender: saleData.patientId?.gender || "",
            },
            sale: {
              invoiceNo: saleData.invoiceNo || saleData._id || "N/A",
              paymentMethod:
                saleData.paymentMethodName ||
                saleData.paymentMethodId?.name ||
                "N/A",
              date: saleData.createdAt
                ? new Date(saleData.createdAt).toLocaleDateString("en-GB")
                : "N/A",
              status: saleData.status || "N/A",
              paymentStatus: saleData.paymentStatus || "N/A",
            },
            items: (saleData.items || []).map((item: any, index: number) => ({
              si: (index + 1).toString(),
              code: item.code || "",
              name: item.name || "",
              description: item.description || "",
              qty: item.quantity
                ? `${item.quantity} - ${item.uom || "Nos"}`
                : "0 - Nos",
              price: String(item.unitPrice || "0.00"),
              total: String(item.totalPrice || "0.00"),
            })),
            summary: {
              subtotal: String(totalAmount.toFixed(2) || "0.00"),
              grandTotal: String(totalAmount.toFixed(2) || "0.00"),
            },
            amountInWords: totalAmountInWords || "",
          });
        } else {
          throw new Error(result.message || "Invalid response format");
        }
      } catch (err: any) {
        setError(err.message || "Error fetching product sale");
        console.error("Error fetching product sale:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProductSale();
  }, [saleId]);

  // Trigger print dialog on component mount after data is loaded
  useEffect(() => {
    if (!loading && data && !error) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loading, data, error]);

  // Show error message
  if (error) {
    return (
      <div className="bg-red-50 min-h-screen flex items-center justify-center p-8">
        <div className="bg-white border border-red-200 rounded-lg p-8 max-w-md text-center">
          <h2 className="text-xl font-bold text-red-600 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.back()}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Show loading message
  if (loading || !data) {
    return (
      <div className="bg-gray-100 min-h-screen flex items-center justify-center">
        <div className="bg-white rounded-lg p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading product sale...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-100 min-h-screen p-0 sm:p-8 text-gray-600 print:bg-white print:p-0">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          body { background: white; }
          .no-print { display: none; }
        }
        .print-container {
          width: 280mm;
          min-height: 297mm;
          margin: 0 auto;
          background: white;
          padding: 15mm;
          font-family: 'Arial', sans-serif;
          font-size: 11px;
        }
        .header-box { background-color: #f3f4f6 !important; border: 1px solid #e5e7eb; padding: 4px 8px; font-weight: bold; color: #4b5563; }
        .info-row { display: flex; margin-bottom: 2px; }
        .label-text { width: 90px; flex-shrink: 0; }
        .separator { width: 20px; text-align: center; }
      `,
        }}
      />

      <div className="print-container shadow-lg print:shadow-none">
        {/* Logo Section */}
        <div className="flex flex-col items-center mb-6">
          <div className="flex items-center gap-2">
            <span className="text-3xl" style={{ color: "#c5a059" }}>
              🌿
            </span>
            <h1 className="text-3xl font-bold" style={{ color: "#c5a059" }}>
              Rama Care
            </h1>
          </div>
          <p className="text-gray-500 font-medium tracking-widest uppercase">
            Poly Clinic
          </p>
        </div>

        <h2 className="text-teal-900 text-lg font-bold mb-4">
          Product Sale Invoice
        </h2>

        {/* Top Details Grid */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="border border-gray-200">
            <div className="header-box">Patient Detail</div>
            <div className="p-2">
              <div className="info-row">
                <span className="label-text">Name</span>
                <span className="separator">:</span>
                <span className="font-bold">{data.patient.name}</span>
              </div>
              <div className="info-row">
                <span className="label-text">Mobile</span>
                <span className="separator">:</span>
                <span>{data.patient.mobile}</span>
              </div>
              <div className="info-row">
                <span className="label-text">Email</span>
                <span className="separator">:</span>
                <span>{data.patient.email}</span>
              </div>
              {data.patient.age && (
                <div className="info-row">
                  <span className="label-text">Age</span>
                  <span className="separator">:</span>
                  <span>{data.patient.age}</span>
                </div>
              )}
              {data.patient.gender && (
                <div className="info-row">
                  <span className="label-text">Gender</span>
                  <span className="separator">:</span>
                  <span>{data.patient.gender}</span>
                </div>
              )}
            </div>
          </div>

          <div className="border border-gray-200">
            <div className="header-box">Invoice Detail</div>
            <div className="p-2">
              <div className="info-row">
                <span className="label-text">Invoice No#</span>
                <span className="separator">:</span>
                <span>{data.sale.invoiceNo}</span>
              </div>
              <div className="info-row">
                <span className="label-text">Date</span>
                <span className="separator">:</span>
                <span>{data.sale.date}</span>
              </div>
              <div className="info-row">
                <span className="label-text">Payment Method</span>
                <span className="separator">:</span>
                <span>{data.sale.paymentMethod}</span>
              </div>
              <div className="info-row">
                <span className="label-text">Status</span>
                <span className="separator">:</span>
                <span className="capitalize">{data.sale.status}</span>
              </div>
              <div className="info-row">
                <span className="label-text">Payment Status</span>
                <span className="separator">:</span>
                <span className="capitalize">{data.sale.paymentStatus}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="border border-gray-200">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="header-box text-[9px] uppercase border-b border-gray-200">
                <th className="p-1 border-r border-gray-200 w-8">SI</th>
                <th className="p-1 border-r border-gray-200">
                  Item Code / Name
                </th>
                <th className="p-1 border-r border-gray-200">Description</th>
                <th className="p-1 border-r border-gray-200 text-right">
                  Qty-UoM
                </th>
                <th className="p-1 border-r border-gray-200 text-right">
                  Unit Price (AED)
                </th>
                <th className="p-1 text-right">Total (AED)</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item: any, idx: number) => (
                <tr
                  key={idx}
                  className="border-b border-gray-200 last:border-0"
                >
                  <td className="p-1 border-r border-gray-200 text-center">
                    {item.si}
                  </td>
                  <td className="p-1 border-r border-gray-200 font-bold">
                    {item.code}
                    <br />
                    <span className="text-[9px] font-normal uppercase">
                      {item.name}
                    </span>
                  </td>
                  <td className="p-1 border-r border-gray-200 italic">
                    {item?.description || "N/A"}
                  </td>
                  <td className="p-1 border-r border-gray-200 text-right">
                    {item.qty}
                  </td>
                  <td className="p-1 border-r border-gray-200 text-right">
                    {item.price}
                  </td>
                  <td className="p-1 text-right font-bold">{item.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-12 border-x border-b border-gray-200">
          <div className="col-span-8 p-2 border-r border-gray-200 italic">
            <p className="font-bold">
              Amount In Words : {`${data.amountInWords} Only` || "N/A"}. /-
            </p>
          </div>
          <div className="col-span-4">
            {[
              ["Subtotal (in AED)", data.summary.subtotal],
              ["Grand Total (in AED)", data.summary.grandTotal, true],
            ].map(([label, val, bold], i) => (
              <div
                key={i}
                className={`flex justify-between p-1 border-b border-gray-100 last:border-0 ${bold ? "font-bold" : ""}`}
              >
                <span>{label}</span>
                <span>{val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between mt-12 px-2 italic">
          <div>
            <p className="font-bold">Prepared by</p>
            <p className="mt-4">_________________</p>
          </div>
          <div className="text-right">
            <p className="font-bold">Received by</p>
            <p className="mt-4">_________________</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// 👇 Remove layout for this page
PrintProductSalePage.getLayout = function PageLayout(page: React.ReactNode) {
  return page;
};

export default PrintProductSalePage;
