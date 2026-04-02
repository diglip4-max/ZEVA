"use client";
import React, { useState } from 'react';
import { Users, User, Settings, Briefcase } from 'lucide-react';

const ClinicManagementGuide: React.FC = () => {
  const [activeSection, setActiveSection] = useState("overview");

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl shadow-xl p-8 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <Users className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Clinic Management - Complete Guide</h1>
              <p className="text-blue-100 text-sm">Comprehensive guide for managing clinic staff, doctors, agents, and user administration</p>
            </div>
          </div>
          
          <div className="grid md:grid-cols-4 gap-4 mt-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
              <p className="text-blue-100 text-xs mb-1">User Management</p>
              <p className="text-white font-semibold">View, Create, Edit, Delete</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
              <p className="text-blue-100 text-xs mb-1">Access Control</p>
              <p className="text-white font-semibold">Rights & Permissions</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
              <p className="text-blue-100 text-xs mb-1">Security</p>
              <p className="text-white font-semibold">Password Management</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
              <p className="text-blue-100 text-xs mb-1">Profile Management</p>
              <p className="text-white font-semibold">Complete User Profiles</p>
            </div>
          </div>
        </div>

        {/* Quick Navigation Tabs */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8 shadow-sm">
          <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Quick Navigation - All Management Sections
          </h4>
          <div className="grid md:grid-cols-2 gap-3">
            
          </div>
          
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800 font-semibold mb-2">🎯 Key Points:</p>
            <ul className="list-disc list-inside ml-4 space-y-1 text-xs text-blue-700">
              <li><strong>Complete Profile Management:</strong> View and edit all user details including personal info, qualifications, experience</li>
              <li><strong>Profile Visibility:</strong> Comprehensive viewing of all user information in one place</li>
              <li><strong>User-Friendly Interface:</strong> Easy navigation and clean layout for better user experience</li>
            </ul>
          </div>
        </div>

        {/* Overview Section */}
        {activeSection === "overview" && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 p-6 rounded-r-lg">
              <h4 className="font-bold text-lg text-blue-900 mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8  text-white rounded-full text-sm font-bold"></span>
                Clinic Management - Complete Introduction
              </h4>
              <div className="ml-10 space-y-4">
                <p className="text-base text-blue-800 leading-relaxed">
                  The Clinic Management system provides comprehensive tools for managing all aspects of 
                  your clinic's human resources. From creating new user accounts to managing access rights, 
                  passwords, and complete profile information - everything you need to run your clinic 
                  efficiently is here.
                </p>
                
                <div className="bg-white rounded-lg border border-blue-200 p-4">
                  <h5 className="font-semibold text-blue-900 mb-3">💡 What You Can Manage:</h5>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="bg-blue-50 rounded-lg p-3 border-l-4 border-blue-500">
                      <p className="font-semibold text-blue-900 mb-2">👥 User Types:</p>
                      <ul className="list-disc list-inside ml-4 space-y-1 text-xs text-blue-700">
                        <li><strong>Agents:</strong> Marketing and sales team members</li>
                        <li><strong>Doctors:</strong> Medical practitioners and specialists</li>
                        <li><strong>Staff:</strong> Administrative and support staff</li>
                        <li><strong>Clinic Admins:</strong> Clinic owners and managers</li>
                        <li><strong>Receptionists:</strong> Front desk personnel</li>
                      </ul>
                    </div>
                    
                    <div className="bg-purple-50 rounded-lg p-3 border-l-4 border-purple-500">
                      <p className="font-semibold text-purple-900 mb-2">🔧 Management Actions:</p>
                      <ul className="list-disc list-inside ml-4 space-y-1 text-xs text-purple-700">
                        <li><strong>View Profile:</strong> See complete user information</li>
                        <li><strong>Create Users:</strong> Add new team members</li>
                        <li><strong>Edit Details:</strong> Update user information</li>
                        <li><strong>Manage Rights:</strong> Set permissions and access levels</li>
                        <li><strong>Change Passwords:</strong> Reset or update passwords</li>
                        <li><strong>Delete Users:</strong> Remove inactive accounts</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <h5 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                    🎯 Main Features:
                  </h5>
                  <ul className="list-disc list-inside space-y-2 text-sm text-blue-700">
                    <li><strong>Complete Profile Management:</strong> View and edit all user details including personal info, qualifications, experience</li>
                    <li><strong>Role-Based Access Control:</strong> Assign specific rights based on user role and responsibilities</li>
                    <li><strong>Secure Password Management:</strong> Change passwords securely with validation</li>
                    <li><strong>User Creation Wizard:</strong> Step-by-step process for adding new team members</li>
                    <li><strong>Profile Verification:</strong> Ensure all user information is accurate and up-to-date</li>
                    <li><strong>Account Deactivation:</strong> Safely remove or deactivate user accounts when needed</li>
                    <li><strong>Audit Trail:</strong> Track all changes made to user accounts</li>
                    <li><strong>Bulk Operations:</strong> Manage multiple users simultaneously</li>
                  </ul>
                </div>

                <div className="bg-white rounded-lg border border-blue-200 p-4">
                  <h5 className="font-semibold text-blue-900 mb-3">📊 User Management Workflow:</h5>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-blue-700">
                    <li><strong>Create User Account:</strong> Add new agent, doctor, or staff member</li>
                    <li><strong>Assign Role:</strong> Select appropriate role (agent, doctor, staff, admin)</li>
                    <li><strong>Set Permissions:</strong> Configure access rights based on responsibilities</li>
                    <li><strong>Complete Profile:</strong> Add all personal and professional details</li>
                    <li><strong>Initial Password:</strong> Set temporary password for first login</li>
                    <li><strong>View & Monitor:</strong> Regularly review user profiles and activities</li>
                    <li><strong>Update as Needed:</strong> Edit information when changes occur</li>
                    <li><strong>Manage Lifecycle:</strong> Deactivate or delete when user leaves</li>
                  </ol>
                </div>

                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <h5 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                    💼 Common Use Cases:
                  </h5>
                  <ul className="list-disc list-inside space-y-2 text-sm text-blue-700">
                    <li><strong>New Hire Onboarding:</strong> Create complete profile for new employee</li>
                    <li><strong>Role Change:</strong> Update permissions when employee changes position</li>
                    <li><strong>Password Reset:</strong> Help users who forgot their credentials</li>
                    <li><strong>Profile Audit:</strong> Review and verify all user information periodically</li>
                    <li><strong>Access Review:</strong> Ensure users have appropriate access levels</li>
                    <li><strong>Employee Offboarding:</strong> Deactivate account when someone leaves</li>
                    <li><strong>Compliance:</strong> Maintain records for regulatory requirements</li>
                    <li><strong>Emergency Access:</strong> Grant temporary elevated permissions when needed</li>
                  </ul>
                </div>

                {/* Screenshot Upload */}
                <div className="mt-6 bg-white rounded-lg border-2 border-dashed border-blue-300 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <h5 className="font-semibold text-blue-900 text-base">Screenshot Upload Area</h5>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-8 text-center border-2 border-dashed border-blue-200">
                    <p className="text-blue-700 text-sm mb-2"><strong>Upload:</strong> /clinic-management-overview.png</p>
                    <p className="text-blue-600 text-xs">Drag & drop or click to upload screenshot of main clinic management dashboard</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* View Profile Section */}
        {activeSection === "view-profile" && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500 p-6 rounded-r-lg">
              <h4 className="font-bold text-lg text-green-900 mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 bg-green-600 text-white rounded-full text-sm font-bold">2</span>
                View Profile - Complete User Information
              </h4>
              <div className="ml-10 space-y-4">
                <p className="text-base text-green-800 leading-relaxed">
                  The View Profile feature provides a comprehensive display of all user information 
                  including personal details, professional qualifications, contact information, and 
                  account settings. This is your go-to place for complete user visibility.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClinicManagementGuide;
