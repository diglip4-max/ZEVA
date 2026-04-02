"use client";
import React from 'react';
import { Briefcase, CheckCircle } from 'lucide-react';

interface SubItemProps {
  label: string;
  icon: string;
  description: string;
  fields: string[];
  tips?: string[];
}

const subItemsData: Record<string, SubItemProps> = {
  "manage-health-center": {
    label: "Manage Health Center",
    icon: "🏥",
    description: "Complete guide to managing your health center profile, settings, and multi-branch operations.",
    fields: [
      "Clinic Name & Branding",
      "Username/Slug for profile URL",
      "Consultation Fee Configuration",
      "Contact Information Management",
      "Document Upload & Verification",
      "Listing Visibility Toggles",
      "Clinic Timing & Hours",
      "Multiple Branches Management"
    ],
    tips: [
      "Keep all clinic information up-to-date",
      "Use high-quality images for better engagement",
      "Verify contact details regularly",
      "Toggle visibility settings based on your preferences"
    ]
  },
  "create-offers": {
    label: "Create Offers",
    icon: "🎁",
    description: "Create and manage promotional offers to attract new patients and retain existing ones.",
    fields: [
      "Offer Title & Description",
      "Discount Percentage or Fixed Amount",
      "Validity Period",
      "Target Audience Selection",
      "Terms & Conditions",
      "Promotional Images",
      "Usage Limits"
    ],
    tips: [
      "Create time-limited offers for urgency",
      "Use attractive visuals",
      "Set clear terms and conditions"
    ]
  },
  "user-package": {
    label: "User Package",
    icon: "📦",
    description: "Design comprehensive healthcare packages for different patient needs.",
    fields: [
      "Package Name & Type",
      "Included Services",
      "Pricing Strategy",
      "Validity Duration",
      "Eligibility Criteria",
      "Booking Restrictions"
    ],
    tips: [
      "Bundle complementary services together",
      "Offer competitive pricing",
      "Clear package benefits communication"
    ]
  },
  "service-setup": {
    label: "Service Setup",
    icon: "⚙️",
    description: "Configure and organize your clinic's services catalog.",
    fields: [
      "Service Name & Category",
      "Service Description",
      "Duration & Pricing",
      "Staff Assignment",
      "Resource Requirements",
      "Availability Settings"
    ],
    tips: [
      "Organize services into logical categories",
      "Set accurate durations for scheduling",
      "Include detailed service descriptions"
    ]
  },
  "setup-operation": {
    label: "Setup & Operation",
    icon: "🏢",
    description: "Initial clinic setup including rooms, departments, and operational configuration.",
    fields: [
      "Room/Department Creation",
      "Equipment Assignment",
      "Staff Allocation",
      "Operating Hours",
      "Capacity Settings",
      "Integration with Other Modules"
    ],
    tips: [
      "Plan your layout before setup",
      "Assign resources efficiently",
      "Test all configurations before going live"
    ]
  }
};

interface ManageHealthCenterGuideProps {
  selectedSubItem?: string | null;
}

