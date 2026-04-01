"use client";
import React from 'react';
import { Package, CheckCircle, Clock } from 'lucide-react';

const UserPackagesGuide: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-6">
      <div className="flex items-center gap-3 mb-8">
        <Package className="w-10 h-10 text-teal-600" />
        <h2 className="text-3xl font-bold text-gray-900">User Packages</h2>
      </div>
      
      <div className="prose max-w-none">
        <h3 className="text-2xl font-semibold text-gray-800 mb-4">User Created Packages - Complete Guide</h3>
        <p className="text-base text-gray-600 mb-8 leading-relaxed">
          The User Packages module allows clinics to review, approve, and manage treatment packages 
          created by patients. This comprehensive guide covers both Pending Approval and Approved 
          packages sections with detailed explanations of all features.
        </p>
        
        {/* Overview Section */}
        <div className="bg-gradient-to-r from-teal-50 to-blue-50 border-l-4 border-teal-500 p-8 mb-10 rounded-r-lg">
          <h4 className="font-bold text-lg text-teal-900 mb-5 flex items-center gap-2">
            <span className="flex items-center justify-center w-10 h-10 bg-teal-600 text-white rounded-full text-base font-bold">1</span>
            Overview & Navigation
          </h4>
          <div className="ml-12 space-y-4">
            <p className="text-base text-teal-800 leading-relaxed">
              The User Packages page is divided into two main tabs that help you manage patient-created treatment packages:
            </p>
            <ul className="list-disc list-inside space-y-3 text-base text-teal-700">
              <li><strong>Pending Approval Tab:</strong> View packages awaiting clinic review and approval</li>
              <li><strong>Approved Packages Tab:</strong> Access all packages that have been approved and are active</li>
              <li><strong>Search Functionality:</strong> Find packages by patient name or EMR number</li>
              <li><strong>Real-time Counters:</strong> See pending and approved package counts at the top</li>
            </ul>
            
            {/* Image Upload Section */}
            <div className="mt-6 bg-white rounded-lg border-2 border-dashed border-teal-300 p-6">
              <div className="flex items-center gap-3 mb-4">
                <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h5 className="font-semibold text-teal-900 text-base">Screenshot Upload Area</h5>
              </div>
              <div className="bg-teal-50 rounded-lg p-8 text-center border-2 border-dashed border-teal-200">
                <p className="text-teal-700 text-sm mb-2"><strong>Upload:</strong> /user-packages-overview.png</p>
                <p className="text-teal-600 text-xs">Drag & drop or click to upload screenshot of main packages page with both tabs</p>
              </div>
            </div>
            
            <div className="mt-4 p-4 bg-white rounded-lg border border-teal-200">
              <p className="text-sm text-teal-700"><strong>💡 Pro Tip:</strong> Regularly check the Pending Approval tab to ensure timely review of patient requests and maintain good patient engagement.</p>
            </div>
          </div>
        </div>

        {/* Pending Approval Section */}
        <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border-l-4 border-yellow-500 p-8 mb-10 rounded-r-lg">
          <h4 className="font-bold text-lg text-yellow-900 mb-5 flex items-center gap-2">
            <span className="flex items-center justify-center w-10 h-10 bg-yellow-600 text-white rounded-full text-base font-bold">2</span>
            Pending Approval Packages
          </h4>
          <div className="ml-12 space-y-4">
            <p className="text-base text-yellow-800 leading-relaxed">
              The Pending Approval section displays all treatment packages created by patients that require clinic review:
            </p>
            <ul className="list-disc list-inside space-y-3 text-base text-yellow-700">
              <li><strong>Purpose:</strong> Review patient-created treatment packages before activation</li>
              <li><strong>Badge Counter:</strong> Yellow badge shows total pending packages count</li>
              <li><strong>Package Cards:</strong> Each package displays key information in card format</li>
              <li><strong>View Details Button:</strong> Click to see complete package information</li>
              <li><strong>Yellow Theme:</strong> Visual indicator for "awaiting action" status</li>
            </ul>
            
            {/* What to Check */}
            <div className="mt-4 bg-white rounded-lg border border-yellow-200 p-4">
              <h5 className="font-semibold text-yellow-900 mb-2">What to Verify Before Approval:</h5>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>✓ Patient information and EMR number</li>
                <li>✓ Package name and description accuracy</li>
                <li>✓ Total price calculation</li>
                <li>✓ Number of sessions allocated</li>
                <li>✓ Treatment selections and pricing</li>
                <li>✓ Start and end dates validity</li>
                <li>✓ Payment status confirmation</li>
              </ul>
            </div>
            
            {/* Image Upload Section */}
            <div className="mt-6 bg-white rounded-lg border-2 border-dashed border-yellow-300 p-6">
              <div className="flex items-center gap-3 mb-4">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h5 className="font-semibold text-yellow-900 text-base">Screenshot Upload Area</h5>
              </div>
              <div className="bg-yellow-50 rounded-lg p-8 text-center border-2 border-dashed border-yellow-200">
                <p className="text-yellow-700 text-sm mb-2"><strong>Upload:</strong> /user-packages-pending.png</p>
                <p className="text-yellow-600 text-xs">Drag & drop or click to upload screenshot of pending approval tab</p>
              </div>
            </div>
          </div>
        </div>

        {/* Approved Packages Section */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500 p-8 mb-10 rounded-r-lg">
          <h4 className="font-bold text-lg text-green-900 mb-5 flex items-center gap-2">
            <span className="flex items-center justify-center w-10 h-10 bg-green-600 text-white rounded-full text-base font-bold">3</span>
            Approved Packages
          </h4>
          <div className="ml-12 space-y-4">
            <p className="text-base text-green-800 leading-relaxed">
              The Approved Packages section shows all packages that have been reviewed and activated:
            </p>
            <ul className="list-disc list-inside space-y-3 text-base text-green-700">
              <li><strong>Active Packages:</strong> All approved and ongoing treatment packages</li>
              <li><strong>Green Badge:</strong> Green counter showing total approved packages</li>
              <li><strong>Status Tracking:</strong> Monitor package progress and session usage</li>
              <li><strong>Complete History:</strong> Access to all approved package details</li>
              <li><strong>Session Monitoring:</strong> Track used vs remaining sessions</li>
            </ul>
            
            {/* Image Upload Section */}
            <div className="mt-6 bg-white rounded-lg border-2 border-dashed border-green-300 p-6">
              <div className="flex items-center gap-3 mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h5 className="font-semibold text-green-900 text-base">Screenshot Upload Area</h5>
              </div>
              <div className="bg-green-50 rounded-lg p-8 text-center border-2 border-dashed border-green-200">
                <p className="text-green-700 text-sm mb-2"><strong>Upload:</strong> /user-packages-approved.png</p>
                <p className="text-green-600 text-xs">Drag & drop or click to upload screenshot of approved packages tab</p>
              </div>
            </div>
          </div>
        </div>

        {/* Package Card Components Section */}
        <div className="bg-gradient-to-r from-purple-50 to-violet-50 border-l-4 border-purple-500 p-8 mb-10 rounded-r-lg">
          <h4 className="font-bold text-lg text-purple-900 mb-5 flex items-center gap-2">
            <span className="flex items-center justify-center w-10 h-10 bg-purple-600 text-white rounded-full text-base font-bold">4</span>
            Package Card Information
          </h4>
          <div className="ml-12 space-y-4">
            <p className="text-base text-purple-800 leading-relaxed">
              Each package card displays comprehensive information about the patient's treatment package:
            </p>
            
            <div className="space-y-4">
              {/* Card Header */}
              <div className="bg-white p-4 rounded-lg border border-purple-200">
                <h5 className="font-semibold text-purple-900 mb-2">Card Header (Purple/Indigo Gradient):</h5>
                <ul className="text-sm text-purple-700 space-y-2">
                  <li><strong>Package Name:</strong> Displayed prominently at the top</li>
                  <li><strong>Patient Name:</strong> With user icon for easy identification</li>
                  <li><strong>EMR Number:</strong> Small badge showing patient's EMR ID (if available)</li>
                </ul>
              </div>
              
              {/* Price & Sessions */}
              <div className="bg-white p-4 rounded-lg border border-purple-200">
                <h5 className="font-semibold text-purple-900 mb-2">Price & Sessions Grid:</h5>
                <ul className="text-sm text-purple-700 space-y-2">
                  <li><strong>Total Price:</strong> Large display with rupee symbol (e.g., ₹25,000)</li>
                  <li><strong>Sessions:</strong> Shows remaining/total sessions (e.g., 8/10)</li>
                  <li><strong>Visual Layout:</strong> Two-column grid with gray background boxes</li>
                  <li><strong>Icons:</strong> Dollar sign for price, package icon for sessions</li>
                </ul>
              </div>
              
              {/* Status Badges */}
              <div className="bg-white p-4 rounded-lg border border-purple-200">
                <h5 className="font-semibold text-purple-900 mb-2">Status Badges:</h5>
                <ul className="text-sm text-purple-700 space-y-2">
                  <li><strong>Package Status:</strong> Color-coded badges (Active=Green, Completed=Blue, Expired=Red, Cancelled=Gray)</li>
                  <li><strong>Payment Status:</strong> Payment tracking (Paid=Green, Pending=Yellow, Partial=Orange)</li>
                  <li><strong>Border Styling:</strong> Each badge has colored border matching its theme</li>
                </ul>
              </div>
              
              {/* Date Range */}
              <div className="bg-white p-4 rounded-lg border border-purple-200">
                <h5 className="font-semibold text-purple-900 mb-2">Date Information:</h5>
                <ul className="text-sm text-purple-700 space-y-2">
                  <li><strong>Start Date:</strong> When the package becomes active</li>
                  <li><strong>End Date:</strong> Package expiration date</li>
                  <li><strong>Calendar Icons:</strong> Visual indicators for each date</li>
                  <li><strong>Format:</strong> Month Day, Year (e.g., Jan 15, 2024)</li>
                </ul>
              </div>
              
              {/* Treatments List */}
              <div className="bg-white p-4 rounded-lg border border-purple-200">
                <h5 className="font-semibold text-purple-900 mb-2">Treatments Section:</h5>
                <ul className="text-sm text-purple-700 space-y-2">
                  <li><strong>Treatment Names:</strong> List of all treatments included in package</li>
                  <li><strong>Session Tracking:</strong> Used/Total sessions for each treatment</li>
                  <li><strong>Individual Pricing:</strong> Price allocated to each treatment</li>
                  <li><strong>Scrollable List:</strong> Max height with overflow for long lists</li>
                  <li><strong>Trending Icon:</strong> Shows treatment count badge</li>
                </ul>
              </div>
            </div>
            
            {/* Image Upload Section */}
            <div className="mt-6 bg-white rounded-lg border-2 border-dashed border-purple-300 p-6">
              <div className="flex items-center gap-3 mb-4">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h5 className="font-semibold text-purple-900 text-base">Screenshot Upload Area</h5>
              </div>
              <div className="bg-purple-50 rounded-lg p-8 text-center border-2 border-dashed border-purple-200">
                <p className="text-purple-700 text-sm mb-2"><strong>Upload:</strong> /user-packages-card-details.png</p>
                <p className="text-purple-600 text-xs">Drag & drop or click to upload screenshot of package card breakdown</p>
              </div>
            </div>
          </div>
        </div>

        {/* Package Details Modal Section */}
        <div className="bg-gradient-to-r from-cyan-50 to-sky-50 border-l-4 border-cyan-500 p-8 mb-10 rounded-r-lg">
          <h4 className="font-bold text-lg text-cyan-900 mb-5 flex items-center gap-2">
            <span className="flex items-center justify-center w-10 h-10 bg-cyan-600 text-white rounded-full text-base font-bold">5</span>
            Package Details Modal (Full View)
          </h4>
          <div className="ml-12 space-y-4">
            <p className="text-base text-cyan-800 leading-relaxed">
              Click "View Details" to open a comprehensive modal with complete package information:
            </p>
            
            <div className="space-y-4">
              {/* Modal Header */}
              <div className="bg-white p-4 rounded-lg border border-cyan-200">
                <h5 className="font-semibold text-cyan-900 mb-2">Modal Header:</h5>
                <ul className="text-sm text-cyan-700 space-y-2">
                  <li><strong>Gradient Background:</strong> Indigo to purple gradient</li>
                  <li><strong>Package Name:</strong> Large white text title</li>
                  <li><strong>Close Button:</strong> X icon to dismiss modal</li>
                  <li><strong>Sticky Position:</strong> Header stays visible on scroll</li>
                </ul>
              </div>
              
              {/* Patient Information Section */}
              <div className="bg-white p-4 rounded-lg border border-cyan-200">
                <h5 className="font-semibold text-cyan-900 mb-2">Patient Information Box:</h5>
                <ul className="text-sm text-cyan-700 space-y-2">
                  <li><strong>Gray Background:</strong> Light gray box with rounded corners</li>
                  <li><strong>User Icon:</strong> Visual indicator for patient section</li>
                  <li><strong>Patient Name:</strong> Full name display</li>
                  <li><strong>EMR Number:</strong> Medical record number if available</li>
                  <li><strong>Two-Column Grid:</strong> Side-by-side information layout</li>
                </ul>
              </div>
              
              {/* Package Overview Cards */}
              <div className="bg-white p-4 rounded-lg border border-cyan-200">
                <h5 className="font-semibold text-cyan-900 mb-2">Three Overview Cards:</h5>
                <ul className="text-sm text-cyan-700 space-y-2">
                  <li><strong>Price Card (Blue):</strong> Total package price with dollar icon</li>
                  <li><strong>Sessions Card (Green):</strong> Remaining/Total sessions with package icon</li>
                  <li><strong>Duration Card (Purple):</strong> Start to end date range with calendar icon</li>
                  <li><strong>Gradient Backgrounds:</strong> Each card has distinct color theme</li>
                  <li><strong>Large Numbers:</strong> Prominent display of key metrics</li>
                </ul>
              </div>
              
              {/* Status Information */}
              <div className="bg-white p-4 rounded-lg border border-cyan-200">
                <h5 className="font-semibold text-cyan-900 mb-2">Status Display:</h5>
                <ul className="text-sm text-cyan-700 space-y-2">
                  <li><strong>Package Status:</strong> Active/Completed/Expired/Cancelled</li>
                  <li><strong>Payment Status:</strong> Paid/Pending/Partial payment</li>
                  <li><strong>Color-Coded Badges:</strong> Matching the card color scheme</li>
                  <li><strong>Side-by-Side:</strong> Two columns for easy comparison</li>
                </ul>
              </div>
              
              {/* Detailed Treatments List */}
              <div className="bg-white p-4 rounded-lg border border-cyan-200">
                <h5 className="font-semibold text-cyan-900 mb-2">Treatments Breakdown:</h5>
                <ul className="text-sm text-cyan-700 space-y-2">
                  <li><strong>Treatment Name:</strong> Full name of each treatment</li>
                  <li><strong>Treatment Slug:</strong> Technical identifier for the treatment</li>
                  <li><strong>Allocated Price:</strong> Amount assigned to this treatment</li>
                  <li><strong>Session Usage:</strong> Used sessions out of total allocated</li>
                  <li><strong>Progress Bar:</strong> Visual indicator of session completion percentage</li>
                  <li><strong>Percentage Display:</strong> Exact % shown above progress bar</li>
                </ul>
              </div>
              
              {/* Additional Information */}
              <div className="bg-white p-4 rounded-lg border border-cyan-200">
                <h5 className="font-semibold text-cyan-900 mb-2">Additional Info Section:</h5>
                <ul className="text-sm text-cyan-700 space-y-2">
                  <li><strong>Created At:</strong> Package creation timestamp</li>
                  <li><strong>Session Price:</strong> Cost per individual session</li>
                  <li><strong>Gray Background:</strong> Consistent with info boxes</li>
                  <li><strong>Two-Column Layout:</strong> Clean information display</li>
                </ul>
              </div>
            </div>
            
            {/* Image Upload Section */}
            <div className="mt-6 bg-white rounded-lg border-2 border-dashed border-cyan-300 p-6">
              <div className="flex items-center gap-3 mb-4">
                <svg className="w-6 h-6 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h5 className="font-semibold text-cyan-900 text-base">Screenshot Upload Area</h5>
              </div>
              <div className="bg-cyan-50 rounded-lg p-8 text-center border-2 border-dashed border-cyan-200">
                <p className="text-cyan-700 text-sm mb-2"><strong>Upload:</strong> /user-packages-modal-details.png</p>
                <p className="text-cyan-600 text-xs">Drag & drop or click to upload screenshot of full details modal</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search & Filter Section */}
        <div className="bg-gradient-to-r from-rose-50 to-pink-50 border-l-4 border-rose-500 p-8 mb-10 rounded-r-lg">
          <h4 className="font-bold text-lg text-rose-900 mb-5 flex items-center gap-2">
            <span className="flex items-center justify-center w-10 h-10 bg-rose-600 text-white rounded-full text-base font-bold">6</span>
            Search & Filter Functionality
          </h4>
          <div className="ml-12 space-y-4">
            <p className="text-base text-rose-800 leading-relaxed">
              Quickly find specific packages using the powerful search feature:
            </p>
            <ul className="list-disc list-inside space-y-3 text-base text-rose-700">
              <li><strong>Search Bar:</strong> Located below the header with search icon</li>
              <li><strong>Search By:</strong> Patient first name, last name, or EMR number</li>
              <li><strong>Real-time Filtering:</strong> Results update as you type</li>
              <li><strong>Clear Placeholder:</strong> "Search by patient name or EMR number..."</li>
              <li><strong>Focus State:</strong> Indigo ring appears when active</li>
              <li><strong>No Results Message:</strong> Helpful prompt to adjust search criteria</li>
            </ul>
            
            {/* Image Upload Section */}
            <div className="mt-6 bg-white rounded-lg border-2 border-dashed border-rose-300 p-6">
              <div className="flex items-center gap-3 mb-4">
                <svg className="w-6 h-6 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h5 className="font-semibold text-rose-900 text-base">Screenshot Upload Area</h5>
              </div>
              <div className="bg-rose-50 rounded-lg p-8 text-center border-2 border-dashed border-rose-200">
                <p className="text-rose-700 text-sm mb-2"><strong>Upload:</strong> /user-packages-search.png</p>
                <p className="text-rose-600 text-xs">Drag & drop or click to upload screenshot of search functionality in action</p>
              </div>
            </div>
          </div>
        </div>

        {/* Status Color Codes Reference Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-4">
            <h4 className="font-bold text-white text-lg">Quick Reference: Status Color Codes</h4>
          </div>
          <div className="p-6">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Value</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Color</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Meaning</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <tr>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">Package Status</td>
                  <td className="px-4 py-3 text-sm text-gray-900">Active</td>
                  <td className="px-4 py-3 text-sm"><span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">Green</span></td>
                  <td className="px-4 py-3 text-sm text-gray-700">Currently ongoing package</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">Package Status</td>
                  <td className="px-4 py-3 text-sm text-gray-900">Completed</td>
                  <td className="px-4 py-3 text-sm"><span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">Blue</span></td>
                  <td className="px-4 py-3 text-sm text-gray-700">All sessions finished</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">Package Status</td>
                  <td className="px-4 py-3 text-sm text-gray-900">Expired</td>
                  <td className="px-4 py-3 text-sm"><span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs">Red</span></td>
                  <td className="px-4 py-3 text-sm text-gray-700">Past end date</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">Package Status</td>
                  <td className="px-4 py-3 text-sm text-gray-900">Cancelled</td>
                  <td className="px-4 py-3 text-sm"><span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs">Gray</span></td>
                  <td className="px-4 py-3 text-sm text-gray-700">Package cancelled</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">Payment Status</td>
                  <td className="px-4 py-3 text-sm text-gray-900">Paid</td>
                  <td className="px-4 py-3 text-sm"><span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">Green</span></td>
                  <td className="px-4 py-3 text-sm text-gray-700">Full payment received</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">Payment Status</td>
                  <td className="px-4 py-3 text-sm text-gray-900">Pending</td>
                  <td className="px-4 py-3 text-sm"><span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs">Yellow</span></td>
                  <td className="px-4 py-3 text-sm text-gray-700">Payment awaiting</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">Payment Status</td>
                  <td className="px-4 py-3 text-sm text-gray-900">Partial</td>
                  <td className="px-4 py-3 text-sm"><span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs">Orange</span></td>
                  <td className="px-4 py-3 text-sm text-gray-700">Partially paid</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Key Data Points Summary */}
        <div className="bg-gradient-to-r from-teal-50 to-blue-50 border-l-4 border-teal-500 p-8 rounded-lg">
          <h4 className="font-bold text-xl text-teal-900 mb-4">Key Data Points Explained</h4>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h5 className="font-semibold text-teal-800 mb-2">Financial Information:</h5>
              <ul className="space-y-2 text-sm text-teal-700">
                <li><strong>Total Price:</strong> Complete package cost</li>
                <li><strong>Session Price:</strong> Per-session rate</li>
                <li><strong>Allocated Price:</strong> Amount per treatment</li>
                <li><strong>Payment Status:</strong> Payment tracking</li>
              </ul>
            </div>
            <div>
              <h5 className="font-semibold text-teal-800 mb-2">Session Management:</h5>
              <ul className="space-y-2 text-sm text-teal-700">
                <li><strong>Total Sessions:</strong> Package session count</li>
                <li><strong>Remaining Sessions:</strong> Sessions left to use</li>
                <li><strong>Used Sessions:</strong> Consumed sessions</li>
                <li><strong>Progress Tracking:</strong> Visual completion %</li>
              </ul>
            </div>
            <div>
              <h5 className="font-semibold text-teal-800 mb-2">Patient Details:</h5>
              <ul className="space-y-2 text-sm text-teal-700">
                <li><strong>Patient Name:</strong> First + Last name</li>
                <li><strong>EMR Number:</strong> Medical record ID</li>
                <li><strong>Patient ID:</strong> Unique identifier</li>
              </ul>
            </div>
            <div>
              <h5 className="font-semibold text-teal-800 mb-2">Timeline:</h5>
              <ul className="space-y-2 text-sm text-teal-700">
                <li><strong>Start Date:</strong> Package activation</li>
                <li><strong>End Date:</strong> Package expiration</li>
                <li><strong>Created At:</strong> Creation timestamp</li>
                <li><strong>Duration:</strong> Validity period</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserPackagesGuide;
