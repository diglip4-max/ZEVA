"use client";
import React, { useState } from 'react';
import { UserPlus,FileText,  Save } from 'lucide-react';

const CreateLeadGuide: React.FC = () => {
  const [activeSection, setActiveSection] = useState("overview");

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl shadow-xl p-8 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <UserPlus className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Create Lead - Complete Guide</h1>
              <p className="text-purple-100 text-sm">Comprehensive guide for creating and managing leads in your CRM system</p>
            </div>
          </div>
          
          <div className="grid md:grid-cols-3 gap-4 mt-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
              <p className="text-purple-100 text-xs mb-1">Lead Creation</p>
              <p className="text-white font-semibold">Add New Prospects</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
              <p className="text-purple-100 text-xs mb-1">Lead Management</p>
              <p className="text-white font-semibold">Track & Follow-up</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
              <p className="text-purple-100 text-xs mb-1">Conversion Tracking</p>
              <p className="text-white font-semibold">Monitor Success Rates</p>
            </div>
          </div>
        </div>

        {/* Quick Navigation Tabs */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8 shadow-sm">
          <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Quick Navigation - All Sections
          </h4>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { id: "overview", label: " Overview", icon: UserPlus },
              { id: "create-lead", label: " Create New Lead", icon: Save },
            
             
            ].map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`p-3 rounded-lg border-2 transition-all text-left ${
                  activeSection === section.id
                    ? "border-purple-500 bg-purple-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <section.icon className="w-5 h-5 text-purple-600" />
                  <span className="text-sm font-medium text-gray-900">{section.label}</span>
                </div>
              </button>
            ))}
          </div>
          
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800 font-semibold mb-2">🎯 Key Points:</p>
            <ul className="list-disc list-inside ml-4 space-y-1 text-xs text-blue-700">
              <li><strong>Create Leads:</strong> Add new potential customers with complete contact information</li>
              <li><strong>Track Sources:</strong> Monitor where leads are coming from (website, referral, social media)</li>
              <li><strong>Follow-up System:</strong> Schedule and track all lead communications</li>
              <li><strong>Conversion Funnel:</strong> Convert qualified leads into patients/customers</li>
            </ul>
          </div>
        </div>

        {/* Overview Section */}
        {activeSection === "overview" && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-l-4 border-purple-500 p-6 rounded-r-lg">
              <h4 className="font-bold text-lg text-purple-900 mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 bg-purple-600 text-white rounded-full text-sm font-bold">1</span>
                Create Lead - Introduction
              </h4>
              <div className="ml-10 space-y-4">
                <p className="text-base text-purple-800 leading-relaxed">
                  The Create Lead module helps you capture and manage potential customers who 
                  have shown interest in your clinic's services. This is the first step in your 
                  sales funnel where prospects enter your CRM system.
                </p>
                
                <div className="bg-white rounded-lg border border-purple-200 p-4">
                  <h5 className="font-semibold text-purple-900 mb-3">💡 What is a Lead?</h5>
                  <p className="text-sm text-purple-700 leading-relaxed mb-3">
                    A lead is a person or organization that has expressed interest in your clinic's 
                    services through various channels (website inquiry, phone call, walk-in, social 
                    media, etc.) but hasn't yet become a paying patient/customer.
                  </p>
                  <div className="bg-purple-50 rounded-lg p-3 border-l-4 border-purple-500">
                    <p className="font-semibold text-purple-900 mb-2">Example Lead Sources:</p>
                    <ul className="list-disc list-inside ml-5 space-y-1 text-xs text-purple-700">
                      <li>Website contact form submission</li>
                      <li>Phone inquiry about dental implants</li>
                      <li>Facebook/Instagram ad response</li>
                      <li>Google My Business listing inquiry</li>
                      <li>Referral from existing patient</li>
                      <li>Walk-in consultation request</li>
                      <li>Health fair/event contact collection</li>
                    </ul>
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-purple-200 p-4">
                  <h5 className="font-semibold text-purple-900 mb-3">📋 What You Can Do:</h5>
                  <ul className="list-disc list-inside space-y-2 text-sm text-purple-700">
                    <li><strong>Create New Leads:</strong> Manually add prospect information into the system</li>
                    <li><strong>Capture Contact Details:</strong> Store name, phone, email, location</li>
                    <li><strong>Track Lead Source:</strong> Record how they found your clinic</li>
                    <li><strong>Note Requirements:</strong> Document their specific needs/interests</li>
                    <li><strong>Assign Status:</strong> Categorize as New, Contacted, Qualified, Converted, or Lost</li>
                    <li><strong>Schedule Follow-ups:</strong> Set reminders for next contact</li>
                    <li><strong>Add Notes:</strong> Record all interactions and communications</li>
                    <li><strong>Convert to Patient:</strong> Move qualified leads to patient registration</li>
                  </ul>
                </div>

                <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                  <h5 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
                    🎯 Main Features:
                  </h5>
                  <ul className="list-disc list-inside space-y-2 text-sm text-purple-700">
                    <li><strong>Quick Entry Form:</strong> Fast lead creation with essential fields</li>
                    <li><strong>Source Tracking:</strong> Multiple lead source options (Website, Walk-in, Referral, Social Media, etc.)</li>
                    <li><strong>Contact Information:</strong> Complete details storage (name, phone, email, location)</li>
                    <li><strong>Service Interest:</strong> Record which service/treatment they're interested in</li>
                    <li><strong>Status Management:</strong> Track lead progression through sales funnel</li>
                    <li><strong>Follow-up Reminders:</strong> Never miss a scheduled follow-up</li>
                    <li><strong>Communication History:</strong> Log all calls, emails, messages</li>
                    <li><strong>Conversion Tracking:</strong> Monitor lead-to-patient conversion rates</li>
                  </ul>
                </div>

                <div className="bg-white rounded-lg border border-purple-200 p-4">
                  <h5 className="font-semibold text-purple-900 mb-3">📊 Lead Information Stored:</h5>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="bg-purple-50 rounded-lg p-3 border-l-4 border-purple-500">
                      <p className="font-semibold text-purple-900 mb-2">Basic Information:</p>
                      <ul className="list-disc list-inside ml-5 space-y-1 text-xs text-purple-700">
                        <li>First Name (required)</li>
                        <li>Last Name</li>
                        <li>Email Address</li>
                        <li>Phone Number (required)</li>
                        <li>Location/City</li>
                        <li>Preferred Contact Method</li>
                      </ul>
                    </div>
                    
                    <div className="bg-purple-50 rounded-lg p-3 border-l-4 border-purple-500">
                      <p className="font-semibold text-purple-900 mb-2">Lead Details:</p>
                      <ul className="list-disc list-inside ml-5 space-y-1 text-xs text-purple-700">
                        <li>Lead Source (where they came from)</li>
                        <li>Service/Treatment Interest</li>
                        <li>Initial Requirements/Notes</li>
                        <li>Lead Status (New, Contacted, etc.)</li>
                        <li>Assigned To (staff member)</li>
                        <li>Follow-up Date & Time</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                  <h5 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
                    💼 Common Use Cases:
                  </h5>
                  <ul className="list-disc list-inside space-y-2 text-sm text-purple-700">
                    <li><strong>Website Inquiry:</strong> Someone fills out contact form on website → Create lead immediately</li>
                    <li><strong>Phone Call:</strong> Prospect calls asking about teeth whitening → Create lead during call</li>
                    <li><strong>Social Media:</strong> Instagram DM about dental implants → Create lead from message</li>
                    <li><strong>Referral:</strong> Existing patient refers friend/family → Create referred lead</li>
                    <li><strong>Event/Walk-in:</strong> Health camp or clinic visit → Create lead on spot</li>
                    <li><strong>Marketing Campaign:</strong> Response to Google/Facebook ads → Create lead from campaign</li>
                    <li><strong>Corporate Tie-up:</strong> Company inquiry for employee dental plans → Create B2B lead</li>
                  </ul>
                </div>

                <div className="bg-white rounded-lg border border-purple-200 p-4">
                  <h5 className="font-semibold text-purple-900 mb-3">👥 Who Uses This System:</h5>
                  <div className="space-y-3">
                    <div className="bg-purple-50 rounded-lg p-3 border-l-4 border-purple-500">
                      <p className="font-semibold text-purple-900 mb-1">Front Desk/Reception:</p>
                      <ul className="list-disc list-inside ml-5 space-y-1 text-xs text-purple-700">
                        <li>Create leads from walk-in inquiries</li>
                        <li>Enter phone call details</li>
                        <li>Schedule initial consultations</li>
                        <li>Follow up with no-shows</li>
                      </ul>
                    </div>
                    
                    <div className="bg-purple-50 rounded-lg p-3 border-l-4 border-purple-500">
                      <p className="font-semibold text-purple-900 mb-1">Sales/Marketing Team:</p>
                      <ul className="list-disc list-inside ml-5 space-y-1 text-xs text-purple-700">
                        <li>Process website/social media leads</li>
                        <li>Handle corporate inquiries</li>
                        <li>Manage event-generated leads</li>
                        <li>Track campaign effectiveness</li>
                      </ul>
                    </div>
                    
                    <div className="bg-purple-50 rounded-lg p-3 border-l-4 border-purple-500">
                      <p className="font-semibold text-purple-900 mb-1">Clinic Admin:</p>
                      <ul className="list-disc list-inside ml-5 space-y-1 text-xs text-purple-700">
                        <li>Monitor lead conversion rates</li>
                        <li>Assign leads to team members</li>
                        <li>Analyze lead sources</li>
                        <li>Generate performance reports</li>
                      </ul>
                    </div>
                  </div>
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
                    <p className="text-purple-700 text-sm mb-2"><strong>Upload:</strong> /create-lead-main-page.png</p>
                    <p className="text-purple-600 text-xs">Drag & drop or click to upload screenshot of main create lead page</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create New Lead Section */}
        {activeSection === "create-lead" && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500 p-6 rounded-r-lg">
              <h4 className="font-bold text-lg text-green-900 mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 bg-green-600 text-white rounded-full text-sm font-bold">2</span>
                Create New Lead - Step by Step
              </h4>
              <div className="ml-10 space-y-4">
                <p className="text-base text-green-800 leading-relaxed">
                  Creating a new lead is a simple process. Fill in the prospect's information, 
                  select their interest, and set up follow-up reminders to ensure proper tracking.
                </p>
                
                <div className="bg-white rounded-lg border border-green-200 p-4">
                  <h5 className="font-semibold text-green-900 mb-3">📝 Form Fields Explained:</h5>
                  <div className="space-y-3">
                    <div className="bg-green-50 rounded-lg p-3 border-l-4 border-green-500">
                      <p className="font-semibold text-green-900 mb-1">1. First Name *</p>
                      <p className="text-xs text-green-700 mb-2"><strong>Required Field</strong> - Enter the lead's first name</p>
                      <ul className="list-disc list-inside ml-5 space-y-1 text-xs text-green-700">
                        <li>Example: "Ahmed", "Sarah", "Mohammed"</li>
                        <li>Cannot be empty - validation will show error</li>
                        <li>Used for personalized communication</li>
                      </ul>
                    </div>
                    
                    <div className="bg-green-50 rounded-lg p-3 border-l-4 border-green-500">
                      <p className="font-semibold text-green-900 mb-1">2. Last Name</p>
                      <p className="text-xs text-green-700 mb-2"><strong>Optional Field</strong> - Enter the lead's last name or family name</p>
                      <ul className="list-disc list-inside ml-5 space-y-1 text-xs text-green-700">
                        <li>Example: "Al Mansoori", "Johnson", "Khan"</li>
                        <li>Can be left blank if not available</li>
                        <li>Helps with complete identification</li>
                      </ul>
                    </div>
                    
                    <div className="bg-green-50 rounded-lg p-3 border-l-4 border-green-500">
                      <p className="font-semibold text-green-900 mb-1">3. Email Address</p>
                      <p className="text-xs text-green-700 mb-2"><strong>Optional but Recommended</strong> - Primary email for communication</p>
                      <ul className="list-disc list-inside ml-5 space-y-1 text-xs text-green-700">
                        <li>Format: "name@example.com"</li>
                        <li>Useful for sending appointment confirmations</li>
                        <li>Used for email marketing campaigns (if opted in)</li>
                      </ul>
                    </div>
                    
                    <div className="bg-green-50 rounded-lg p-3 border-l-4 border-green-500">
                      <p className="font-semibold text-green-900 mb-1">4. Phone Number *</p>
                      <p className="text-xs text-green-700 mb-2"><strong>Required Field</strong> - Primary contact number</p>
                      <ul className="list-disc list-inside ml-5 space-y-1 text-xs text-green-700">
                        <li>Format: "+971 50 123 4567" or local format</li>
                        <li>Must be provided - validation required</li>
                        <li>Used for SMS notifications and calls</li>
                        <li>Should be active WhatsApp number if possible</li>
                      </ul>
                    </div>
                    
                    <div className="bg-green-50 rounded-lg p-3 border-l-4 border-green-500">
                      <p className="font-semibold text-green-900 mb-1">5. Location</p>
                      <p className="text-xs text-green-700 mb-2"><strong>Optional Field</strong> - City or area where lead resides</p>
                      <ul className="list-disc list-inside ml-5 space-y-1 text-xs text-green-700">
                        <li>Examples: "Dubai", "Abu Dhabi", "Sharjah", "Jumeirah"</li>
                        <li>Helps with demographic analysis</li>
                        <li>Useful for targeting location-specific offers</li>
                      </ul>
                    </div>
                    
                    <div className="bg-green-50 rounded-lg p-3 border-l-4 border-green-500">
                      <p className="font-semibold text-green-900 mb-1">6. Lead Source *</p>
                      <p className="text-xs text-green-700 mb-2"><strong>Required Field</strong> - How did they find your clinic?</p>
                      <ul className="list-disc list-inside ml-5 space-y-1 text-xs text-green-700">
                        <li>Common options: Website, Walk-in, Phone Call, Facebook, Instagram, Google, Referral, Other</li>
                        <li>Important for marketing ROI tracking</li>
                        <li>Helps identify most effective channels</li>
                      </ul>
                    </div>
                    
                    <div className="bg-green-50 rounded-lg p-3 border-l-4 border-green-500">
                      <p className="font-semibold text-green-900 mb-1">7. Service Interest</p>
                      <p className="text-xs text-green-700 mb-2"><strong>Optional Field</strong> - Which service are they interested in?</p>
                      <ul className="list-disc list-inside ml-5 space-y-1 text-xs text-green-700">
                        <li>Examples: Dental Implants, Teeth Whitening, Orthodontics, General Dentistry, Cosmetic Dentistry</li>
                        <li>Helps route to appropriate department</li>
                        <li>Enables targeted follow-up</li>
                      </ul>
                    </div>
                    
                    <div className="bg-green-50 rounded-lg p-3 border-l-4 border-green-500">
                      <p className="font-semibold text-green-900 mb-1">8. Initial Notes/Requirements</p>
                      <p className="text-xs text-green-700 mb-2"><strong>Optional Field</strong> - Additional details about their needs</p>
                      <ul className="list-disc list-inside ml-5 space-y-1 text-xs text-green-700">
                        <li>Example: "Interested in Invisalign consultation, prefers morning appointments"</li>
                        <li>Record specific requirements discussed</li>
                        <li>Helps prepare for follow-up conversation</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-green-200 p-4">
                  <h5 className="font-semibold text-green-900 mb-3">🎯 How to Create:</h5>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-green-700">
                    <li><strong>Navigate to Create Lead:</strong> Go to /clinic/create-lead</li>
                    <li><strong>Form Appears:</strong> Lead creation form is displayed</li>
                    <li><strong>Enter First Name:</strong> Type lead's first name (required)</li>
                    <li><strong>Enter Last Name:</strong> Optionally add last name</li>
                    <li><strong>Add Email:</strong> Input email address if available</li>
                    <li><strong>Add Phone:</strong> Enter primary contact number (required)</li>
                    <li><strong>Select Location:</strong> Choose city/area from dropdown or type</li>
                    <li><strong>Choose Source:</strong> Select how they found your clinic (required)</li>
                    <li><strong>Select Service:</strong> Pick service they're interested in</li>
                    <li><strong>Add Notes:</strong> Write any additional requirements or comments</li>
                    <li><strong>Click Save:</strong> Submit the form to create lead</li>
                    <li><strong>Confirmation:</strong> Success message appears with lead ID</li>
                    <li><strong>Set Follow-up:</strong> Schedule next contact date/time if needed</li>
                  </ol>
                </div>

                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <h5 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
                    ✅ Best Practices:
                  </h5>
                  <ul className="list-disc list-inside space-y-2 text-sm text-green-700">
                    <li><strong>Speed Matters:</strong> Create leads immediately while information is fresh</li>
                    <li><strong>Complete Information:</strong> Capture as many details as possible for better follow-up</li>
                    <li><strong>Accurate Source:</strong> Always record correct lead source for marketing analysis</li>
                    <li><strong>Clear Notes:</strong> Write detailed notes so anyone can follow up effectively</li>
                    <li><strong>Quick Follow-up:</strong> Contact new leads within 24 hours for best conversion</li>
                    <li><strong>WhatsApp Enabled:</strong> Mark if phone number has WhatsApp for modern communication</li>
                    <li><strong>Privacy Compliance:</strong> Ensure consent for communication (GDPR/local regulations)</li>
                  </ul>
                </div>

                <div className="bg-white rounded-lg border border-green-200 p-4">
                  <h5 className="font-semibold text-green-900 mb-3">📊 Example Lead Entry:</h5>
                  <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                    <table className="w-full text-sm">
                      <tbody>
                        <tr className="border-b border-green-200">
                          <td className="py-2 px-3 font-semibold">First Name:</td>
                          <td className="py-2 px-3">Fatima</td>
                        </tr>
                        <tr className="border-b border-green-200">
                          <td className="py-2 px-3 font-semibold">Last Name:</td>
                          <td className="py-2 px-3">Al Hashimi</td>
                        </tr>
                        <tr className="border-b border-green-200">
                          <td className="py-2 px-3 font-semibold">Email:</td>
                          <td className="py-2 px-3">fatima@email.com</td>
                        </tr>
                        <tr className="border-b border-green-200">
                          <td className="py-2 px-3 font-semibold">Phone:</td>
                          <td className="py-2 px-3">+971 50 123 4567</td>
                        </tr>
                        <tr className="border-b border-green-200">
                          <td className="py-2 px-3 font-semibold">Location:</td>
                          <td className="py-2 px-3">Dubai Marina</td>
                        </tr>
                        <tr className="border-b border-green-200">
                          <td className="py-2 px-3 font-semibold">Source:</td>
                          <td className="py-2 px-3">Instagram Ad</td>
                        </tr>
                        <tr className="border-b border-green-200">
                          <td className="py-2 px-3 font-semibold">Service Interest:</td>
                          <td className="py-2 px-3">Teeth Whitening</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 font-semibold">Notes:</td>
                          <td className="py-2 px-3">Interested in premium whitening, wants appointment next week</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-green-600 mt-2 italic">This lead should be contacted within 24 hours for best conversion rate</p>
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
                    <p className="text-green-700 text-sm mb-2"><strong>Upload:</strong> /create-lead-form.png</p>
                    <p className="text-green-600 text-xs">Drag & drop or click to upload screenshot of lead creation form</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Other sections as placeholders */}
        {activeSection === "lead-fields" && (
          <div className="bg-white rounded-lg p-8 text-center border-2 border-dashed border-purple-300">
            <h5 className="text-xl font-bold text-purple-900 mb-3">📝 Lead Fields Section</h5>
            <p className="text-purple-700 mb-4">Detailed explanation of all lead fields:</p>
            <ul className="list-disc list-inside text-sm text-purple-600">
              <li>Required vs optional fields</li>
              <li>Field validation rules</li>
              <li>Custom field configuration</li>
              <li>Data formatting standards</li>
            </ul>
          </div>
        )}
        
        {activeSection === "lead-sources" && (
          <div className="bg-white rounded-lg p-8 text-center border-2 border-dashed border-purple-300">
            <h5 className="text-xl font-bold text-purple-900 mb-3">🏢 Lead Sources Section</h5>
            <p className="text-purple-700 mb-4">Understanding and tracking lead sources:</p>
            <ul className="list-disc list-inside text-sm text-purple-600">
              <li>Website inquiries</li>
              <li>Walk-in visitors</li>
              <li>Phone calls</li>
              <li>Social media (Facebook, Instagram)</li>
              <li>Google My Business</li>
              <li>Patient referrals</li>
              <li>Marketing campaigns</li>
              <li>Events and health camps</li>
            </ul>
          </div>
        )}
        
        {activeSection === "follow-up" && (
          <div className="bg-white rounded-lg p-8 text-center border-2 border-dashed border-purple-300">
            <h5 className="text-xl font-bold text-purple-900 mb-3">📞 Follow-up Section</h5>
            <p className="text-purple-700 mb-4">Managing lead follow-ups effectively:</p>
            <ul className="list-disc list-inside text-sm text-purple-600">
              <li>Schedule follow-up calls/meetings</li>
              <li>Set automated reminders</li>
              <li>Log all communication attempts</li>
              <li>Track follow-up outcomes</li>
              <li>Best practices for timing</li>
            </ul>
          </div>
        )}
        
        {activeSection === "conversion" && (
          <div className="bg-white rounded-lg p-8 text-center border-2 border-dashed border-purple-300">
            <h5 className="text-xl font-bold text-purple-900 mb-3">✅ Conversion Section</h5>
            <p className="text-purple-700 mb-4">Converting leads to patients:</p>
            <ul className="list-disc list-inside text-sm text-purple-600">
              <li>Qualification criteria</li>
              <li>Conversion process steps</li>
              <li>Linking to patient registration</li>
              <li>Tracking conversion rates</li>
              <li>Analyzing success metrics</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateLeadGuide;
