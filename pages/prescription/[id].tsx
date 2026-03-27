// pages/prescription/[id].tsx
import React, { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import axios from "axios";
import { FileText, Calendar, User, Pill } from "lucide-react";

interface PrescriptionData {
  _id: string;
  patientName: string;
  doctorName: string;
  medicines: Array<{
    medicineName: string;
    dosage: string;
    duration: string;
    notes: string;
  }>;
  aftercareInstructions: string;
  pdfUrl: string;
  createdAt: string;
}

const PrescriptionViewPage: React.FC = () => {
  const router = useRouter();
  const { id } = router.query;
  
  const [loading, setLoading] = useState(true);
  const [prescription, setPrescription] = useState<PrescriptionData | null>(null);
  const [error, setError] = useState("");
  
  useEffect(() => {
    if (!id) return;
    
    const fetchPrescription = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`/api/public/prescription/${id}`);
        
        if (res.data.success) {
          setPrescription(res.data.prescription);
        } else {
          setError(res.data.message || "Prescription not found");
        }
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to load prescription");
      } finally {
        setLoading(false);
      }
    };
    
    fetchPrescription();
  }, [id]);

  const handleDownloadPdf = () => {
    if (prescription?.pdfUrl) {
      window.open(prescription.pdfUrl, "_blank");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading prescription...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Error</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!prescription) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <p className="text-gray-600">No prescription found</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Prescription - {prescription.patientName}</title>
        <meta name="description" content="View your prescription" />
      </Head>
      
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Header Card */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-6">
            <div className="bg-blue-600 px-6 py-4">
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <Pill className="w-5 h-5" />
                Prescription
              </h1>
            </div>
            
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <User className="w-5 h-5 text-blue-500" />
                <span className="text-sm text-gray-500">Patient</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">{prescription.patientName}</h2>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Doctor</p>
                  <p className="font-semibold text-gray-800">Dr. {prescription.doctorName}</p>
                </div>
                <div>
                  <p className="text-gray-500">Date</p>
                  <p className="font-semibold text-gray-800">
                    {new Date(prescription.createdAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric"
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Medicines Card */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Pill className="w-5 h-5 text-blue-500" />
                Prescribed Medicines
              </h3>
            </div>
            
            <div className="p-6">
              {prescription.medicines && prescription.medicines.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-gray-500">#</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-500">Medicine</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-500">Dosage</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-500">Duration</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-500">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {prescription.medicines.map((med, index) => (
                        <tr key={index}>
                          <td className="px-4 py-3 text-gray-500">{index + 1}</td>
                          <td className="px-4 py-3 font-medium text-gray-800">{med.medicineName}</td>
                          <td className="px-4 py-3 text-gray-600">{med.dosage || "—"}</td>
                          <td className="px-4 py-3 text-gray-600">{med.duration || "—"}</td>
                          <td className="px-4 py-3 text-gray-600">{med.notes || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">No medicines prescribed</p>
              )}
            </div>
          </div>

          {/* Aftercare Instructions Card */}
          {prescription.aftercareInstructions && (
            <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-6">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-500" />
                  Aftercare Instructions
                </h3>
              </div>
              
              <div className="p-6">
                <p className="text-gray-700 whitespace-pre-wrap">{prescription.aftercareInstructions}</p>
              </div>
            </div>
          )}

          {/* Download PDF Button */}
          {prescription.pdfUrl && (
            <button
              onClick={handleDownloadPdf}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-lg"
            >
              <FileText className="w-5 h-5" />
              View/Download PDF
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default PrescriptionViewPage;
