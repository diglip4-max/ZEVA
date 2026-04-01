"use client";
import React, { useState } from 'react';
import { FileText, Upload, Layers, PenLine, Send, CheckCircle, AlertCircle, Globe, Database, Signature } from 'lucide-react';

const ConsentFormGuide: React.FC = () => {
  const [activeSection, setActiveSection] = useState("overview");

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header Section */}
      <div className="flex items-center gap-3 mb-8">
        <FileText className="w-10 h-10 text-teal-600" />
        <h2 className="text-3xl font-bold text-gray-900">Consent Forms Management</h2>
      </div>
      
      <div className="prose max-w-none">
        <h3 className="text-2xl font-semibold text-gray-800 mb-4">HR Management - Consent Forms Guide</h3>
        <p className="text-base text-gray-600 mb-8 leading-relaxed">
          The Consent Forms module allows clinics to create, manage, and track patient consent forms 
          for various medical procedures and treatments. This comprehensive guide covers the complete 
          5-step workflow for uploading and configuring consent forms with service mapping and digital signature options.
        </p>

        {/* Quick Navigation */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8 shadow-sm">
          <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Quick Navigation
          </h4>
          <div className="grid md:grid-cols-5 gap-2">
            {[
              { id: "upload", label: "Step 1: Upload", icon: Upload },
              { id: "details", label: "Step 2: Details", icon: FileText },
              { id: "mapping", label: "Step 3: Mapping", icon: Layers },
              { id: "signature", label: "Step 4: Signature", icon: PenLine },
              { id: "publish", label: "Step 5: Publish", icon: Send },
            ].map((step) => (
              <button
                key={step.id}
                onClick={() => setActiveSection(step.id)}
                className={`p-3 rounded-lg border-2 transition-all text-center ${
                  activeSection === step.id
                    ? "border-teal-500 bg-teal-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <step.icon className="w-5 h-5 mx-auto mb-1 text-teal-600" />
                <span className="text-xs font-medium text-gray-900">{step.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Overview Section */}
        {activeSection === "overview" && (
          <div className="space-y-8">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 p-6 rounded-r-lg">
              <h4 className="font-bold text-lg text-blue-900 mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full text-sm font-bold">1</span>
                Consent Form Overview
              </h4>
              <div className="ml-10 space-y-4">
                <p className="text-base text-blue-800 leading-relaxed">
                  Consent forms are legal documents that ensure patients understand the risks, benefits, 
                  and alternatives of medical procedures. The system provides a structured workflow to 
                  create and manage these forms efficiently.
                </p>
                
                <div className="bg-white rounded-lg border border-blue-200 p-4">
                  <h5 className="font-semibold text-blue-900 mb-3">Key Features:</h5>
                  <ul className="space-y-2 text-sm text-blue-700">
                   
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Form Name:</strong>Identifies the name of the form for easy recognition</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Department:</strong> Shows which department the form is associated with</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Language:</strong> Indicates the language in which the form is available</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Version Control:</strong> Displays the current version of the form for tracking updates</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Services:</strong> Lists the services or treatments linked to the form</span>
                    </li>
                      <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Services:</strong> Lists the services or treatments linked to the form</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Signature:</strong> Indicates whether the form requires a signature</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Status:</strong> Shows if the form is active or inactive</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Actions:</strong> Provides options like view or delete to manage the form</span>
                    </li>
                  </ul>
                </div>

                {/* Screenshot Upload Area */}
                <div className="mt-6 bg-white rounded-lg border-2 border-dashed border-blue-300 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <h5 className="font-semibold text-blue-900 text-base">Screenshot Upload Area</h5>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-8 text-center border-2 border-dashed border-blue-200">
                    <p className="text-blue-700 text-sm mb-2"><strong>Upload:</strong> /consent-forms-overview.png</p>
                    <p className="text-blue-600 text-xs">Drag & drop or click to upload screenshot of main consent forms page</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Upload File */}
        {activeSection === "upload" && (
          <div className="space-y-8">
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-l-4 border-purple-500 p-6 rounded-r-lg">
              <h4 className="font-bold text-lg text-purple-900 mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 bg-purple-600 text-white rounded-full text-sm font-bold">1</span>
                Step 1: Upload File
              </h4>
              <div className="ml-10 space-y-4">
                <p className="text-base text-purple-800 leading-relaxed">
                  The first step is to upload your consent form document. The system supports multiple file formats 
                  and provides an intuitive drag-and-drop interface.
                </p>
                
                <div className="bg-white rounded-lg border border-purple-200 p-4">
                  <h5 className="font-semibold text-purple-900 mb-3">Supported File Formats:</h5>
                  <ul className="space-y-2 text-sm text-purple-700">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>PDF (.pdf):</strong> Portable Document Format - Recommended for final forms</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Word Document (.doc):</strong> Microsoft Word 97-2003 format</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Word Document (.docx):</strong> Modern Microsoft Word format</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-white rounded-lg border border-purple-200 p-4">
                  <h5 className="font-semibold text-purple-900 mb-3">Upload Process:</h5>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-purple-700">
                    <li><strong>Drag & Drop:</strong> Simply drag your file into the upload area</li>
                    <li><strong>Click to Browse:</strong> Or click the upload area to open file browser</li>
                    <li><strong>Visual Feedback:</strong> Uploaded files show with green checkmark</li>
                    <li><strong>Change File:</strong> Option to replace if wrong file uploaded</li>
                    <li><strong>File Size Display:</strong> Shows file size in KB for verification</li>
                  </ol>
                </div>

                <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                  <h5 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Important Notes:
                  </h5>
                  <ul className="list-disc list-inside space-y-1 text-sm text-purple-700">
                    <li>Ensure the file is the final version before uploading</li>
                    <li>File names should be clear and descriptive</li>
                    <li>Maximum file size limits may apply (check system settings)</li>
                    <li>Uploaded files are stored securely in the cloud</li>
                  </ul>
                </div>

                {/* Screenshot Upload */}
                <div className="mt-6 bg-white rounded-lg border-2 border-dashed border-purple-300 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <h5 className="font-semibold text-purple-900 text-base">Screenshot Upload Area</h5>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-8 text-center border-2 border-dashed border-purple-200">
                    <p className="text-purple-700 text-sm mb-2"><strong>Upload:</strong> /consent-upload-step.png</p>
                    <p className="text-purple-600 text-xs">Drag & drop or click to upload screenshot of upload interface</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Form Details */}
        {activeSection === "details" && (
          <div className="space-y-8">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500 p-6 rounded-r-lg">
              <h4 className="font-bold text-lg text-green-900 mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 bg-green-600 text-white rounded-full text-sm font-bold">2</span>
                Step 2: Form Details
              </h4>
              <div className="ml-10 space-y-4">
                <p className="text-base text-green-800 leading-relaxed">
                  After uploading the file, you need to provide essential information about the consent form 
                  to properly categorize and manage it within the system.
                </p>
                
                <div className="bg-white rounded-lg border border-green-200 p-4">
                  <h5 className="font-semibold text-green-900 mb-3">Required Information:</h5>
                  <ul className="space-y-3 text-sm text-green-700">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <div>
                        <strong>Form Name *</strong> (Required)
                        <br />
                        <span className="text-xs">Clear, descriptive name (e.g., "Patient Consent for Surgery", "Dental Treatment Consent")</span>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <div>
                        <strong>Department</strong> (Optional but recommended)
                        <br />
                        <span className="text-xs">Associate with specific department (Dental, Cardiology, Orthopedics, etc.)</span>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <div>
                        <strong>Language</strong> (Required)
                        <br />
                        <span className="text-xs">Select from: English, Spanish, French, Arabic, Hindi</span>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <div>
                        <strong>Version</strong> (Required)
                        <br />
                        <span className="text-xs">Version number for tracking updates (e.g., "1.0", "2.1")</span>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <div>
                        <strong>Description</strong> (Optional)
                        <br />
                        <span className="text-xs">Brief description explaining the purpose and scope of the consent form</span>
                      </div>
                    </li>
                  </ul>
                </div>

                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <h5 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    Multi-Language Support:
                  </h5>
                  <p className="text-sm text-green-700 mb-2">
                    The system supports creating consent forms in multiple languages to serve diverse patient populations:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-green-700">
                    <li>English - Default language</li>
                    <li>Spanish - For Spanish-speaking patients</li>
                    <li>French - For French-speaking patients</li>
                    <li>Arabic - For Arabic-speaking patients</li>
                    <li>Hindi - For Hindi-speaking patients</li>
                  </ul>
                </div>

                {/* Screenshot Upload */}
                <div className="mt-6 bg-white rounded-lg border-2 border-dashed border-green-300 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <h5 className="font-semibold text-green-900 text-base">Screenshot Upload Area</h5>
                  </div>
                  <div className="bg-green-50 rounded-lg p-8 text-center border-2 border-dashed border-green-200">
                    <p className="text-green-700 text-sm mb-2"><strong>Upload:</strong> /consent-details-step.png</p>
                    <p className="text-green-600 text-xs">Drag & drop or click to upload screenshot of form details interface</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Service Mapping */}
        {activeSection === "mapping" && (
          <div className="space-y-8">
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-l-4 border-orange-500 p-6 rounded-r-lg">
              <h4 className="font-bold text-lg text-orange-900 mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 bg-orange-600 text-white rounded-full text-sm font-bold">3</span>
                Step 3: Service Mapping
              </h4>
              <div className="ml-10 space-y-4">
                <p className="text-base text-orange-800 leading-relaxed">
                  Service mapping links the consent form to specific medical services or treatments. 
                  This ensures the correct consent form is automatically presented when those services are booked.
                </p>
                
                <div className="bg-white rounded-lg border border-orange-200 p-4">
                  <h5 className="font-semibold text-orange-900 mb-3">How Service Mapping Works:</h5>
                  <ul className="space-y-2 text-sm text-orange-700">
                    <li><strong>Search Functionality:</strong> Use the search bar to find services quickly</li>
                    <li><strong>Multi-Select:</strong> Select multiple services that require this consent</li>
                    <li><strong>Visual Indicators:</strong> Selected services are highlighted</li>
                    <li><strong>Service Categories:</strong> Services are organized by department</li>
                    <li><strong>Automatic Linking:</strong> Once mapped, the form auto-associates with selected services</li>
                  </ul>
                </div>

                <div className="bg-white rounded-lg border border-orange-200 p-4">
                  <h5 className="font-semibold text-orange-900 mb-3">Example Mappings:</h5>
                  <div className="space-y-2 text-sm text-orange-700">
                    <div className="flex items-start gap-2">
                      <Database className="w-4 h-4 text-orange-500 mt-0.5" />
                      <div>
                        <strong>Surgical Consent Form</strong> maps to:
                        <br />
                        <span className="text-xs">• General Surgery • Laparoscopic Procedures • Endoscopy</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Database className="w-4 h-4 text-orange-500 mt-0.5" />
                      <div>
                        <strong>Dental Treatment Consent</strong> maps to:
                        <br />
                        <span className="text-xs">• Tooth Extraction • Root Canal • Dental Implants</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Database className="w-4 h-4 text-orange-500 mt-0.5" />
                      <div>
                        <strong>Cosmetic Procedure Consent</strong> maps to:
                        <br />
                        <span className="text-xs">• Botox Injections • Laser Treatment • Chemical Peels</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                  <h5 className="font-semibold text-orange-900 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Best Practices:
                  </h5>
                  <ul className="list-disc list-inside space-y-1 text-sm text-orange-700">
                    <li>Map all relevant services to avoid missing consent forms</li>
                    <li>Review mappings periodically as new services are added</li>
                    <li>Use specific service names for clarity</li>
                    <li>Consider creating separate forms for high-risk vs. routine procedures</li>
                  </ul>
                </div>

                {/* Screenshot Upload */}
                <div className="mt-6 bg-white rounded-lg border-2 border-dashed border-orange-300 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <h5 className="font-semibold text-orange-900 text-base">Screenshot Upload Area</h5>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-8 text-center border-2 border-dashed border-orange-200">
                    <p className="text-orange-700 text-sm mb-2"><strong>Upload:</strong> /consent-service-mapping.png</p>
                    <p className="text-orange-600 text-xs">Drag & drop or click to upload screenshot of service mapping interface</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Signature Settings */}
        {activeSection === "signature" && (
          <div className="space-y-8">
            <div className="bg-gradient-to-r from-cyan-50 to-blue-50 border-l-4 border-cyan-500 p-6 rounded-r-lg">
              <h4 className="font-bold text-lg text-cyan-900 mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 bg-cyan-600 text-white rounded-full text-sm font-bold">4</span>
                Step 4: Signature Settings
              </h4>
              <div className="ml-10 space-y-4">
                <p className="text-base text-cyan-800 leading-relaxed">
                  Configure how patients will sign the consent form. The system offers flexible signature options 
                  to accommodate different workflows and legal requirements.
                </p>
                
                <div className="bg-white rounded-lg border border-cyan-200 p-4">
                  <h5 className="font-semibold text-cyan-900 mb-3">Signature Options:</h5>
                  <ul className="space-y-3 text-sm text-cyan-700">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <div>
                        <strong>Digital Signature</strong> (Enable/Disable)
                        <br />
                        <span className="text-xs">Allow patients to sign electronically using mouse, touchpad, or touchscreen</span>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <div>
                        <strong>Name Confirmation</strong> (Enable/Disable)
                        <br />
                        <span className="text-xs">Require patients to type their full name as legal confirmation</span>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <div>
                        <strong>Date & Time Stamp</strong> (Automatic)
                        <br />
                        <span className="text-xs">System automatically records when the form was signed</span>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <div>
                        <strong>Witness Signature</strong> (Optional)
                        <br />
                        <span className="text-xs">Additional signature field for witness/staff member</span>
                      </div>
                    </li>
                  </ul>
                </div>

                <div className="bg-cyan-50 rounded-lg p-4 border border-cyan-200">
                  <h5 className="font-semibold text-cyan-900 mb-2 flex items-center gap-2">
                    <Signature className="w-4 h-4" />
                    Digital Signature Features:
                  </h5>
                  <ul className="list-disc list-inside space-y-1 text-sm text-cyan-700">
                    <li>Capture signatures on any device (desktop, tablet, mobile)</li>
                    <li>High-resolution signature capture</li>
                    <li>Option to clear and re-sign if needed</li>
                    <li>Signatures stored securely with encryption</li>
                    <li>Compliant with e-signature regulations</li>
                    <li>Integrated with patient profiles</li>
                  </ul>
                </div>

                <div className="bg-white rounded-lg border border-cyan-200 p-4">
                  <h5 className="font-semibold text-cyan-900 mb-3">Configuration Examples:</h5>
                  <div className="space-y-2 text-sm text-cyan-700">
                    <div className="p-3 bg-cyan-50 rounded-lg">
                      <strong>Standard Setup:</strong>
                      <br />
                      ✓ Digital Signature: Enabled
                      <br />
                      ✓ Name Confirmation: Enabled
                      <br />
                      <span className="text-xs">Best for most procedures</span>
                    </div>
                    <div className="p-3 bg-cyan-50 rounded-lg">
                      <strong>Enhanced Legal Protection:</strong>
                      <br />
                      ✓ Digital Signature: Enabled
                      <br />
                      ✓ Name Confirmation: Enabled
                      <br />
                      ✓ Witness Signature: Required
                      <br />
                      <span className="text-xs">Recommended for high-risk procedures</span>
                    </div>
                  </div>
                </div>

                {/* Screenshot Upload */}
                <div className="mt-6 bg-white rounded-lg border-2 border-dashed border-cyan-300 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <svg className="w-6 h-6 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <h5 className="font-semibold text-cyan-900 text-base">Screenshot Upload Area</h5>
                  </div>
                  <div className="bg-cyan-50 rounded-lg p-8 text-center border-2 border-dashed border-cyan-200">
                    <p className="text-cyan-700 text-sm mb-2"><strong>Upload:</strong> /consent-signature-settings.png</p>
                    <p className="text-cyan-600 text-xs">Drag & drop or click to upload screenshot of signature configuration</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Publish */}
        {activeSection === "publish" && (
          <div className="space-y-8">
            <div className="bg-gradient-to-r from-teal-50 to-green-50 border-l-4 border-teal-500 p-6 rounded-r-lg">
              <h4 className="font-bold text-lg text-teal-900 mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 bg-teal-600 text-white rounded-full text-sm font-bold">5</span>
                Step 5: Publish
              </h4>
              <div className="ml-10 space-y-4">
                <p className="text-base text-teal-800 leading-relaxed">
                  The final step is to review all configurations and publish the consent form, 
                  making it available for use in clinical workflows.
                </p>
                
                <div className="bg-white rounded-lg border border-teal-200 p-4">
                  <h5 className="font-semibold text-teal-900 mb-3">Pre-Publish Checklist:</h5>
                  <ul className="space-y-2 text-sm text-teal-700">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span>✓ Correct file uploaded and displayed properly</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span>✓ Form name is clear and descriptive</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span>✓ Department assigned (if applicable)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span>✓ Language correctly set</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span>✓ Version number entered</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span>✓ All relevant services mapped</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span>✓ Signature settings configured</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-teal-50 rounded-lg p-4 border border-teal-200">
                  <h5 className="font-semibold text-teal-900 mb-2 flex items-center gap-2">
                    <Send className="w-4 h-4" />
                    Publishing Actions:
                  </h5>
                  <ul className="list-disc list-inside space-y-1 text-sm text-teal-700">
                    <li><strong>Review Summary:</strong> View complete configuration summary</li>
                    <li><strong>Final Edit:</strong> Go back to any step if changes needed</li>
                    <li><strong>Publish Button:</strong> Click "Publish" to make form live</li>
                    <li><strong>Success Confirmation:</strong> Receive confirmation message</li>
                    <li><strong>Status Update:</strong> Form status changes to "Active"</li>
                  </ul>
                </div>

                <div className="bg-white rounded-lg border border-teal-200 p-4">
                  <h5 className="font-semibold text-teal-900 mb-3">After Publishing:</h5>
                  <ul className="space-y-2 text-sm text-teal-700">
                    <li><strong>Immediate Availability:</strong> Form appears in consent form library</li>
                    <li><strong>Auto-Association:</strong> Automatically linked to mapped services</li>
                    <li><strong>Patient Access:</strong> Available for patients during appointment booking</li>
                    <li><strong>Staff Access:</strong> Accessible to authorized clinic staff</li>
                    <li><strong>Tracking Enabled:</strong> System tracks form usage and signatures</li>
                  </ul>
                </div>

                {/* Screenshot Upload */}
                <div className="mt-6 bg-white rounded-lg border-2 border-dashed border-teal-300 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <h5 className="font-semibold text-teal-900 text-base">Screenshot Upload Area</h5>
                  </div>
                  <div className="bg-teal-50 rounded-lg p-8 text-center border-2 border-dashed border-teal-200">
                    <p className="text-teal-700 text-sm mb-2"><strong>Upload:</strong> /consent-publish-step.png</p>
                    <p className="text-teal-600 text-xs">Drag & drop or click to upload screenshot of publish confirmation</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Form Management Section */}
        <div className="bg-gradient-to-r from-slate-50 to-gray-50 border-l-4 border-slate-500 p-6 rounded-r-lg mt-8">
          <h4 className="font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
            <FileText className="w-6 h-6" />
            Managing Existing Consent Forms
          </h4>
          <div className="ml-10 space-y-3">
            <p className="text-base text-slate-700 leading-relaxed">
              After publishing, you can manage consent forms through the main consent forms page:
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm text-slate-700">
              <li><strong>View All Forms:</strong> See complete list with status indicators</li>
              <li><strong>Search & Filter:</strong> Find forms by name, department, or language</li>
              <li><strong>Edit Forms:</strong> Update details, remap services, modify settings</li>
              <li><strong>Version Control:</strong> Create new versions while preserving history</li>
              <li><strong>Activate/Deactivate:</strong> Toggle form availability without deletion</li>
              <li><strong>View Statistics:</strong> Track usage and completion rates</li>
              <li><strong>Delete Forms:</strong> Remove obsolete forms (with confirmation)</li>
            </ul>
          </div>
        </div>

        {/* Best Practices Section */}
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border-l-4 border-indigo-500 p-6 rounded-r-lg mt-8">
          <h4 className="font-bold text-lg text-indigo-900 mb-4 flex items-center gap-2">
            <AlertCircle className="w-6 h-6" />
          Consent Form Best Practices
          </h4>
          <div className="ml-10 space-y-3">
            <ul className="list-disc list-inside space-y-2 text-base text-indigo-700">
              <li><strong>Legal Review:</strong> Have all consent forms reviewed by legal counsel</li>
              <li><strong>Clear Language:</strong> Use simple, easy-to-understand terminology</li>
              <li><strong>Risk Disclosure:</strong> Clearly outline all potential risks and complications</li>
              <li><strong>Alternative Options:</strong> Explain alternative treatments available</li>
              <li><strong>Regular Updates:</strong> Review and update forms periodically</li>
              <li><strong>Multilingual Coverage:</strong> Provide forms in all common patient languages</li>
              <li><strong>Accessibility:</strong> Ensure forms are accessible to patients with disabilities</li>
              <li><strong>Documentation:</strong> Maintain audit trails of all signed forms</li>
              <li><strong>Staff Training:</strong> Train staff on proper consent form procedures</li>
              <li><strong>Compliance:</strong> Follow healthcare regulations and standards</li>
            </ul>
          </div>
        </div>

        {/* Integration Note */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500 p-6 rounded-r-lg mt-8">
          <h4 className="font-bold text-lg text-green-900 mb-4 flex items-center gap-2">
            <CheckCircle className="w-6 h-6" />
            How Consent Forms Integrate with Other Modules
          </h4>
          <div className="ml-10 space-y-3">
            <p className="text-base text-green-800 leading-relaxed">
              Consent forms are interconnected with various clinic management modules:
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm text-green-700">
              <li><strong>Appointments:</strong> Auto-present during appointment check-in</li>
              <li><strong>Services:</strong> Linked to specific treatments/procedures</li>
              <li><strong>Departments:</strong> Organized by clinical department</li>
              <li><strong>Patient Profiles:</strong> Stored in patient medical records</li>
              <li><strong>Billing:</strong> May be required before billing for procedures</li>
              <li><strong>Reports:</strong> Included in compliance and audit reports</li>
              <li><strong>HR Management:</strong> Part of staff training and protocols</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConsentFormGuide;
