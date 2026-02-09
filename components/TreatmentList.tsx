import { useState, useEffect } from "react";
import axios from "axios";
import { getAuthHeaders } from "../lib/helper";

interface Treatment {
  _id: string;
  name: string;
  slug: string;
  subcategories: Array<{
    name: string;
    slug: string;
    price?: number;
  }>;
}

const TreatmentList = () => {
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTreatments = async () => {
      try {
        const authHeaders = getAuthHeaders();
        if (!authHeaders) {
          throw new Error("Authentication required");
        }

        const response = await axios.get("/api/doctor/getTreatment", {
          headers: authHeaders,
        });

        setTreatments(response.data.treatments || []);
      } catch (err) {
        console.error("Error fetching treatments:", err);
        setError("Failed to load treatments. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchTreatments();
  }, []);

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
        <p className="text-red-600 text-center">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-5 sm:p-6">
        <h3 className="text-lg font-bold text-teal-900 mb-4 flex items-center gap-2">
          <span className="p-2 bg-teal-100 rounded-lg">
            <span className="text-teal-700 font-bold">⚕️</span>
          </span>
          Available Treatments
        </h3>
        
        <div className="space-y-4">
          {treatments.map((treatment) => (
            <div key={treatment._id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-teal-800 text-base">
                  {treatment.name}
                </h4>
                <span className="text-xs bg-teal-600 text-white px-2 py-1 rounded-full">
                  {treatment.subcategories.length} services
                </span>
              </div>
              
              {treatment.subcategories.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {treatment.subcategories.map((subcategory, index) => (
                    <div 
                      key={index} 
                      className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-100"
                    >
                      <span className="text-sm text-gray-700">{subcategory.name}</span>
                      {subcategory.price !== undefined && subcategory.price > 0 && (
                        <span className="text-sm font-medium text-teal-700">
                          ₹{subcategory.price}
                        </span>
                      )}
                      {subcategory.price === 0 && (
                        <span className="text-xs text-gray-500 italic">Free</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">No subcategories available</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TreatmentList;