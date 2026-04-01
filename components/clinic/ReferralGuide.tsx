"use client";
import React, { useState } from 'react';
import { Users, UserPlus } from 'lucide-react';

const ReferralGuide: React.FC = () => {
  const [activeSection, setActiveSection] = useState("overview");

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-green-500 rounded-2xl shadow-xl p-8 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <Users className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Referral Management - Complete Guide</h1>
              <p className="text-purple-100 text-sm">Comprehensive guide for managing patient referrals and referral partners</p>
            </div>
          </div>
          
          <div className="grid md:grid-cols-3 gap-4 mt-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
              <p className="text-purple-100 text-xs mb-1">Manage Referrals</p>
              <p className="text-white font-semibold">Create, Edit, Delete</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
              <p className="text-purple-100 text-xs mb-1">Commission Tracking</p>
              <p className="text-white font-semibold">Percentage-Based System</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
              <p className="text-purple-100 text-xs mb-1">Contact Management</p>
              <p className="text-white font-semibold">Phone & Email</p>
            </div>
          </div>
        </div>

        {/* Quick Navigation Tabs */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8 shadow-sm">
          <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Quick Navigation - All Sections
          </h4>
          <div className="grid md:grid-cols-2 gap-3">
            {[
              { id: "overview", label: " Overview (Introduction)", icon: Users },
              { id: "create-referral", label: " Create New Referral", icon: UserPlus },
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
              <li><strong>Create Referrals:</strong> Add new referral partners with complete contact details</li>
              <li><strong>Set Percentages:</strong> Configure referral commission rates (0-100%)</li>
              <li><strong>Simple Interface:</strong> Easy-to-use form with validation for data quality</li>
            </ul>
          </div>
        </div>

        {/* Overview Section */}
        {activeSection === "overview" && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-l-4 border-purple-500 p-6 rounded-r-lg">
              <h4 className="font-bold text-lg text-purple-900 mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 bg-purple-600 text-white rounded-full text-sm font-bold">1</span>
                Referral Management - Introduction
              </h4>
              <div className="ml-10 space-y-4">
                <p className="text-base text-purple-800 leading-relaxed">
                  The Referral Management system helps you track and manage relationships with 
                  external partners who refer patients to your clinic. Set commission percentages, 
                  maintain contact information, and monitor referral activities all in one place.
                </p>
                
                <div className="bg-white rounded-lg border border-purple-200 p-4">
                  <h5 className="font-semibold text-purple-900 mb-3">💡 What is a Referral?</h5>
                  <p className="text-sm text-purple-700 leading-relaxed mb-3">
                    A referral is when an external partner (doctor, consultant, or individual) sends 
                    a patient to your clinic for treatment. In return, they receive a pre-agreed 
                    percentage of the treatment cost as commission.
                  </p>
                  <div className="bg-purple-50 rounded-lg p-3 border-l-4 border-purple-500">
                    <p className="font-semibold text-purple-900 mb-2">Example Scenario:</p>
                    <ul className="list-disc list-inside ml-5 space-y-1 text-xs text-purple-700">
                      <li>Dr. Ahmed refers a patient for Dental Implant treatment</li>
                      <li>Treatment cost: AED 10,000</li>
                      <li>Agreed referral percentage: 10%</li>
                      <li>Dr. Ahmed earns: AED 1,000 commission</li>
                      <li>Clinic tracks this in the referral management system</li>
                    </ul>
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-purple-200 p-4">
                  <h5 className="font-semibold text-purple-900 mb-3">📋 What You Can Do:</h5>
                  <ul className="list-disc list-inside space-y-2 text-sm text-purple-700">
                    <li><strong>Create New Referrals:</strong> Add referral partners with full details (name, phone, email)</li>
                    <li><strong>Set Commission Rates:</strong> Define percentage (0-100%) for each referrer</li>
                    <li><strong>Edit Information:</strong> Update contact details or percentages anytime</li>
                    <li><strong>Delete Referrals:</strong> Remove inactive or incorrect entries</li>
                    <li><strong>Track Activities:</strong> Monitor which referrers send most patients</li>
                    <li><strong>Manage Contacts:</strong> Keep all referrer information organized</li>
                    <li><strong>Expense Tracking:</strong> Option to add expenses related to referrals</li>
                  </ul>
                </div>

                <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                  <h5 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
                    🎯 Main Features:
                  </h5>
                  <ul className="list-disc list-inside space-y-2 text-sm text-purple-700">
                    <li><strong>Simple Form Interface:</strong> Easy-to-use form for creating and editing referrals</li>
                    <li><strong>Validation:</strong> Required fields ensure data quality (name, phone mandatory)</li>
                    <li><strong>Percentage Control:</strong> Slider or input for commission rate (0-100%)</li>
                    <li><strong>Expense Option:</strong> Checkbox to enable expense tracking for referral</li>
                    <li><strong>List View:</strong> See all referrals in organized table format</li>
                    <li><strong>Quick Actions:</strong> Edit or delete referrals with single click</li>
                    <li><strong>Toast Notifications:</strong> Success/error messages for all actions</li>
                    <li><strong>Real-time Updates:</strong> Changes reflect immediately after save</li>
                  </ul>
                </div>

                <div className="bg-white rounded-lg border border-purple-200 p-4">
                  <h5 className="font-semibold text-purple-900 mb-3">📊 Referral Information Stored:</h5>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="bg-purple-50 rounded-lg p-3 border-l-4 border-purple-500">
                      <p className="font-semibold text-purple-900 mb-2">Personal Details:</p>
                      <ul className="list-disc list-inside ml-5 space-y-1 text-xs text-purple-700">
                        <li>First Name (required)</li>
                        <li>Last Name</li>
                        <li>Phone Number (required)</li>
                        <li>Email Address (optional)</li>
                      </ul>
                    </div>
                    
                    <div className="bg-purple-50 rounded-lg p-3 border-l-4 border-purple-500">
                      <p className="font-semibold text-purple-900 mb-2">Financial Details:</p>
                      <ul className="list-disc list-inside ml-5 space-y-1 text-xs text-purple-700">
                        <li>Referral Percentage (0-100%)</li>
                        <li>Add Expense option (Yes/No)</li>
                        <li>Total earnings tracked</li>
                        <li>Payment status monitored</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                  <h5 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
                    💼 Common Use Cases:
                  </h5>
                  <ul className="list-disc list-inside space-y-2 text-sm text-purple-700">
                    <li><strong>New Partnership:</strong> Add external doctor who will refer patients regularly</li>
                    <li><strong>Corporate Tie-up:</strong> Create referral for company sending employees for treatment</li>
                    <li><strong>Insurance Partner:</strong> Track referrals from insurance companies</li>
                    <li><strong>Consultant Network:</strong> Manage multiple consultants referring cases</li>
                    <li><strong>Rate Adjustment:</strong> Increase/decrease commission based on performance</li>
                    <li><strong>Contact Update:</strong> Change phone/email when referrer relocates</li>
                    <li><strong>Cleanup:</strong> Remove inactive referrers from system</li>
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
                    <p className="text-purple-700 text-sm mb-2"><strong>Upload:</strong> /referral-main-page.png</p>
                    <p className="text-purple-600 text-xs">Drag & drop or click to upload screenshot of main referral management page</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create Referral Section */}
        {activeSection === "create-referral" && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500 p-6 rounded-r-lg">
              <h4 className="font-bold text-lg text-green-900 mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 bg-green-600 text-white rounded-full text-sm font-bold">2</span>
                Create New Referral - Step by Step
              </h4>
              <div className="ml-10 space-y-4">
                <p className="text-base text-green-800 leading-relaxed">
                  Creating a new referral partner is simple and quick. Fill in the required 
                  information and set the commission percentage they'll earn on referred treatments.
                </p>
                
                <div className="bg-white rounded-lg border border-green-200 p-4">
                  <h5 className="font-semibold text-green-900 mb-3">📝 Form Fields Explained:</h5>
                  <div className="space-y-3">
                    <div className="bg-green-50 rounded-lg p-3 border-l-4 border-green-500">
                      <p className="font-semibold text-green-900 mb-1">1. First Name *</p>
                      <p className="text-xs text-green-700 mb-2"><strong>Required Field</strong> - Enter the referrer's first name</p>
                      <ul className="list-disc list-inside ml-5 space-y-1 text-xs text-green-700">
                        <li>Example: "Ahmed", "Sarah", "Mohammed"</li>
                        <li>Cannot be empty - validation will show error</li>
                        <li>Used to identify the referral partner</li>
                      </ul>
                    </div>
                    
                    <div className="bg-green-50 rounded-lg p-3 border-l-4 border-green-500">
                      <p className="font-semibold text-green-900 mb-1">2. Last Name</p>
                      <p className="text-xs text-green-700 mb-2"><strong>Optional Field</strong> - Enter the referrer's last name or family name</p>
                      <ul className="list-disc list-inside ml-5 space-y-1 text-xs text-green-700">
                        <li>Example: "Al Mansoori", "Johnson", "Khan"</li>
                        <li>Can be left blank if not applicable</li>
                        <li>Helps with complete identification</li>
                      </ul>
                    </div>
                    
                    <div className="bg-green-50 rounded-lg p-3 border-l-4 border-green-500">
                      <p className="font-semibold text-green-900 mb-1">3. Phone Number *</p>
                      <p className="text-xs text-green-700 mb-2"><strong>Required Field</strong> - Primary contact number</p>
                      <ul className="list-disc list-inside ml-5 space-y-1 text-xs text-green-700">
                        <li>Format: "+971 50 123 4567" or local format</li>
                        <li>Must be provided - validation required</li>
                        <li>Used for SMS notifications and calls</li>
                        <li>Should be active and reachable number</li>
                      </ul>
                    </div>
                    
                    <div className="bg-green-50 rounded-lg p-3 border-l-4 border-green-500">
                      <p className="font-semibold text-green-900 mb-1">4. Email Address</p>
                      <p className="text-xs text-green-700 mb-2"><strong>Optional Field</strong> - Email for communication</p>
                      <ul className="list-disc list-inside ml-5 space-y-1 text-xs text-green-700">
                        <li>Format: "name@example.com"</li>
                        <li>Useful for sending reports and updates</li>
                        <li>Can be skipped if referrer doesn't use email</li>
                      </ul>
                    </div>
                    
                    <div className="bg-green-50 rounded-lg p-3 border-l-4 border-green-500">
                      <p className="font-semibold text-green-900 mb-1">5. Referral Percent *</p>
                      <p className="text-xs text-green-700 mb-2"><strong>Required Field</strong> - Commission percentage (0-100%)</p>
                      <ul className="list-disc list-inside ml-5 space-y-1 text-xs text-green-700">
                        <li>Default: 0% (must be changed)</li>
                        <li>Maximum: 100% (full treatment cost)</li>
                        <li>Typical range: 5-15% for medical referrals</li>
                        <li>Validation shows error if outside 0-100 range</li>
                        <li>Example: 10% means referrer gets 10% of treatment cost</li>
                      </ul>
                    </div>
                    
                    <div className="bg-green-50 rounded-lg p-3 border-l-4 border-green-500">
                      <p className="font-semibold text-green-900 mb-1">6. Add Expense</p>
                      <p className="text-xs text-green-700 mb-2"><strong>Optional Toggle</strong> - Enable expense tracking for this referral</p>
                      <ul className="list-disc list-inside ml-5 space-y-1 text-xs text-green-700">
                        <li>Checkbox: Yes/No</li>
                        <li>If enabled, you can add expenses related to this referral</li>
                        <li>Expenses are tracked separately from commissions</li>
                        <li>Useful for recording marketing costs, travel, etc.</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-green-200 p-4">
                  <h5 className="font-semibold text-green-900 mb-3">🎯 How to Create:</h5>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-green-700">
                    <li><strong>Navigate to Referral Page:</strong> Go to /clinic/referral</li>
                    <li><strong>Form Appears:</strong> Creation form is displayed at top</li>
                    <li><strong>Enter First Name:</strong> Type referrer's first name (required)</li>
                    <li><strong>Enter Last Name:</strong> Optionally add last name</li>
                    <li><strong>Add Phone:</strong> Input primary contact number (required)</li>
                    <li><strong>Add Email:</strong> Optionally provide email address</li>
                    <li><strong>Set Percentage:</strong> Enter commission rate (0-100%)</li>
                    <li><strong>Toggle Expense:</strong> Check if expense tracking needed</li>
                    <li><strong>Click Save:</strong> Submit the form to create referral</li>
                    <li><strong>Confirmation:</strong> Success message appears</li>
                    <li><strong>List Updates:</strong> New referral appears in table below</li>
                  </ol>
                </div>

                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <h5 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
                    ✅ Validation Rules:
                  </h5>
                  <ul className="list-disc list-inside space-y-2 text-sm text-green-700">
                    <li><strong>First Name:</strong> Cannot be empty - shows "Required" error</li>
                    <li><strong>Phone:</strong> Must be provided - shows "Required" error</li>
                    <li><strong>Percentage:</strong> Must be between 0-100 - shows "0-100 required" error</li>
                    <li><strong>Last Name & Email:</strong> Optional - no validation errors</li>
                    <li><strong>Save Button:</strong> Won't work until all required fields are valid</li>
                  </ul>
                </div>

                <div className="bg-white rounded-lg border border-green-200 p-4">
                  <h5 className="font-semibold text-green-900 mb-3">📊 Example Entry:</h5>
                  <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                    <table className="w-full text-sm">
                      <tbody>
                        <tr className="border-b border-green-200">
                          <td className="py-2 px-3 font-semibold">First Name:</td>
                          <td className="py-2 px-3">Dr. Ahmed</td>
                        </tr>
                        <tr className="border-b border-green-200">
                          <td className="py-2 px-3 font-semibold">Last Name:</td>
                          <td className="py-2 px-3">Al Hashimi</td>
                        </tr>
                        <tr className="border-b border-green-200">
                          <td className="py-2 px-3 font-semibold">Phone:</td>
                          <td className="py-2 px-3">+971 50 123 4567</td>
                        </tr>
                        <tr className="border-b border-green-200">
                          <td className="py-2 px-3 font-semibold">Email:</td>
                          <td className="py-2 px-3">ahmed@clinic.ae</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 font-semibold">Referral %:</td>
                          <td className="py-2 px-3">10%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-green-600 mt-2 italic">This referrer will earn 10% commission on all referred treatments</p>
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
                    <p className="text-green-700 text-sm mb-2"><strong>Upload:</strong> /create-referral-form.png</p>
                    <p className="text-green-600 text-xs">Drag & drop or click to upload screenshot of referral creation form</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReferralGuide;
