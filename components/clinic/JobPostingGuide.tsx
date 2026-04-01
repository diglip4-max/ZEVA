"use client";
import React, { useState } from 'react';
import { Briefcase, Users, FileText, PlusCircle, CheckCircle, AlertCircle } from 'lucide-react';

const JobPostingGuide: React.FC = () => {
  const [activeSection, setActiveSection] = useState("overview");

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header Section */}
      <div className="flex items-center gap-3 mb-8">
        <Briefcase className="w-10 h-10 text-teal-600" />
        <h2 className="text-3xl font-bold text-gray-900">Job Posting & Management</h2>
      </div>
      
      <div className="prose max-w-none">
        <h3 className="text-2xl font-semibold text-gray-800 mb-4">HR Management - Complete Job Posting Guide</h3>
        <p className="text-base text-gray-600 mb-8 leading-relaxed">
          The Job Posting module enables clinics to create, manage, and track job opportunities 
          while reviewing applications from qualified candidates. This comprehensive guide covers 
          both job posting creation and applicant management with detailed workflows.
        </p>

        {/* Quick Navigation Tabs */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8 shadow-sm">
          <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Briefcase className="w-5 h-5" />
            Quick Navigation - Complete Details of Both Sections
          </h4>
          <div className="grid md:grid-cols-2 gap-3">
            {[
              { id: "overview", label: " Overview (Complete Introduction)", icon: FileText },
              { id: "create-job", label: " Create New Job", icon: PlusCircle },
              { id: "manage-jobs", label: " My Jobs Section", icon: Briefcase },
              { id: "applicants", label: " Job Applications Section", icon: Users },
              { id: "permissions", label: " Permissions", icon: CheckCircle },
              { id: "best-practices", label: " Best Practices", icon: CheckCircle },
            ].map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`p-3 rounded-lg border-2 transition-all text-left ${
                  activeSection === section.id
                    ? "border-teal-500 bg-teal-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <section.icon className="w-5 h-5 text-teal-600" />
                  <span className="text-sm font-medium text-gray-900">{section.label}</span>
                </div>
              </button>
            ))}
          </div>
          
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800 font-semibold mb-2">🎯 Key Points:</p>
            <ul className="list-disc list-inside ml-4 space-y-1 text-xs text-blue-700">
              <li><strong>My Jobs Section:</strong> Post new jobs, view all jobs, filter by employment type (Full-time, Part-time, Internship)</li>
              <li><strong>Job Applications Section:</strong> View all candidate applications, track status, schedule interviews</li>
              <li><strong>Filters:</strong> Powerful filters available in both sections - Employment Type, Status, Department, Date Range</li>
              <li><strong>Complete Workflow:</strong> Create Job → Receive Applications → Review → Interview → Hire</li>
            </ul>
          </div>
        </div>

        {/* Overview Section */}
        {activeSection === "overview" && (
          <div className="space-y-8">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 p-6 rounded-r-lg">
              <h4 className="font-bold text-lg text-blue-900 mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full text-sm font-bold">1</span>
                Job Posting Module Overview
              </h4>
              <div className="ml-10 space-y-4">
                <p className="text-base text-blue-800 leading-relaxed">
                  The Job Posting system provides a complete recruitment workflow for healthcare facilities. 
                  From creating detailed job listings to managing candidate applications, all recruitment 
                  activities are streamlined in one place.
                </p>
                
                <div className="bg-white rounded-lg border border-blue-200 p-4">
                  <h5 className="font-semibold text-blue-900 mb-3">Key Features:</h5>
                  <ul className="space-y-2 text-sm text-blue-700">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Job Creation:</strong> Create detailed job postings with requirements, responsibilities, and benefits</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Application Management:</strong> Track and review all incoming applications in one dashboard</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Permission-Based Access:</strong> Role-based permissions for creating, viewing, and managing jobs</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Multi-Role Support:</strong> Post jobs as clinic, doctor, hospital, or admin</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Candidate Communication:</strong> Integrated messaging and status updates for applicants</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>SEO Optimization:</strong> Structured data markup for better job visibility</span>
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
                    <p className="text-blue-700 text-sm mb-2"><strong>Upload:</strong> /job-posting-overview.png</p>
                    <p className="text-blue-600 text-xs">Drag & drop or click to upload screenshot of main job posting page with tabs</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create Job Section */}
        {activeSection === "create-job" && (
          <div className="space-y-8">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500 p-6 rounded-r-lg">
              <h4 className="font-bold text-lg text-green-900 mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 bg-green-600 text-white rounded-full text-sm font-bold">1</span>
                Creating a New Job Posting
              </h4>
              <div className="ml-10 space-y-4">
                <p className="text-base text-green-800 leading-relaxed">
                  The job creation process is designed to help you create comprehensive and attractive 
                  job postings that attract qualified healthcare professionals.
                </p>
                
                <div className="bg-white rounded-lg border border-green-200 p-4">
                  <h5 className="font-semibold text-green-900 mb-3">Step-by-Step Process:</h5>
                  <ol className="list-decimal list-inside space-y-3 text-sm text-green-700">
                    <li><strong>Click "Post a New Job"</strong> - Located in the top-right corner of the Jobs tab</li>
                    <li><strong>Fill in Basic Information:</strong>
                      <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
                        <li>Job Title (e.g., "Registered Nurse", "Dental Hygienist")</li>
                        <li>Department/Specialization</li>
                        <li>Employment Type (Full-time, Part-time, Contract)</li>
                        <li>Location (City, Emirate)</li>
                        <li>Salary Range (Optional but recommended)</li>
                      </ul>
                    </li>
                    <li><strong>Add Job Description:</strong>
                      <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
                        <li>Detailed role overview</li>
                        <li>Key responsibilities and duties</li>
                        <li>Reporting structure</li>
                      </ul>
                    </li>
                    <li><strong>Specify Requirements:</strong>
                      <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
                        <li>Required qualifications and degrees</li>
                        <li>Licenses and certifications</li>
                        <li>Years of experience</li>
                        <li>Technical skills</li>
                        <li>Language proficiency</li>
                      </ul>
                    </li>
                    <li><strong>List Benefits & Perks:</strong>
                      <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
                        <li>Health insurance</li>
                        <li>Housing allowance</li>
                        <li>Transportation allowance</li>
                        <li>Annual airfare</li>
                        <li>Continuing education support</li>
                      </ul>
                    </li>
                    <li><strong>Set Application Details:</strong>
                      <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
                        <li>Application deadline</li>
                        <li>Expected start date</li>
                        <li>Number of positions available</li>
                      </ul>
                    </li>
                    <li><strong>Review and Submit:</strong> Preview your job posting before publishing</li>
                  </ol>
                </div>

                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <h5 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Important Notes:
                  </h5>
                  <ul className="list-disc list-inside space-y-1 text-sm text-green-700">
                    <li>All fields marked with * are required</li>
                    <li>Clear job titles improve search visibility</li>
                    <li>Detailed descriptions attract better candidates</li>
                    <li>Salary transparency increases application rates</li>
                    <li>You can edit job postings after publishing</li>
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
                    <p className="text-green-700 text-sm mb-2"><strong>Upload:</strong> /create-job-form.png</p>
                    <p className="text-green-600 text-xs">Drag & drop or click to upload screenshot of job creation form</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Manage Jobs Section */}
        {activeSection === "manage-jobs" && (
          <div className="space-y-8">
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-l-4 border-purple-500 p-6 rounded-r-lg">
              <h4 className="font-bold text-lg text-purple-900 mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 bg-purple-600 text-white rounded-full text-sm font-bold">1</span>
                My All Jobs Section - Complete Management Dashboard
              </h4>
              <div className="ml-10 space-y-4">
                <p className="text-base text-purple-800 leading-relaxed">
                  The "My All Jobs" tab is your comprehensive job management dashboard where you can view, 
                  manage, and track all your clinic's job postings with detailed job cards and powerful action buttons.
                </p>
                
                <div className="bg-white rounded-lg border border-purple-200 p-4">
                  <h5 className="font-semibold text-purple-900 mb-3">📋 Job Card Details - What Each Card Shows:</h5>
                  <ul className="space-y-2 text-sm text-purple-700">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Job Title:</strong> Clear position name (e.g., "Senior Staff Nurse", "Dental Hygienist")</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Department:</strong> Color-coded badge showing department (Dental, Cardiology, Orthopedics, etc.)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Job Type Badge:</strong> Employment type indicator - Full-time, Part-time, Internship, or Contract</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Location:</strong> Clinic location or facility name with city/emirate</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Salary Range:</strong> Compensation package (e.g., "AED 8,000 - 12,000 per month")</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Posted Date:</strong> When the job was originally posted</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Application Deadline:</strong> Last date for candidates to apply</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Applications Count:</strong> Number of candidates who applied (e.g., "15 Applications")</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Status Badge:</strong> Current job status - Active, Inactive, Pending, Approved, or Declined</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                  <h5 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
                    🎯 Action Buttons Available on Each Job Card:
                  </h5>
                  <div className="space-y-3 text-sm text-purple-700">
                    <div className="bg-white rounded-lg p-3 border-l-4 border-blue-500">
                      <p className="font-semibold mb-1">👁️ Preview Button</p>
                      <p className="text-xs">View how the job posting appears to the public on your career page. Opens a preview window showing exactly what candidates will see including job description, requirements, benefits, and application form.</p>
                    </div>
                    
                    <div className="bg-white rounded-lg p-3 border-l-4 border-green-500">
                      <p className="font-semibold mb-1">✏️ Edit Button</p>
                      <p className="text-xs">Update and modify job details including title, description, requirements, benefits, salary, deadline, or any other information. Changes are saved immediately and reflected in the public listing.</p>
                    </div>
                    
                    <div className="bg-white rounded-lg p-3 border-l-4 border-orange-500">
                      <p className="font-semibold mb-1">🚫 Unpublish Button</p>
                      <p className="text-xs">Temporarily hide the job from public listings without deleting it. The job becomes invisible to candidates but remains in your system. Useful when you want to pause applications temporarily or have filled the position temporarily.</p>
                    </div>
                    
                    <div className="bg-white rounded-lg p-3 border-l-4 border-red-500">
                      <p className="font-semibold mb-1">🗑️ Delete Button</p>
                      <p className="text-xs">Permanently remove the job posting from the system. This action cannot be undone! All associated data including applications may be deleted. Use with caution - typically used for incorrect postings or cancelled positions.</p>
                    </div>
                    
                    <div className="bg-white rounded-lg p-3 border-l-4 border-purple-500">
                      <p className="font-semibold mb-1">📄 View Details Option</p>
                      <p className="text-xs">Expands the job card to show complete information about the posting including full description, detailed requirements, all benefits, internal notes, creation date, last modified date, and complete application statistics.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-purple-200 p-4">
                  <h5 className="font-semibold text-purple-900 mb-3">🔍 Search & Filter Options at the Top:</h5>
                  <div className="space-y-3 text-sm text-purple-700">
                    <p><strong>Search Bar Features:</strong></p>
                    <ul className="list-disc list-inside ml-5 space-y-1">
                      <li>Search by job title - Type keywords like "Nurse", "Doctor", "Receptionist"</li>
                      <li>Search by company/clinic name - Find jobs for specific facilities</li>
                      <li>Search by department - Quick filter for specific departments</li>
                      <li>Real-time search results as you type</li>
                      <li>Clear button to reset search instantly</li>
                    </ul>
                    
                    <p className="mt-3"><strong>Filter Options Available:</strong></p>
                    <ul className="list-disc list-inside ml-5 space-y-2">
                      <li>
                        <strong>By Job Status:</strong>
                        <ul className="list-circle ml-5 mt-1 space-y-1">
                          <li><strong>Active:</strong> Currently live and accepting applications</li>
                          <li><strong>Inactive:</strong> Temporarily hidden or paused</li>
                          <li><strong>Pending:</strong> Awaiting approval from administrator</li>
                          <li><strong>Approved:</strong> Approved and publicly visible</li>
                          <li><strong>Declined:</strong> Rejected by administrator (with reason)</li>
                        </ul>
                      </li>
                      <li>
                        <strong>By Employment Type:</strong>
                        <ul className="list-circle ml-5 mt-1 space-y-1">
                          <li>Full-time positions</li>
                          <li>Part-time positions</li>
                          <li>Internship positions</li>
                          <li>Contract positions</li>
                        </ul>
                      </li>
                      <li>
                        <strong>By Department:</strong>
                        <ul className="list-circle ml-5 mt-1 space-y-1">
                          <li>Dental / Odontology</li>
                          <li>Cardiology</li>
                          <li>Orthopedics</li>
                          <li>Pediatrics</li>
                          <li>Dermatology</li>
                          <li>General Practice</li>
                          <li>All departments dropdown</li>
                        </ul>
                      </li>
                      <li>
                        <strong>By Date Range:</strong>
                        <ul className="list-circle ml-5 mt-1 space-y-1">
                          <li>Last 7 days</li>
                          <li>Last 30 days</li>
                          <li>Last 3 months</li>
                          <li>Last 6 months</li>
                          <li>Custom date range picker</li>
                        </ul>
                      </li>
                      <li>
                        <strong>By Location:</strong>
                        <ul className="list-circle ml-5 mt-1 space-y-1">
                          <li>Filter by city/emirate</li>
                          <li>Filter by specific clinic branch</li>
                        </ul>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                  <h5 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
                    📊 Job Status Types Explained:
                  </h5>
                  <div className="space-y-2 text-sm text-purple-700">
                    <div className="bg-green-50 rounded-lg p-2 border-l-4 border-green-500">
                      <p className="font-semibold text-green-900">✅ Active (Green Badge)</p>
                      <p className="text-xs text-green-700">Job is live, publicly visible, and actively accepting applications. Candidates can find and apply to this position.</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2 border-l-4 border-gray-500">
                      <p className="font-semibold text-gray-900">⏸️ Inactive (Gray Badge)</p>
                      <p className="text-xs text-gray-700">Job is temporarily hidden from public view. Not accepting new applications. Can be reactivated anytime.</p>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-2 border-l-4 border-yellow-500">
                      <p className="font-semibold text-yellow-900">⏳ Pending (Yellow Badge)</p>
                      <p className="text-xs text-yellow-700">Job is submitted and awaiting administrator approval. Not yet visible to candidates.</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-2 border-l-4 border-blue-500">
                      <p className="font-semibold text-blue-900">✓ Approved (Blue Badge)</p>
                      <p className="text-xs text-blue-700">Administrator has approved the job posting. It's now live and visible to candidates.</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-2 border-l-4 border-red-500">
                      <p className="font-semibold text-red-900">❌ Declined (Red Badge)</p>
                      <p className="text-xs text-red-700">Administrator has rejected the job posting. Usually includes a reason for decline. Needs correction before resubmission.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-purple-200 p-4">
                  <h5 className="font-semibold text-purple-900 mb-3">💡 Quick Tips for Managing Jobs:</h5>
                  <ul className="list-disc list-inside space-y-2 text-sm text-purple-700">
                    <li>Use <strong>Preview</strong> before publishing to ensure everything looks correct</li>
                    <li><strong>Edit</strong> jobs regularly to keep descriptions current and accurate</li>
                    <li>Use <strong>Unpublish</strong> instead of delete when temporarily pausing recruitment</li>
                    <li>Only use <strong>Delete</strong> for test posts or cancelled positions</li>
                    <li>Monitor <strong>Applications Count</strong> to gauge job posting effectiveness</li>
                    <li>Keep job status updated to reflect current hiring state</li>
                    <li>Use filters to quickly find specific jobs in your list</li>
                    <li>Set appropriate deadlines to create urgency for candidates</li>
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
                    <p className="text-purple-700 text-sm mb-2"><strong>Upload:</strong> /my-all-jobs-section.png</p>
                    <p className="text-purple-600 text-xs">Drag & drop or click to upload screenshot of My All Jobs section with action buttons and filters</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Applicants Section */}
        {activeSection === "applicants" && (
          <div className="space-y-8">
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-l-4 border-orange-500 p-6 rounded-r-lg">
              <h4 className="font-bold text-lg text-orange-900 mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 bg-orange-600 text-white rounded-full text-sm font-bold">2</span>
                Job Applications Section - Complete Guide
              </h4>
              <div className="ml-10 space-y-4">
                <p className="text-base text-orange-800 leading-relaxed">
                  The "Job Applications" section is your centralized dashboard to review, filter, 
                  and manage all applications received for your job postings. This is where you find 
                  and hire the best healthcare talent for your clinic.
                </p>
                
                <div className="bg-white rounded-lg border border-orange-200 p-4">
                  <h5 className="font-semibold text-orange-900 mb-3">📋 What You Can Do in This Section:</h5>
                  <ul className="space-y-2 text-sm text-orange-700">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>View All Applications:</strong> See every application across all job postings</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Filter by Job Position:</strong> View applications for specific jobs only</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Filter by Employment Type:</strong> See Full-time, Part-time, or Internship applicants</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Status Tracking:</strong> Monitor each application's progress through hiring stages</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Search Candidates:</strong> Find applicants by name, qualification, or specialty</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Profile Preview:</strong> View complete candidate profiles, resumes, and credentials</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Update Status:</strong> Move candidates through hiring pipeline (New → Reviewed → Interview → Hired)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Bulk Actions:</strong> Update status for multiple applicants simultaneously</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Communication:</strong> Send emails or messages to selected candidates</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Rate & Rank:</strong> Score candidates based on their qualifications</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Add Notes:</strong> Internal comments and evaluation notes for each candidate</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Download Resumes:</strong> Save candidate CVs for offline review</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                  <h5 className="font-semibold text-orange-900 mb-2 flex items-center gap-2">
                    🎯 Action Buttons Available on Each Applicant Card:
                  </h5>
                  <div className="space-y-3 text-sm text-orange-700">
                    <div className="bg-white rounded-lg p-3 border-l-4 border-blue-500">
                      <p className="font-semibold mb-1">📧 Contact Button</p>
                      <p className="text-xs">Reach out to the applicant directly via email or phone. Opens email composer or phone dialer. Use this to schedule interviews, request additional information, or provide updates about their application status.</p>
                    </div>
                    
                    <div className="bg-white rounded-lg p-3 border-l-4 border-red-500">
                      <p className="font-semibold mb-1">❌ Reject Button</p>
                      <p className="text-xs">Decline the application professionally. Sends a polite rejection email to the candidate and updates their status to "Rejected". Use this when the candidate doesn't meet requirements or when you've selected other candidates.</p>
                    </div>
                    
                    <div className="bg-white rounded-lg p-3 border-l-4 border-purple-500">
                      <p className="font-semibold mb-1">🗑️ Delete Button</p>
                      <p className="text-xs">Permanently remove the applicant record from the system. This action cannot be undone! Use this for spam applications, duplicate submissions, or when candidates request data deletion. Deletes all associated data including resume and notes.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-orange-200 p-4">
                  <h5 className="font-semibold text-orange-900 mb-3">🔍 Filter Options at the Top - Categorize Applications:</h5>
                  <div className="space-y-3 text-sm text-orange-700">
                    <p><strong>Main Filter Tabs (Quick Categorization):</strong></p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                        <p className="font-semibold text-blue-900 text-sm">All</p>
                        <p className="text-xs text-blue-700">Show all applications across all jobs</p>
                      </div>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-2">
                        <p className="font-semibold text-green-900 text-sm">Full-Time</p>
                        <p className="text-xs text-green-700">Only full-time position applicants</p>
                      </div>
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-2">
                        <p className="font-semibold text-purple-900 text-sm">Part-Time</p>
                        <p className="text-xs text-purple-700">Only part-time position applicants</p>
                      </div>
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-2">
                        <p className="font-semibold text-orange-900 text-sm">Internship</p>
                        <p className="text-xs text-orange-700">Only internship program applicants</p>
                      </div>
                    </div>
                    
                    <p className="mt-3"><strong>Advanced Filter Options:</strong></p>
                    <ul className="list-disc list-inside ml-5 space-y-2">
                      <li>
                        <strong>Filter by Job Position:</strong>
                        <ul className="list-circle ml-5 mt-1 space-y-1">
                          <li>Select specific job to see only those applicants</li>
                          <li>Dropdown shows all your active job postings</li>
                          <li>Example: Filter to see only "ICU Nurse" applicants</li>
                        </ul>
                      </li>
                      <li>
                        <strong>Filter by Application Status:</strong>
                        <ul className="list-circle ml-5 mt-1 space-y-1">
                          <li><strong>New:</strong> Recently submitted (not yet reviewed)</li>
                          <li><strong>Reviewed:</strong> Already assessed by HR</li>
                          <li><strong>Shortlisted:</strong> Selected for interview</li>
                          <li><strong>Interview Scheduled:</strong> Interview confirmed</li>
                          <li><strong>Offer Extended:</strong> Job offer sent</li>
                          <li><strong>Hired:</strong> Candidate accepted and joined</li>
                          <li><strong>Rejected:</strong> Not selected</li>
                        </ul>
                      </li>
                      <li>
                        <strong>Filter by Department:</strong>
                        <ul className="list-circle ml-5 mt-1 space-y-1">
                          <li>Dental, Cardiology, Orthopedics, Pediatrics</li>
                          <li>Dermatology, General Practice, etc.</li>
                        </ul>
                      </li>
                      <li>
                        <strong>Filter by Experience Level:</strong>
                        <ul className="list-circle ml-5 mt-1 space-y-1">
                          <li>Fresh Graduate (0 years)</li>
                          <li>Junior (1-2 years)</li>
                          <li>Mid-level (3-5 years)</li>
                          <li>Senior (5+ years)</li>
                        </ul>
                      </li>
                      <li>
                        <strong>Filter by Date Applied:</strong>
                        <ul className="list-circle ml-5 mt-1 space-y-1">
                          <li>Last 7 days</li>
                          <li>Last 30 days</li>
                          <li>Last 3 months</li>
                          <li>Custom date range picker</li>
                        </ul>
                      </li>
                      <li>
                        <strong>Search Bar:</strong>
                        <ul className="list-circle ml-5 mt-1 space-y-1">
                          <li>Search by candidate name</li>
                          <li>Search by email address</li>
                          <li>Search by phone number</li>
                          <li>Search by qualifications</li>
                          <li>Search by keywords in resume</li>
                        </ul>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                  <h5 className="font-semibold text-orange-900 mb-2 flex items-center gap-2">
                    📋 Applicant Card Information - What Each Card Shows:
                  </h5>
                  <ul className="space-y-2 text-sm text-orange-700">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Name:</strong> Full name of the candidate (e.g., "Sarah Johnson")</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Email:</strong> Primary email address for communication (e.g., "sarah.j@email.com")</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Phone Number:</strong> Contact number (e.g., "+971 50 123 4567")</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Role/Position Applied:</strong> Which job they applied for (e.g., "Staff Nurse - ICU")</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Resume:</strong> Downloadable CV/Resume file (PDF or DOC format)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Photo:</strong> Professional headshot (if provided by candidate)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Employment Type Preference:</strong> Full-time, Part-time, or Internship badge</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Years of Experience:</strong> Total relevant experience (e.g., "5 years")</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Key Qualifications:</strong> Degrees, certifications, licenses (e.g., "BSN, RN License")</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Application Date:</strong> When they submitted their application</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Current Status:</strong> Application stage (New, Reviewed, Shortlisted, Interview, Hired, Rejected)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Cover Letter:</strong> Candidate's motivation letter explaining why they want the position</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-white rounded-lg border border-orange-200 p-4">
                  <h5 className="font-semibold text-orange-900 mb-3">📊 Typical Applicant Workflow:</h5>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-orange-700">
                    <li><strong>Application Received:</strong> Candidate applies online → Status: "New"</li>
                    <li><strong>Initial Review:</strong> HR reviews resume and cover letter → Status: "Reviewed"</li>
                    <li><strong>Screening:</strong> Verify qualifications and experience → Add rating and notes</li>
                    <li><strong>Shortlist:</strong> Select best candidates for interview → Status: "Shortlisted"</li>
                    <li><strong>Contact:</strong> Use Contact button to schedule interviews</li>
                    <li><strong>Interview:</strong> Conduct interview (in-person or virtual) → Status: "Interview Scheduled"</li>
                    <li><strong>Decision:</strong> Add interview feedback and internal notes</li>
                    <li><strong>Offer:</strong> Extend job offer to selected candidate → Status: "Offer Extended"</li>
                    <li><strong>Hiring:</strong> Candidate accepts → Status: "Hired"</li>
                    <li><strong>Rejection:</strong> Use Reject button for non-selected candidates → Status: "Rejected"</li>
                  </ol>
                </div>

                <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                  <h5 className="font-semibold text-orange-900 mb-2 flex items-center gap-2">
                    💡 Pro Tips for Managing Applicants:
                  </h5>
                  <ul className="list-disc list-inside space-y-2 text-sm text-orange-700">
                    <li>Use <strong>Contact</strong> button to maintain professional communication with candidates</li>
                    <li>Use <strong>Reject</strong> promptly to keep candidates informed about their status</li>
                    <li>Only use <strong>Delete</strong> for spam, duplicates, or data privacy requests</li>
                    <li>Respond to all applications within 48 hours for better candidate experience</li>
                    <li>Use filters effectively to focus on relevant candidates (e.g., only Full-time nurses)</li>
                    <li>Add detailed notes for each candidate to help with evaluation</li>
                    <li>Use bulk actions to update status for multiple similar applicants together</li>
                    <li>Rate candidates consistently using the 1-5 star rating system</li>
                    <li>Keep the pipeline moving - regularly review and update statuses</li>
                    <li>Download important resumes for offline review and sharing with hiring managers</li>
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
                    <p className="text-orange-700 text-sm mb-2"><strong>Upload:</strong> /job-applications-section.png</p>
                    <p className="text-orange-600 text-xs">Drag & drop or click to upload screenshot of Job Applications section with filters</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Permissions Section */}
        {activeSection === "permissions" && (
          <div className="space-y-8">
            <div className="bg-gradient-to-r from-cyan-50 to-blue-50 border-l-4 border-cyan-500 p-6 rounded-r-lg">
              <h4 className="font-bold text-lg text-cyan-900 mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 bg-cyan-600 text-white rounded-full text-sm font-bold">4</span>
                Permissions & Access Control
              </h4>
              <div className="ml-10 space-y-4">
                <p className="text-base text-cyan-800 leading-relaxed">
                  The job posting module uses granular permission controls to ensure proper access 
                  and maintain data security across different user roles.
                </p>
                
                <div className="bg-white rounded-lg border border-cyan-200 p-4">
                  <h5 className="font-semibold text-cyan-900 mb-3">Job Posting Permissions:</h5>
                  <ul className="space-y-2 text-sm text-cyan-700">
                    <li><strong>canCreate:</strong> Ability to create new job postings</li>
                    <li><strong>canRead:</strong> Ability to view all job postings</li>
                    <li><strong>canUpdate:</strong> Ability to edit existing job postings</li>
                    <li><strong>canDelete:</strong> Ability to remove job postings</li>
                  </ul>
                </div>

                <div className="bg-white rounded-lg border border-cyan-200 p-4">
                  <h5 className="font-semibold text-cyan-900 mb-3">Applicant Permissions:</h5>
                  <ul className="space-y-2 text-sm text-cyan-700">
                    <li><strong>canReadApplicants:</strong> View job applications and candidate profiles</li>
                    <li><strong>canUpdateApplicants:</strong> Update application status and add notes</li>
                    <li><strong>canDeleteApplicants:</strong> Remove applications from the system</li>
                  </ul>
                </div>

                <div className="bg-cyan-50 rounded-lg p-4 border border-cyan-200">
                  <h5 className="font-semibold text-cyan-900 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Permission Scenarios:
                  </h5>
                  <div className="space-y-2 text-sm text-cyan-700">
                    <p><strong>Scenario 1: Can Create but Cannot Read Applicants</strong></p>
                    <ul className="list-disc list-inside ml-5 space-y-1">
                      <li>User can post new jobs</li>
                      <li>User cannot see who applied</li>
                      <li>Common for junior HR staff</li>
                    </ul>
                    
                    <p className="mt-3"><strong>Scenario 2: Can Read but Cannot Create</strong></p>
                    <ul className="list-disc list-inside ml-5 space-y-1">
                      <li>User can view all job postings</li>
                      <li>User can see all applicants</li>
                      <li>User cannot create new jobs</li>
                      <li>Common for department managers</li>
                    </ul>
                    
                    <p className="mt-3"><strong>Scenario 3: Full Access</strong></p>
                    <ul className="list-disc list-inside ml-5 space-y-1">
                      <li>All permissions enabled</li>
                      <li>Can manage entire recruitment workflow</li>
                      <li>Typical for HR managers and administrators</li>
                    </ul>
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-cyan-200 p-4">
                  <h5 className="font-semibold text-cyan-900 mb-3">Access Denied Messages:</h5>
                  <p className="text-sm text-cyan-700 mb-2">
                    When you don't have required permissions, you'll see clear messages explaining:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-cyan-700">
                    <li>What permission is missing</li>
                    <li>What actions you can still perform</li>
                    <li>Who to contact for access requests</li>
                  </ul>
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
                    <p className="text-cyan-700 text-sm mb-2"><strong>Upload:</strong> /permissions-denied-message.png</p>
                    <p className="text-cyan-600 text-xs">Drag & drop or click to upload screenshot of permission denied message</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Best Practices Section */}
        {activeSection === "best-practices" && (
          <div className="space-y-8">
            <div className="bg-gradient-to-r from-slate-50 to-gray-50 border-l-4 border-slate-500 p-6 rounded-r-lg">
              <h4 className="font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
                <CheckCircle className="w-6 h-6" />
                Job Posting Best Practices
              </h4>
              <div className="ml-10 space-y-3">
                <ul className="list-disc list-inside space-y-2 text-base text-slate-700">
                  <li><strong>Write Clear Job Titles:</strong> Use industry-standard titles that candidates search for</li>
                  <li><strong>Be Specific About Requirements:</strong> Clearly distinguish between required and preferred qualifications</li>
                  <li><strong>Highlight Benefits:</strong> Showcase what makes your facility a great place to work</li>
                  <li><strong>Include Salary Range:</strong> Transparency attracts serious candidates</li>
                  <li><strong>Describe Company Culture:</strong> Help candidates understand your work environment</li>
                  <li><strong>Set Realistic Deadlines:</strong> Give enough time for quality applications</li>
                  <li><strong>Respond Promptly:</strong> Acknowledge applications within 48 hours</li>
                  <li><strong>Keep Postings Updated:</strong> Close filled positions promptly</li>
                  <li><strong>Use SEO Keywords:</strong> Include relevant terms for better visibility</li>
                  <li><strong>Mobile-Friendly:</strong> Ensure forms work well on mobile devices</li>
                  <li><strong>Compliance:</strong> Follow UAE labor laws and healthcare regulations</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Integration Note */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500 p-6 rounded-r-lg mt-8">
          <h4 className="font-bold text-lg text-green-900 mb-4 flex items-center gap-2">
            <CheckCircle className="w-6 h-6" />
            How Job Posting Integrates with Other Modules
          </h4>
          <div className="ml-10 space-y-3">
            <p className="text-base text-green-800 leading-relaxed">
              The Job Posting module connects with various clinic management systems:
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm text-green-700">
              <li><strong>HR Management:</strong> Part of overall human resources workflow</li>
              <li><strong>Departments:</strong> Jobs linked to specific departments</li>
              <li><strong>Staff Onboarding:</strong> Hired candidates transition to employee records</li>
              <li><strong>Permissions:</strong> Integrated with role-based access control</li>
              <li><strong>Email Notifications:</strong> Automated communications to applicants</li>
              <li><strong>Reports:</strong> Recruitment metrics and analytics</li>
              <li><strong>Agent Portal:</strong> External recruiters can post jobs (with permissions)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobPostingGuide;
