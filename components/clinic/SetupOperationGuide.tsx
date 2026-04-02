"use client";
import React, { useState } from 'react';
import { ClipboardList, Building2, Users, Wrench, CheckCircle, AlertCircle, Package } from 'lucide-react';

const SetupOperationGuide: React.FC = () => {
  const [activeSection, setActiveSection] = useState("rooms");

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header Section */}
      <div className="flex items-center gap-3 mb-8">
        <ClipboardList className="w-10 h-10 text-teal-600" />
        <h2 className="text-3xl font-bold text-gray-900">Setup & Operation</h2>
      </div>
      
      <div className="prose max-w-none">
        <h3 className="text-2xl font-semibold text-gray-800 mb-4">Clinic Setup & Operational Configuration Guide</h3>
        <p className="text-base text-gray-600 mb-8 leading-relaxed">
          The Setup & Operation module is where you configure your clinic's physical infrastructure, 
          including rooms, departments, facilities, and operational workflows. This comprehensive guide 
          covers all aspects of clinic setup and configuration.
        </p>

        {/* Quick Navigation */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8 shadow-sm">
          <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Quick Navigation
          </h4>
          <div className="grid md:grid-cols-3 gap-3">
            <button
              onClick={() => setActiveSection("rooms")}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                activeSection === "rooms"
                  ? "border-teal-500 bg-teal-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-5 h-5 text-teal-600" />
                <span className="font-semibold text-gray-900">Rooms Setup</span>
              </div>
              <p className="text-xs text-gray-600">Create and manage examination rooms</p>
            </button>
            
            <button
              onClick={() => setActiveSection("departments")}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                activeSection === "departments"
                  ? "border-teal-500 bg-teal-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-5 h-5 text-teal-600" />
                <span className="font-semibold text-gray-900">Departments</span>
              </div>
              <p className="text-xs text-gray-600">Organize clinical departments</p>
            </button>
            
            <button
              onClick={() => setActiveSection("facilities")}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                activeSection === "facilities"
                  ? "border-teal-500 bg-teal-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Wrench className="w-5 h-5 text-teal-600" />
                <span className="font-semibold text-gray-900">Facilities</span>
              </div>
              <p className="text-xs text-gray-600">Equipment and resources</p>
            </button>
          </div>
        </div>

        {/* Rooms Setup Section */}
        {activeSection === "rooms" && (
          <div className="space-y-8">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 p-6 rounded-r-lg">
              <h4 className="font-bold text-lg text-blue-900 mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full text-sm font-bold">1</span>
                Rooms Setup Overview
              </h4>
              <div className="ml-10 space-y-4">
                <p className="text-base text-blue-800 leading-relaxed">
                  The Rooms Setup module allows you to create and manage all examination rooms, consultation chambers, 
                  and treatment areas in your clinic. Each room can be configured with specific attributes and capabilities.
                </p>
                
                <div className="bg-white rounded-lg border border-blue-200 p-4">
                  <h5 className="font-semibold text-blue-900 mb-3">Room Configuration Features:</h5>
                  <ul className="space-y-2 text-sm text-blue-700">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Room Name & Number:</strong> Unique identifier for each room</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Room Type:</strong> Consultation, Examination, Procedure, Recovery, etc.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Capacity:</strong> Maximum number of patients or people</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Equipment:</strong> Available medical equipment in the room</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Accessibility:</strong> Wheelchair access, special needs accommodations</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <span><strong>Status:</strong> Active, Inactive, Under Maintenance</span>
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
                    <p className="text-blue-700 text-sm mb-2"><strong>Upload:</strong> /rooms-setup-interface.png</p>
                    <p className="text-blue-600 text-xs">Drag & drop or click to upload screenshot of Rooms Setup interface</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Creating Rooms */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500 p-6 rounded-r-lg">
              <h4 className="font-bold text-lg text-green-900 mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 bg-green-600 text-white rounded-full text-sm font-bold">2</span>
                Creating New Rooms
              </h4>
              <div className="ml-10 space-y-4">
                <p className="text-base text-green-800 leading-relaxed">
                  Follow these steps to add new rooms to your clinic:
                </p>
                
                <div className="bg-white rounded-lg border border-green-200 p-4">
                  <h5 className="font-semibold text-green-900 mb-3">Step-by-Step Process:</h5>
                  <ol className="list-decimal list-inside space-y-3 text-sm text-green-700">
                    <li><strong>Click "Add Room" button</strong> - Located in the Rooms section</li>
                    <li><strong>Enter room details:</strong>
                      <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
                        <li>Room name/number (e.g., "Consultation Room 1")</li>
                        <li>Select room type from dropdown</li>
                        <li>Set maximum capacity</li>
                        <li>Choose floor/location within clinic</li>
                      </ul>
                    </li>
                    <li><strong>Configure equipment:</strong>
                      <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
                        <li>Select available medical equipment</li>
                        <li>Add custom equipment if needed</li>
                      </ul>
                    </li>
                    <li><strong>Set accessibility options:</strong>
                      <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
                        <li>Wheelchair accessible</li>
                        <li>Special needs support</li>
                      </ul>
                    </li>
                    <li><strong>Save the room</strong> - Click "Create Room" to save</li>
                  </ol>
                </div>

                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <h5 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Important Notes:
                  </h5>
                  <ul className="list-disc list-inside space-y-1 text-sm text-green-700">
                    <li>Each room must have a unique name/number</li>
                    <li>Room capacity affects appointment scheduling</li>
                    <li>Equipment availability impacts service assignment</li>
                    <li>Inactive rooms won't appear in appointment booking</li>
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
                    <p className="text-green-700 text-sm mb-2"><strong>Upload:</strong> /create-room-form.png</p>
                    <p className="text-green-600 text-xs">Drag & drop or click to upload screenshot of Create Room form</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Room Management */}
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-l-4 border-purple-500 p-6 rounded-r-lg">
              <h4 className="font-bold text-lg text-purple-900 mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 bg-purple-600 text-white rounded-full text-sm font-bold">3</span>
                Room Management
              </h4>
              <div className="ml-10 space-y-4">
                <p className="text-base text-purple-800 leading-relaxed">
                  Manage existing rooms with these features:
                </p>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-lg border border-purple-200 p-4">
                    <h5 className="font-semibold text-purple-900 mb-3">Edit Rooms:</h5>
                    <ul className="space-y-2 text-sm text-purple-700">
                      <li>• Update room details and configuration</li>
                      <li>• Change room type or capacity</li>
                      <li>• Modify equipment list</li>
                      <li>• Toggle active/inactive status</li>
                    </ul>
                  </div>
                  
                  <div className="bg-white rounded-lg border border-purple-200 p-4">
                    <h5 className="font-semibold text-purple-900 mb-3">Room Actions:</h5>
                    <ul className="space-y-2 text-sm text-purple-700">
                      <li>• View room schedule</li>
                      <li>• Set maintenance periods</li>
                      <li>• Track utilization metrics</li>
                      <li>• Archive unused rooms</li>
                    </ul>
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
                    <p className="text-purple-700 text-sm mb-2"><strong>Upload:</strong> /room-management-view.png</p>
                    <p className="text-purple-600 text-xs">Drag & drop or click to upload screenshot of Room Management interface</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Departments Section */}
        {activeSection === "departments" && (
          <div className="space-y-8">
            <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border-l-4 border-teal-500 p-6 rounded-r-lg">
              <h4 className="font-bold text-lg text-teal-900 mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 bg-teal-600 text-white rounded-full text-sm font-bold">1</span>
                Departments Configuration
              </h4>
              <div className="ml-10 space-y-4">
                <p className="text-base text-teal-800 leading-relaxed">
                  Organize your clinic into departments for better management and workflow optimization. 
                  Departments help categorize services, assign staff, and track performance.
                </p>
                
                <div className="bg-white rounded-lg border border-teal-200 p-4">
                  <h5 className="font-semibold text-teal-900 mb-3">Common Clinic Departments:</h5>
                  <div className="grid md:grid-cols-2 gap-3 text-sm text-teal-700">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span>Dental / Odontology</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span>Cardiology</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span>Orthopedics</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span>Pediatrics</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span>Dermatology</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span>Neurology</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span>Ophthalmology</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span>General Practice</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-teal-200 p-4 mt-4">
                  <h5 className="font-semibold text-teal-900 mb-3">Department Setup:</h5>
                  <ul className="space-y-2 text-sm text-teal-700">
                    <li><strong>Department Name:</strong> Clear, descriptive name</li>
                    <li><strong>Department Head:</strong> Assign lead doctor/consultant</li>
                    <li><strong>Staff Assignment:</strong> Add doctors, nurses, and support staff</li>
                    <li><strong>Services Link:</strong> Associate services with department</li>
                    <li><strong>Working Hours:</strong> Set department-specific schedules</li>
                    <li><strong>Contact Info:</strong> Internal extension or direct line</li>
                  </ul>
                </div>

                {/* Screenshot Upload Area */}
                <div className="mt-6 bg-white rounded-lg border-2 border-dashed border-teal-300 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <h5 className="font-semibold text-teal-900 text-base">Screenshot Upload Area</h5>
                  </div>
                  <div className="bg-teal-50 rounded-lg p-8 text-center border-2 border-dashed border-teal-200">
                    <p className="text-teal-700 text-sm mb-2"><strong>Upload:</strong> /departments-setup.png</p>
                    <p className="text-teal-600 text-xs">Drag & drop or click to upload screenshot of Departments configuration</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Department Management */}
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-l-4 border-orange-500 p-6 rounded-r-lg">
              <h4 className="font-bold text-lg text-orange-900 mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 bg-orange-600 text-white rounded-full text-sm font-bold">2</span>
                Department Management
              </h4>
              <div className="ml-10 space-y-4">
                <p className="text-base text-orange-800 leading-relaxed">
                  Effective department management ensures smooth clinic operations:
                </p>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-lg border border-orange-200 p-4">
                    <h5 className="font-semibold text-orange-900 mb-3">Key Features:</h5>
                    <ul className="space-y-2 text-sm text-orange-700">
                      <li>• Edit department details</li>
                      <li>• Reassign department head</li>
                      <li>• Manage staff rosters</li>
                      <li>• Update working hours</li>
                      <li>• Add/remove services</li>
                    </ul>
                  </div>
                  
                  <div className="bg-white rounded-lg border border-orange-200 p-4">
                    <h5 className="font-semibold text-orange-900 mb-3">Analytics:</h5>
                    <ul className="space-y-2 text-sm text-orange-700">
                      <li>• Patient volume by department</li>
                      <li>• Revenue tracking</li>
                      <li>• Staff performance metrics</li>
                      <li>• Resource utilization</li>
                    </ul>
                  </div>
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
                    <p className="text-orange-700 text-sm mb-2"><strong>Upload:</strong> /department-analytics.png</p>
                    <p className="text-orange-600 text-xs">Drag & drop or click to upload screenshot of Department Analytics</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Facilities Section */}
        {activeSection === "facilities" && (
          <div className="space-y-8">
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border-l-4 border-indigo-500 p-6 rounded-r-lg">
              <h4 className="font-bold text-lg text-indigo-900 mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 bg-indigo-600 text-white rounded-full text-sm font-bold">1</span>
                Facilities & Equipment Management
              </h4>
              <div className="ml-10 space-y-4">
                <p className="text-base text-indigo-800 leading-relaxed">
                  Track and manage your clinic's medical equipment, facilities, and resources to ensure 
                  optimal utilization and maintenance scheduling.
                </p>
                
                <div className="bg-white rounded-lg border border-indigo-200 p-4">
                  <h5 className="font-semibold text-indigo-900 mb-3">Equipment Categories:</h5>
                  <div className="space-y-2 text-sm text-indigo-700">
                    <p><strong>Diagnostic Equipment:</strong></p>
                    <ul className="list-disc list-inside ml-5 space-y-1">
                      <li>X-Ray machines</li>
                      <li>Ultrasound systems</li>
                      <li>ECG monitors</li>
                      <li>Blood analysis analyzers</li>
                    </ul>
                    <p className="mt-3"><strong>Treatment Equipment:</strong></p>
                    <ul className="list-disc list-inside ml-5 space-y-1">
                      <li>Laser therapy devices</li>
                      <li>Surgical equipment</li>
                      <li>Physical therapy apparatus</li>
                    </ul>
                    <p className="mt-3"><strong>Support Facilities:</strong></p>
                    <ul className="list-disc list-inside ml-5 space-y-1">
                      <li>Waiting area amenities</li>
                      <li>Reception systems</li>
                      <li>IT infrastructure</li>
                    </ul>
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-indigo-200 p-4 mt-4">
                  <h5 className="font-semibold text-indigo-900 mb-3">Equipment Tracking:</h5>
                  <ul className="space-y-2 text-sm text-indigo-700">
                    <li><strong>Equipment ID:</strong> Unique identifier for each item</li>
                    <li><strong>Purchase Date:</strong> Track warranty and depreciation</li>
                    <li><strong>Maintenance Schedule:</strong> Regular servicing intervals</li>
                    <li><strong>Location:</strong> Which room/department it's assigned to</li>
                    <li><strong>Status:</strong> Operational, Under Maintenance, Out of Service</li>
                    <li><strong>User Manual:</strong> Attach documentation</li>
                  </ul>
                </div>

                {/* Screenshot Upload Area */}
                <div className="mt-6 bg-white rounded-lg border-2 border-dashed border-indigo-300 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <h5 className="font-semibold text-indigo-900 text-base">Screenshot Upload Area</h5>
                  </div>
                  <div className="bg-indigo-50 rounded-lg p-8 text-center border-2 border-dashed border-indigo-200">
                    <p className="text-indigo-700 text-sm mb-2"><strong>Upload:</strong> /facilities-equipment-view.png</p>
                    <p className="text-indigo-600 text-xs">Drag & drop or click to upload screenshot of Facilities & Equipment management</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Maintenance Scheduling */}
            <div className="bg-gradient-to-r from-red-50 to-pink-50 border-l-4 border-red-500 p-6 rounded-r-lg">
              <h4 className="font-bold text-lg text-red-900 mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 bg-red-600 text-white rounded-full text-sm font-bold">2</span>
                Maintenance Scheduling
              </h4>
              <div className="ml-10 space-y-4">
                <p className="text-base text-red-800 leading-relaxed">
                  Preventive maintenance ensures equipment reliability and patient safety:
                </p>
                
                <div className="bg-white rounded-lg border border-red-200 p-4">
                  <h5 className="font-semibold text-red-900 mb-3">Maintenance Types:</h5>
                  <ul className="space-y-2 text-sm text-red-700">
                    <li><strong>Routine Maintenance:</strong> Scheduled inspections and servicing</li>
                    <li><strong>Calibration:</strong> Regular accuracy checks for diagnostic equipment</li>
                    <li><strong>Emergency Repairs:</strong> Unscheduled breakdown response</li>
                    <li><strong>Software Updates:</strong> Firmware and system upgrades</li>
                  </ul>
                </div>

                <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                  <h5 className="font-semibold text-red-900 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Compliance Requirements:
                  </h5>
                  <ul className="list-disc list-inside space-y-1 text-sm text-red-700">
                    <li>Maintain maintenance logs for regulatory compliance</li>
                    <li>Track calibration certificates</li>
                    <li>Document all repairs and interventions</li>
                    <li>Schedule regular safety inspections</li>
                  </ul>
                </div>

                {/* Screenshot Upload */}
                <div className="mt-6 bg-white rounded-lg border-2 border-dashed border-red-300 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <h5 className="font-semibold text-red-900 text-base">Screenshot Upload Area</h5>
                  </div>
                  <div className="bg-red-50 rounded-lg p-8 text-center border-2 border-dashed border-red-200">
                    <p className="text-red-700 text-sm mb-2"><strong>Upload:</strong> /maintenance-schedule.png</p>
                    <p className="text-red-600 text-xs">Drag & drop or click to upload screenshot of Maintenance Schedule calendar</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Best Practices Section */}
        <div className="bg-gradient-to-r from-slate-50 to-gray-50 border-l-4 border-slate-500 p-6 rounded-r-lg mt-8">
          <h4 className="font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
            <CheckCircle className="w-6 h-6" />
            Setup & Operation Best Practices
          </h4>
          <div className="ml-10 space-y-3">
            <ul className="list-disc list-inside space-y-2 text-base text-slate-700">
              <li><strong>Plan Ahead:</strong> Map out your clinic layout before creating rooms</li>
              <li><strong>Standardize Naming:</strong> Use consistent naming conventions for rooms and equipment</li>
              <li><strong>Department Alignment:</strong> Align departments with your organizational structure</li>
              <li><strong>Regular Audits:</strong> Conduct periodic equipment and facility audits</li>
              <li><strong>Maintenance Logs:</strong> Keep detailed records of all maintenance activities</li>
              <li><strong>Staff Training:</strong> Ensure staff knows how to use and report issues with equipment</li>
              <li><strong>Compliance:</strong> Follow regulatory guidelines for equipment maintenance and safety</li>
              <li><strong>Scalability:</strong> Design your setup to accommodate future growth</li>
            </ul>
          </div>
        </div>

        {/* Integration Note */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500 p-6 rounded-r-lg mt-8">
          <h4 className="font-bold text-lg text-green-900 mb-4 flex items-center gap-2">
            <Package className="w-6 h-6" />
            How Setup Affects Other Modules
          </h4>
          <div className="ml-10 space-y-3">
            <p className="text-base text-green-800 leading-relaxed">
              Proper setup and configuration impacts all clinic operations:
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm text-green-700">
              <li><strong>Appointments:</strong> Room availability determines booking slots</li>
              <li><strong>Services:</strong> Departments organize service categories</li>
              <li><strong>Billing:</strong> Equipment usage may affect pricing</li>
              <li><strong>Reports:</strong> Utilization metrics inform decision-making</li>
              <li><strong>Staff Scheduling:</strong> Department assignments guide roster creation</li>
              <li><strong>Inventory:</strong> Equipment tracking integrates with stock management</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetupOperationGuide;
