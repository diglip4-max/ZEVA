import { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Package, User, Clock, CheckCircle, XCircle } from 'lucide-react';
import ClinicLayout from '../../components/clinic/ClinicLayout';
import { withClinicAuth } from '../../../lib/auth';
import { getAuthHeaders } from '../../../lib/auth';

const UserPackagesPage = () => {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchPackages = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const response = await axios.get('/api/clinic/user-packages', {
        headers,
        params: { status: activeTab, search: searchTerm },
      });
      if (response.data.success) {
        setPackages(response.data.packages);
      }
    } catch (error) {
      console.error('Error fetching packages:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPackages();
  }, [activeTab, searchTerm]);

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const tabs = [
    { id: 'pending', label: 'Pending', icon: Clock },
    { id: 'approved', label: 'Approved', icon: CheckCircle },
    { id: 'rejected', label: 'Rejected', icon: XCircle },
  ];

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex flex-col md:flex-row justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Package className="w-6 h-6 text-indigo-600" />
              User Created Packages
            </h1>
            <div className="w-full md:w-1/3 mt-4 md:mt-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by patient name or EMR..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                />
              </div>
            </div>
          </div>

          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-6" aria-label="Tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                    activeTab === tab.id
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="mt-6">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading packages...</p>
              </div>
            ) : packages.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-gray-800">No packages found</h3>
                <p className="text-sm text-gray-500 mt-1">There are no {activeTab} packages matching your search.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {packages.map((pkg) => (
                  <PackageCard key={pkg._id} pkg={pkg} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const PackageCard = ({ pkg }) => {
  const patient = pkg.patientId;
  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    approved: 'bg-green-100 text-green-800 border-green-300',
    rejected: 'bg-red-100 text-red-800 border-red-300',
  };

  return (
    <div className="bg-white rounded-xl border shadow-sm hover:shadow-lg transition-shadow duration-300 overflow-hidden">
      <div className="p-5">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-bold text-gray-900 truncate">{pkg.packageName}</h3>
          <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${statusColors[pkg.approvalStatus]}`}>
            {pkg.approvalStatus}
          </span>
        </div>

        {patient && (
          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
              <User className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-800">{patient.firstName} {patient.lastName}</p>
              <p className="text-xs text-gray-500">EMR: {patient.emrNumber}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
          <div>
            <p className="text-xs text-gray-500">Total Price</p>
            <p className="font-bold text-lg text-gray-800">د.إ{pkg.totalPrice.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Total Sessions</p>
            <p className="font-bold text-lg text-gray-800">{pkg.totalSessions}</p>
          </div>
        </div>

        <div>
          <h4 className="text-xs font-semibold text-gray-600 mb-2">Treatments</h4>
          <div className="space-y-2">
            {pkg.treatments.map((treatment, index) => (
              <div key={index} className="bg-gray-50 p-2 rounded-md flex justify-between items-center">
                <span className="text-xs text-gray-700 truncate">{treatment.treatmentName}</span>
                <span className="text-xs font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">{treatment.sessions} sessions</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="bg-gray-50 px-5 py-3 border-t text-xs text-gray-500 flex justify-between">
        <span>Created: {new Date(pkg.createdAt).toLocaleDateString()}</span>
        {pkg.approvalStatus === 'pending' && (
          <div className="flex gap-2">
            <button className="font-semibold text-green-600 hover:text-green-800">Approve</button>
            <button className="font-semibold text-red-600 hover:text-red-800">Reject</button>
          </div>
        )}
      </div>
    </div>
  );
};

UserPackagesPage.getLayout = function PageLayout(page) {
  return <ClinicLayout>{page}</ClinicLayout>;
};

const ProtectedUserPackagesPage = withClinicAuth(UserPackagesPage);
ProtectedUserPackagesPage.getLayout = UserPackagesPage.getLayout;

export default ProtectedUserPackagesPage;