const ManageHealthCenterGuide: React.FC<ManageHealthCenterGuideProps> = ({ selectedSubItem }) => {
  // Always show the full Manage Health Center content
  // selectedSubItem is used for future enhancements but main content stays the same
  
  return (
    <div className="max-w-7xl mx-auto px-6">
      <div className="flex items-center gap-3 mb-8">
        <Briefcase className="w-10 h-10 text-teal-600" />
        <h2 className="text-3xl font-bold text-gray-900">Business Management</h2>
      </div>
      
      {/* Always show the full Manage Health Center content */}
      <div className="prose max-w-none">
        <h3 className="text-2xl font-semibold text-gray-800 mb-4">Manage Health Center - Complete Guide</h3>
        <p className="text-base text-gray-600 mb-8 leading-relaxed">
          The Manage Health Center module allows you to configure and manage all aspects of your clinic's profile, 
          from basic information to multi-branch operations. This comprehensive guide covers all six sections in detail.
        </p>
        
        {/* General Info Section */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 p-8 mb-10 rounded-r-lg">
          <h4 className="font-bold text-lg text-blue-900 mb-5 flex items-center gap-2">
            <span className="flex items-center justify-center w-10 h-10 bg-blue-600 text-white rounded-full text-base font-bold">1</span>
            General Information
          </h4>
          <div className="ml-12 space-y-4">
            <p className="text-base text-blue-800 leading-relaxed">
              The General Info section contains all essential clinic information that defines your healthcare facility's identity:
            </p>
            <ul className="list-disc list-inside space-y-3 text-base text-blue-700">
              <li><strong>Clinic Name:</strong> Your official clinic/facility name (e.g., "Zeva Health Center")</li>
              <li><strong>Username/Slug:</strong> Unique identifier for your clinic profile URL (e.g., zeva.com/zeva-health)</li>
              <li><strong>Consultation Fee:</strong> Standard consultation charges in AED (e.g., 200 AED)</li>
              <li><strong>Tagline:</strong> A brief, catchy phrase describing your clinic's mission or specialty</li>
              <li><strong>Description:</strong> Detailed information about your clinic, services, and approach to patient care</li>
              <li><strong>Logo Upload:</strong> Your clinic's primary branding image (recommended: 500x500px, PNG/JPG format)</li>
              <li><strong>Cover Image:</strong> Large banner image showcasing your facility (recommended: 1920x600px)</li>
              <li><strong>Treatment Selection:</strong> Choose and categorize the medical treatments and services you offer</li>
              <li><strong>Service Management:</strong> Define and organize your clinic's service portfolio</li>
            </ul>
            
            {/* Image Upload Section */}
            <div className="mt-6 bg-white rounded-lg border-2 border-dashed border-blue-300 p-6">
              <div className="flex items-center gap-3 mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h5 className="font-semibold text-blue-900 text-base">Screenshot Upload Area</h5>
              </div>
              <div className="bg-blue-50 rounded-lg p-8 text-center border-2 border-dashed border-blue-200">
                <p className="text-blue-700 text-sm mb-2"><strong>Upload:</strong> /image.png</p>
                <p className="text-blue-600 text-xs">Drag & drop or click to upload screenshot of General Info section</p>
              </div>
            </div>
            
            <div className="mt-4 p-4 bg-white rounded-lg border border-blue-200">
              <p className="text-sm text-blue-700"><strong>💡 Pro Tip:</strong> Keep your clinic information up-to-date and use high-quality images for better patient engagement.</p>
            </div>
          </div>
        </div>

        {/* Contact Section */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500 p-8 mb-10 rounded-r-lg">
          <h4 className="font-bold text-lg text-green-900 mb-5 flex items-center gap-2">
            <span className="flex items-center justify-center w-10 h-10 bg-green-600 text-white rounded-full text-base font-bold">2</span>
            Contact Information
          </h4>
          <div className="ml-12 space-y-4">
            <p className="text-base text-green-800 leading-relaxed">
              The Contact section manages all communication channels patients use to reach your clinic:
            </p>
            <ul className="list-disc list-inside space-y-3 text-base text-green-700">
              <li><strong>Phone Number:</strong> Primary clinic contact number for appointments and inquiries</li>
              <li><strong>WhatsApp Number:</strong> Dedicated WhatsApp line for quick patient communication</li>
              <li><strong>Email Address:</strong> Official clinic email for correspondence and documentation</li>
              <li><strong>Website:</strong> Your clinic's external website URL (if applicable)</li>
              <li><strong>Physical Address:</strong> Complete street address including building, floor, and area</li>
              <li><strong>City/Emirate:</strong> City location (e.g., Dubai, Abu Dhabi, Sharjah)</li>
              <li><strong>Landmark:</strong> Nearby landmark or point of interest for easier navigation</li>
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
                <p className="text-green-700 text-sm mb-2"><strong>Upload:</strong> /contact-section.png</p>
                <p className="text-green-600 text-xs">Drag & drop or click to upload screenshot of Contact section</p>
              </div>
            </div>
            
            <div className="mt-4 p-4 bg-white rounded-lg border border-green-200">
              <p className="text-sm text-green-700"><strong>✓ Best Practice:</strong> Verify all contact details regularly to ensure patients can always reach you.</p>
            </div>
          </div>
        </div>

        {/* Documents Section */}
        <div className="bg-gradient-to-r from-purple-50 to-violet-50 border-l-4 border-purple-500 p-8 mb-10 rounded-r-lg">
          <h4 className="font-bold text-lg text-purple-900 mb-5 flex items-center gap-2">
            <span className="flex items-center justify-center w-10 h-10 bg-purple-600 text-white rounded-full text-base font-bold">3</span>
            Documents Management
          </h4>
          <div className="ml-12 space-y-4">
            <p className="text-base text-purple-800 leading-relaxed">
              The Documents section handles all official paperwork, certifications, and regulatory compliance files:
            </p>
            <ul className="list-disc list-inside space-y-3 text-base text-purple-700">
              <li><strong>Upload New Documents:</strong> Add certificates, licenses, insurance documents, and compliance papers</li>
              <li><strong>Document Categories:</strong> Organize by type (Medical Licenses, Insurance, Certifications, Policies)</li>
              <li><strong>View Existing Documents:</strong> Access previously uploaded files with preview functionality</li>
              <li><strong>Document Validation:</strong> Track expiry dates and renewal requirements for time-sensitive documents</li>
              <li><strong>File Format Support:</strong> PDF, JPG, PNG formats accepted (max file size: 10MB)</li>
              <li><strong>Version Control:</strong> Maintain document history and update old versions</li>
            </ul>
            
            {/* Image Upload Section */}
            <div className="mt-6 bg-white rounded-lg border-2 border-dashed border-purple-300 p-6">
              <div className="flex items-center gap-3 mb-4">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h5 className="font-semibold text-purple-900 text-base">Screenshot Upload Area</h5>
              </div>
              <div className="bg-purple-50 rounded-lg p-8 text-center border-2 border-dashed border-purple-200">
                <p className="text-purple-700 text-sm mb-2"><strong>Upload:</strong> /documents-section.png</p>
                <p className="text-purple-600 text-xs">Drag & drop or click to upload screenshot of Documents section</p>
              </div>
            </div>
            
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-lg border border-purple-200">
                <h5 className="font-semibold text-purple-900 mb-2 text-base">Required Documents:</h5>
                <ul className="text-sm text-purple-700 space-y-1">
                  <li>• DHA/DOH Medical License</li>
                  <li>• Trade License</li>
                  <li>• Malpractice Insurance</li>
                  <li>• Radiation Permit (if applicable)</li>
                </ul>
              </div>
              <div className="bg-white p-4 rounded-lg border border-purple-200">
                <h5 className="font-semibold text-purple-900 mb-2 text-base">Optional Documents:</h5>
                <ul className="text-sm text-purple-700 space-y-1">
                  <li>• ISO Certifications</li>
                  <li>• Awards & Recognition</li>
                  <li>• Partnership Agreements</li>
                  <li>• Patient Testimonials</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Listing Section */}
        <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-l-4 border-orange-500 p-8 mb-10 rounded-r-lg">
          <h4 className="font-bold text-lg text-orange-900 mb-5 flex items-center gap-2">
            <span className="flex items-center justify-center w-10 h-10 bg-orange-600 text-white rounded-full text-base font-bold">4</span>
            Listing & Visibility Settings
          </h4>
          <div className="ml-12 space-y-4">
            <p className="text-base text-orange-800 leading-relaxed">
              The Listing section controls what information appears on your public profile through toggle switches:
            </p>
            <ul className="list-disc list-inside space-y-3 text-base text-orange-700">
              <li><strong>Show Services:</strong> Toggle ON to display your clinic's services list publicly</li>
              <li><strong>Show Prices:</strong> Toggle ON to make consultation fees and treatment prices visible</li>
              <li><strong>Show Staff:</strong> Toggle ON to display doctor and staff profiles</li>
              <li><strong>Show Reviews:</strong> Toggle ON to allow patient reviews and ratings to be visible</li>
              <li><strong>Show Photos:</strong> Toggle ON to display clinic images and facility photos</li>
              <li><strong>Show Timings:</strong> Toggle ON to make operating hours visible to patients</li>
            </ul>
            
            {/* Image Upload Section */}
            <div className="mt-6 bg-white rounded-lg border-2 border-dashed border-orange-300 p-6">
              <div className="flex items-center gap-3 mb-4">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h5 className="font-semibold text-orange-900 text-base">Screenshot Upload Area</h5>
              </div>
              <div className="bg-orange-50 rounded-lg p-8 text-center border-2 border-dashed border-orange-200">
                <p className="text-orange-700 text-sm mb-2"><strong>Upload:</strong> /listing-toggles.png</p>
                <p className="text-orange-600 text-xs">Drag & drop or click to upload screenshot of Listing toggles</p>
              </div>
            </div>
            
            <div className="mt-4 p-4 bg-white rounded-lg border border-orange-200">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-orange-800 font-semibold">Important:</p>
                  <p className="text-sm text-orange-700 mt-1">
                    Only toggled-ON items will be visible on your public profile. Toggled-OFF items remain hidden even after saving. 
                    This gives you complete control over your clinic's public presentation.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Clinic Timing Section */}
        <div className="bg-gradient-to-r from-cyan-50 to-sky-50 border-l-4 border-cyan-500 p-8 mb-10 rounded-r-lg">
          <h4 className="font-bold text-lg text-cyan-900 mb-5 flex items-center gap-2">
            <span className="flex items-center justify-center w-10 h-10 bg-cyan-600 text-white rounded-full text-base font-bold">5</span>
            Clinic Timing & Availability
          </h4>
          <div className="ml-12 space-y-4">
            <p className="text-base text-cyan-800 leading-relaxed">
              The Clinic Timing section defines when your clinic operates and accepts appointments:
            </p>
            <ul className="list-disc list-inside space-y-3 text-base text-cyan-700">
              <li><strong>Working Days:</strong> Select which days your clinic operates (Sunday-Saturday)</li>
              <li><strong>Opening Time:</strong> Daily clinic opening hour (e.g., 09:00 AM)</li>
              <li><strong>Closing Time:</strong> Daily clinic closing hour (e.g., 09:00 PM)</li>
              <li><strong>Appointment Duration:</strong> Standard consultation slot length (e.g., 15, 30, 60 minutes)</li>
              <li><strong>Break Times:</strong> Define lunch breaks or non-operational periods during the day</li>
              <li><strong>Emergency Hours:</strong> Special timings for emergency services (if applicable)</li>
              <li><strong>Holiday Schedule:</strong> Mark closed dates and special holiday hours</li>
            </ul>
            
            {/* Image Upload Section */}
            <div className="mt-6 bg-white rounded-lg border-2 border-dashed border-cyan-300 p-6">
              <div className="flex items-center gap-3 mb-4">
                <svg className="w-6 h-6 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h5 className="font-semibold text-cyan-900 text-base">Screenshot Upload Area</h5>
              </div>
              <div className="bg-cyan-50 rounded-lg p-8 text-center border-2 border-dashed border-cyan-200">
                <p className="text-cyan-700 text-sm mb-2"><strong>Upload:</strong> /clinic-timing.png</p>
                <p className="text-cyan-600 text-xs">Drag & drop or click to upload screenshot of Clinic Timing section</p>
              </div>
            </div>
            
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-lg border border-cyan-200">
                <h5 className="font-semibold text-cyan-900 mb-2 text-base">Regular Hours Example:</h5>
                <ul className="text-sm text-cyan-700 space-y-1">
                  <li>• Sunday-Thursday: 9:00 AM - 9:00 PM</li>
                  <li>• Friday: 2:00 PM - 9:00 PM</li>
                  <li>• Saturday: 9:00 AM - 6:00 PM</li>
                </ul>
              </div>
              <div className="bg-white p-4 rounded-lg border border-cyan-200">
                <h5 className="font-semibold text-cyan-900 mb-2 text-base">Slot Configuration:</h5>
                <ul className="text-sm text-cyan-700 space-y-1">
                  <li>• Standard: 30 min slots</li>
                  <li>• Follow-up: 15 min slots</li>
                  <li>• Procedures: 60 min slots</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Branches Section */}
        <div className="bg-gradient-to-r from-rose-50 to-pink-50 border-l-4 border-rose-500 p-8 mb-10 rounded-r-lg">
          <h4 className="font-bold text-lg text-rose-900 mb-5 flex items-center gap-2">
            <span className="flex items-center justify-center w-10 h-10 bg-rose-600 text-white rounded-full text-base font-bold">6</span>
            Branches & Locations
          </h4>
          <div className="ml-12 space-y-4">
            <p className="text-base text-rose-800 leading-relaxed">
              The Branches section manages multiple clinic locations and facilities under one organization:
            </p>
            <ul className="list-disc list-inside space-y-3 text-base text-rose-700">
              <li><strong>Add Multiple Branches:</strong> Create separate profiles for each clinic location</li>
              <li><strong>Branch-Specific Info:</strong> Individual contact details, timings, and services per branch</li>
              <li><strong>Location Mapping:</strong> GPS coordinates and Google Maps integration for each branch</li>
              <li><strong>Branch Manager Assignment:</strong> Designate specific staff to manage individual branches</li>
              <li><strong>Unified Branding:</strong> Maintain consistent logo and branding across all branches</li>
              <li><strong>Centralized Reporting:</strong> View consolidated analytics across all locations</li>
              <li><strong>Branch Activation:</strong> Toggle branches active/inactive based on operational status</li>
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
                <p className="text-rose-700 text-sm mb-2"><strong>Upload:</strong> /branches-section.png</p>
                <p className="text-rose-600 text-xs">Drag & drop or click to upload screenshot of Branches section</p>
              </div>
            </div>
            
            <div className="mt-4 p-4 bg-white rounded-lg border border-rose-200">
              <h5 className="font-semibold text-rose-900 mb-2 text-base">Multi-Branch Benefits:</h5>
              <ul className="text-sm text-rose-700 space-y-1">
                <li>✓ Expand your clinic's geographic reach</li>
                <li>✓ Serve patients in multiple areas</li>
                <li>✓ Centralized management with localized operations</li>
                <li>✓ Better resource allocation and staff distribution</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManageHealthCenterGuide;
