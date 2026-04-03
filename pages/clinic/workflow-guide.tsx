"use client";
import React, { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import Layout from "../../components/Layout";
import withClinicAuth from "../../components/withClinicAuth";
import BookAppointmentWorkflowGuide from '../../components/clinic/BookAppointmentWorkflowGuide';
import type { NextPageWithLayout } from "../_app";
import ManageHealthCenterGuide from "../../components/clinic/ManageHealthCenterGuide";
import CreateOffersGuide from "../../components/clinic/CreateOffersGuide";
import UserPackagesGuide from "../../components/clinic/UserPackagesGuide";
import ServicesGuide from "../../components/clinic/ServicesGuide";
import SetupOperationGuide from "../../components/clinic/SetupOperationGuide";
import ConsentFormGuide from "../../components/clinic/ConsentFormGuide";
import JobPostingGuide from "../../components/clinic/JobPostingGuide";
import CommissionGuide from "../../components/clinic/CommissionGuide";
import ClinicManagementGuide from "../../components/clinic/ClinicManagementGuide";
import ReferralGuide from "../../components/clinic/ReferralGuide";
import CreateLeadGuide from "../../components/clinic/CreateLeadGuide";
import { ModernScheduler } from "../../components/clinic/ModernScheduler";

import {
  UserPlus,
  Calendar,
  Users,
  Building2,
  FileText,
  Briefcase,
  ClipboardList,
  CheckCircle,
  ArrowRight,
  BookOpen,
  ChevronDown,
  Filter,
  Settings,
} from "lucide-react";

const WorkflowGuide: NextPageWithLayout = () => {
  const [activeSection, setActiveSection] = useState("overview");
  const [expandedModules, setExpandedModules] = useState<string[]>(["business-management"]);
  const [selectedSubItem, setSelectedSubItem] = useState<string | null>(null);
  
  // State for image slideshow in different sections
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // Helper function to get auth headers
  const getAuthHeaders = (): Record<string, string> => {
    if (typeof window === "undefined") return {};
    const token = 
      localStorage.getItem("clinicToken") || 
      sessionStorage.getItem("clinicToken") ||
      localStorage.getItem("agentToken") ||
      sessionStorage.getItem("agentToken");
    if (!token) return {};
    return {
      Authorization: `Bearer ${token}`,
    };
  };
  
  // Images for appointment slideshow
  const appointmentImages = ["/appoint.png", "/book.png", "/save.png"];
  
  const nextAppointmentImage = () => {
    setCurrentImageIndex((prevIndex) => (prevIndex + 1) % appointmentImages.length);
  };
  
  const prevAppointmentImage = () => {
    setCurrentImageIndex((prevIndex) => (prevIndex - 1 + appointmentImages.length) % appointmentImages.length);
  };
  
  // Images for job-posting slideshow
  const jobImages = ["/job.png", "/createjob.png"];
  
  const nextJobImage = () => {
    setCurrentImageIndex((prevIndex) => (prevIndex + 1) % jobImages.length);
  };
  
  const prevJobImage = () => {
    setCurrentImageIndex((prevIndex) => (prevIndex - 1 + jobImages.length) % jobImages.length);
  };
  
  // Images for patient-registration slideshow
  const patientImages = ["/regpat.png", "/patient.png"];
  
  const nextPatientImage = () => {
    setCurrentImageIndex((prevIndex) => (prevIndex + 1) % patientImages.length);
  };
  
  const prevPatientImage = () => {
    setCurrentImageIndex((prevIndex) => (prevIndex - 1 + patientImages.length) % patientImages.length);
  };

  const workflowSections = [
    {
      id: "overview",
      title: "Overview",
      icon: <BookOpen className="w-5 h-5" />,
      description: "Complete clinic workflow from registration to daily operations"
    },
    {
      id: "dashboard",
      title: "Dashboard",
      icon: <Building2 className="w-5 h-5" />,
      description: "Navigate through all available modules"
    },
    {
      id: "business-management",
      title: "Business Management",
      icon: <Briefcase className="w-5 h-5" />,
     
      children: [
        { label: "Manage Health Center", id: "manage-health-center", icon: "🏥" },
        { label: "Create Offers", id: "create-offers", icon: "🎁" },
        { label: "User Package", id: "user-package", icon: "📦" },
        { label: "Service Setup", id: "service-setup", icon: "⚙️" },
        { label: "Setup & Operation", id: "setup-operation", icon: "🏢" },
      ]
    },
    {
      id: "hr-management",
      title: "HR Management",
      icon: <Users className="w-5 h-5" />,
      
      children: [
        { label: "Consent Form", id: "consent-form", icon: "📝" },
        { label: "Job Posting", id: "job-posting", icon: "📋" },
        { label: "Commission", id: "commission", icon: "💰" },
        { label: "Referral", id: "referral", icon: "🎯" },
        { label: "Create Agent", id: "create-agent", icon: "👤" },
      ]
    },
    {
      id: "marketing",
      title: "Marketing",
      icon: <UserPlus className="w-5 h-5" />,
     
      children: [
        { label: "Create Lead", id: "create-lead", icon: "➕" },
        { label: "Inbox", id: "inbox", icon: "📨" },
        { label: "Templates", id: "templates", icon: "📄" },
        { label: "Providers", id: "providers", icon: "👥" },
        { label: "Reviews", id: "reviews", icon: "⭐" },
      ]
    },
    {
      id: "content-seo",
      title: "Content & SEO",
      icon: <FileText className="w-5 h-5" />,
     
      children: [
        { label: "Write Blog", id: "write-blog", icon: "✍️" },
      ]
    },
    {
      id: "stock-management",
      title: "Stock Management",
      icon: <ClipboardList className="w-5 h-5" />,
      
      children: [
        { label: "Locations", id: "locations", icon: "📍" },
        { label: "Suppliers", id: "suppliers", icon: "🏭" },
        { label: "UOM", id: "uom", icon: "📏" },
        { label: "Purchase Requests", id: "purchase-requests", icon: "📝" },
        { label: "Purchase Orders", id: "purchase-orders", icon: "🛒" },
      ]
    },
    {
      id: "security-privacy",
      title: "Security & Privacy",
      icon: <CheckCircle className="w-5 h-5" />,
      description: "Authentication and security settings"
    },
    {
      id: "patients-appointments",
      title: "Patients & Appointments",
      icon: <Calendar className="w-5 h-5" />,
      
      children: [
        { label: "Book Appointments", id: "book-appointments", icon: "📅" },
        { label: "Scheduled Appointments", id: "scheduled-appointments", icon: "✅" },
        { label: "Patient Registration", id: "patient-registration", icon: "👤" },
        { label: "Patient Information", id: "patient-information", icon: "📋" },
      ]
    },
    {
      id: "reports-analytics",
      title: "Reports & Analytics",
      icon: <ClipboardList className="w-5 h-5" />,
     
      children: [
      
        { label: "Petty Cash", id: "petty-cash", icon: "💵" },
        { label: "Reports", id: "reports", icon: "📊" },
      ]
    }
  ];

  const toggleModule = (moduleId: string) => {
    setExpandedModules(prev => 
      prev.includes(moduleId) 
        ? prev.filter(id => id !== moduleId)
        : [...prev, moduleId]
    );
  };

  const renderSectionContent = () => {
    switch (activeSection) {
      case "overview":
        return (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-teal-500 to-blue-600 rounded-xl p-6 text-white">
              <h2 className="text-2xl font-bold mb-3">Clinic Workflow Guide</h2>
              <p className="text-teal-100">
                This comprehensive guide walks you through the complete clinic workflow step by step, 
                from initial registration to daily operations management.
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {workflowSections.slice(1).map((section) => (
                <div 
                  key={section.id}
                  className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setActiveSection(section.id)}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="text-teal-600">
                      {section.icon}
                    </div>
                    <h3 className="font-semibold text-gray-900">{section.title}</h3>
                  </div>
                  <p className="text-sm text-gray-600">{section.description}</p>
                </div>
              ))}
            </div>
            
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
              <h4 className="font-semibold text-blue-800 mb-2">Getting Started Guide:</h4>
              <ul className="list-disc list-inside space-y-2 text-blue-700">
                <li>Begin with clinic registration to create your account</li>
                <li>Complete the profile setup with your clinic details</li>
                <li>Configure your operational settings and working hours</li>
                <li>Set up your team members and their permissions</li>
                <li>Start adding patient records and managing appointments</li>
              </ul>
            </div>
            
            <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6">
              <h4 className="font-semibold text-green-800 mb-2">Key Benefits:</h4>
              <ol className="list-decimal list-inside space-y-2 text-green-700">
                <li>Streamlined patient management and scheduling</li>
                <li>Integrated billing and reporting systems</li>
                <li>Real-time dashboard analytics and insights</li>
                <li>Automated appointment reminders and notifications</li>
                <li>Secure and compliant data management</li>
              </ol>
            </div>
            
            <div className="bg-purple-50 border-l-4 border-purple-500 p-4 mb-6">
              <h4 className="font-semibold text-purple-800 mb-2">Support Resources:</h4>
              <ul className="list-disc list-inside space-y-2 text-purple-700">
                <li>24/7 customer support team</li>
                <li>Comprehensive online documentation</li>
                <li>Video tutorials and guides</li>
                <li>Live training sessions</li>
                <li>Community forums and knowledge base</li>
              </ul>
            </div>
          </div>
        );

      case "business-management":
        // If create-offers sub-item is selected, show CreateOffersGuide
        if (selectedSubItem === "create-offers") {
          return <CreateOffersGuide />;
        }
        // If user-package sub-item is selected, show UserPackagesGuide
        if (selectedSubItem === "user-package") {
          return <UserPackagesGuide />;
        }
        if (selectedSubItem === "service-setup") {
          return <ServicesGuide />;
        }
        if (selectedSubItem === "setup-operation") {
          return <SetupOperationGuide />;
        }
        
        // Otherwise show ManageHealthCenterGuide (default)
        return <ManageHealthCenterGuide selectedSubItem={selectedSubItem} />;

      case "hr-management":
        // If no sub-item selected, show default message
        if (!selectedSubItem) {
          return (
            <div className="max-w-4xl mx-auto px-6 py-12">
              <div className="text-center mb-8">
                <Users className="w-16 h-16 text-teal-600 mx-auto mb-4" />
                <h2 className="text-3xl font-bold text-gray-900 mb-2">HR Management</h2>
                <p className="text-gray-600">Select a Section</p>
              </div>
              <div className="bg-blue-50 border-l-4 border-blue-500 p-8 rounded-r-lg shadow-sm">
                <div className="flex items-start gap-4">
                  <BookOpen className="w-8 h-8 text-blue-600 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold text-blue-900 mb-2">Choose a workflow section from the navigation to get started</h3>
                    <ul className="list-disc list-inside space-y-2 text-sm text-blue-700 mt-4">
                      <li>Click on any item in the left sidebar navigation</li>
                      <li>View detailed guides and documentation</li>
                      <li>Follow step-by-step instructions for each topic</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          );
        }
        
        if (selectedSubItem === "consent-form") {
          return <ConsentFormGuide />;
        }
        if (selectedSubItem === "job-posting") {
          return <JobPostingGuide />;
        }
        if (selectedSubItem === "commission") {
          return <CommissionGuide />;
        }
        if (selectedSubItem === "referral") {
          return <ReferralGuide />;
        }
        
        if (selectedSubItem === "create-agent") {
          return <ClinicManagementGuide />;
        }
        // For other HR management items, you can add more cases here
        // Default: show a message or generic HR guide
        return (
          <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="flex items-center gap-3 mb-8">
              <Users className="w-10 h-10 text-teal-600" />
              <h2 className="text-3xl font-bold text-gray-900">HR Management</h2>
            </div>
            <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded-r-lg">
              <p className="text-base text-blue-800">
                Select a specific HR management topic from the menu to view detailed guidance.
              </p>
            </div>
          </div>
        );

      case "marketing":
        // If create-lead sub-item is selected, show CreateLeadGuide
        if (selectedSubItem === "create-lead") {
          return <CreateLeadGuide />;
        }
        // Default: show marketing overview message
        return (
          <div className="max-w-4xl mx-auto px-6 py-12">
            <div className="text-center mb-8">
              <UserPlus className="w-16 h-16 text-purple-600 mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Marketing</h2>
              <p className="text-gray-600">Select a Section</p>
            </div>
            <div className="bg-purple-50 border-l-4 border-purple-500 p-8 rounded-r-lg shadow-sm">
              <div className="flex items-start gap-4">
                <FileText className="w-8 h-8 text-purple-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-purple-900 mb-2">Choose a marketing section from the navigation to get started</h3>
                  <ul className="list-disc list-inside space-y-2 text-sm text-purple-700 mt-4">
                    <li>Create Lead - Add new prospects to your CRM</li>
                    <li>Inbox - Manage all communications</li>
                    <li>Templates - Email and SMS templates</li>
                    <li>Providers - Marketing service providers</li>
                    <li>Reviews - Patient reviews and ratings</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        );

      case "login":
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <CheckCircle className="w-8 h-8 text-teal-600" />
              <h2 className="text-2xl font-bold text-gray-900">Login Process</h2>
            </div>
            
            <div className="prose max-w-none">
              <h3 className="text-xl font-semibold text-gray-800 mb-3">Access Your Account</h3>
              <p className="text-gray-600 mb-4">
                Once registered, you can access your clinic dashboard using your credentials.
              </p>
              
              <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6">
                <h4 className="font-semibold text-green-800 mb-2">Login Steps:</h4>
                <ol className="list-decimal list-inside space-y-2 text-green-700">
                  <li>Navigate to the clinic login page</li>
                  <li>Enter your registered email address</li>
                  <li>Enter your password</li>
                  <li>Click login to access your dashboard</li>
                </ol>
              </div>
              
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className="bg-white border border-gray-200 rounded-lg p-4 h-full flex flex-col">
                  <h4 className="font-semibold text-gray-800 mb-3">Login Features:</h4>
                  <ul className="space-y-2 text-gray-700 flex-grow">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Secure authentication system
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Session management
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Password recovery options
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Multi-device session support
                    </li>
                  </ul>
                </div>
                
                <div className="bg-white border border-gray-200 rounded-lg p-4 h-full flex flex-col">
                  <h4 className="font-semibold text-gray-800 mb-3">Security Measures:</h4>
                  <ul className="space-y-2 text-gray-700 flex-grow">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-blue-500" />
                      Encrypted password storage
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-blue-500" />
                      Session timeout protection
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-blue-500" />
                      Two-factor authentication ready
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-blue-500" />
                      IP address monitoring
                    </li>
                  </ul>
                </div>
              </div>
              
              <div className="bg-indigo-50 border-l-4 border-indigo-500 p-4 mb-6">
                <h4 className="font-semibold text-indigo-800 mb-2">Advanced Login Options:</h4>
                <ul className="list-disc list-inside space-y-2 text-indigo-700">
                  <li>Single Sign-On (SSO) integration capabilities</li>
                  <li>Biometric authentication support</li>
                  <li>Social login options (Google, Microsoft)</li>
                  <li>Custom domain login configuration</li>
                  <li>API key authentication for integrations</li>
                </ul>
              </div>
              
              <div className="bg-pink-50 border-l-4 border-pink-500 p-4 mb-6">
                <h4 className="font-semibold text-pink-800 mb-2">Login Best Practices:</h4>
                <ol className="list-decimal list-inside space-y-2 text-pink-700">
                  <li>Use strong, unique passwords for each account</li>
                  <li>Enable two-factor authentication when available</li>
                  <li>Regularly review active sessions and devices</li>
                  <li>Log out from shared or public computers</li>
                  <li>Report suspicious login attempts immediately</li>
                </ol>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-2">Login Interface Screenshot</h4>
                <div className="border-2 border-gray-300 rounded-lg min-h-[400px] overflow-hidden bg-white">
                  <img 
                    src="/login.png" 
                    alt="Login Page" 
                    className="w-full h-full object-contain p-4"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      target.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                  <div className="hidden w-full h-full flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <CheckCircle className="w-8 h-8 mx-auto mb-2" />
                      <p>Login page screenshot</p>
                      <p className="text-sm">(Image will appear here)</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case "dashboard":
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <Building2 className="w-8 h-8 text-teal-600" />
              <h2 className="text-2xl font-bold text-gray-900">Dashboard Overview</h2>
            </div>
            
            <div className="prose max-w-none">
              <h3 className="text-xl font-semibold text-gray-800 mb-3">Your Command Center</h3>
              <p className="text-gray-600 mb-4">
                The dashboard is your central hub where all clinic modules are visible and accessible.
              </p>
              
              <div className="bg-purple-50 border-l-4 border-purple-500 p-4 mb-6">
                <h4 className="font-semibold text-purple-800 mb-2">Dashboard Features:</h4>
                <ul className="list-disc list-inside space-y-2 text-purple-700">
                  <li>Overview of all clinic activities</li>
                  <li>Quick access to all modules</li>
                  <li>Performance metrics and statistics</li>
                  <li>Recent activity feed</li>
                  <li>Quick action buttons</li>
                </ul>
              </div>
              
              <div className="grid md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white border border-gray-200 rounded-lg p-4 h-full flex flex-col">
                  <h5 className="font-semibold text-gray-800 mb-2">Navigation Menu</h5>
                  <p className="text-sm text-gray-600 flex-grow">Access all clinic modules</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-4 h-full flex flex-col">
                  <h5 className="font-semibold text-gray-800 mb-2">Statistics Panel</h5>
                  <p className="text-sm text-gray-600 flex-grow">View key metrics</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-4 h-full flex flex-col">
                  <h5 className="font-semibold text-gray-800 mb-2">Recent Activity</h5>
                  <p className="text-sm text-gray-600 flex-grow">Latest updates</p>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-2">Dashboard Interface Screenshot</h4>
                <div className="border-2 border-gray-300 rounded-lg min-h-[400px] overflow-hidden bg-white">
                  <img 
                    src="/dashboard.png" 
                    alt="Clinic Dashboard" 
                    className="w-full h-full object-contain p-4"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      target.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                  <div className="hidden w-full h-full flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <Building2 className="w-16 h-16 mx-auto mb-2" />
                      <p>Dashboard overview screenshot</p>
                      <p className="text-sm">(Image will appear here)</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case "health-center":
        // Array of images for the slideshow
        const images = ["/image.png", "/manage.png"];
        
        const nextImage = () => {
          setCurrentImageIndex((prevIndex) => (prevIndex + 1) % images.length);
        };
        
        const prevImage = () => {
          setCurrentImageIndex((prevIndex) => (prevIndex - 1 + images.length) % images.length);
        };
        
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <Building2 className="w-8 h-8 text-teal-600" />
              <h2 className="text-2xl font-bold text-gray-900">Manage Health Center</h2>
            </div>
            
            <div className="prose max-w-none">
              <h3 className="text-xl font-semibold text-gray-800 mb-3">Clinic Profile Management</h3>
              <p className="text-gray-600 mb-4">
                View and edit your clinic's profile details to keep information up to date.
              </p>
              
              <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-6">
                <h4 className="font-semibold text-amber-800 mb-2">Profile Management:</h4>
                <ul className="list-disc list-inside space-y-2 text-amber-700">
                  <li>Update clinic name and description</li>
                  <li>Modify contact information</li>
                  <li>Adjust pricing and timings</li>
                  <li>Update services offered</li>
                  <li>Manage clinic images and branding</li>
                </ul>
              </div>
              
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className="bg-white border border-gray-200 rounded-lg p-4 h-full flex flex-col">
                  <h4 className="font-semibold text-gray-800 mb-3">Profile Management:</h4>
                  <ul className="space-y-2 text-gray-700 flex-grow">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Update clinic name and description
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Modify contact information
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Adjust pricing and timings
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Update services offered
                    </li>
                  </ul>
                </div>
                
                <div className="bg-white border border-gray-200 rounded-lg p-4 h-full flex flex-col">
                  <h4 className="font-semibold text-gray-800 mb-3">Profile Features:</h4>
                  <ul className="space-y-2 text-gray-700 flex-grow">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-blue-500" />
                      Manage clinic images and branding
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-blue-500" />
                      Update working hours and availability
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-blue-500" />
                      Customize clinic specialties
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-blue-500" />
                      Manage clinic certifications
                    </li>
                  </ul>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-2">Manage Health Center Screenshot</h4>
                <div className="border-2 border-gray-300 rounded-lg min-h-[400px] overflow-hidden bg-white relative">
                  <div className="relative h-[400px] overflow-hidden">
                    <img 
                      src={images[currentImageIndex]} 
                      alt="Manage Health Center" 
                      className="w-full h-full object-contain p-4"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        target.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                    <div className="hidden w-full h-full flex items-center justify-center text-gray-500">
                      <div className="text-center">
                        <Building2 className="w-12 h-12 mx-auto mb-2" />
                        <p>Profile management interface</p>
                        <p className="text-sm">(Image will appear here)</p>
                      </div>
                    </div>
                  </div>
                  <button 
                    className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-md transition-all"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      prevImage();
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <button 
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-md transition-all"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      nextImage();
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case "create-agent":
        // Array of images for the slideshow
        const agentImages = ["/team.png", "/team1.png"];
        
        const nextAgentImage = () => {
          setCurrentImageIndex((prevIndex) => (prevIndex + 1) % agentImages.length);
        };
        
        const prevAgentImage = () => {
          setCurrentImageIndex((prevIndex) => (prevIndex - 1 + agentImages.length) % agentImages.length);
        };
        
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <Users className="w-8 h-8 text-teal-600" />
              <h2 className="text-2xl font-bold text-gray-900">Create Agent</h2>
            </div>
            
            <div className="prose max-w-none">
              <h3 className="text-xl font-semibold text-gray-800 mb-3">Add Doctors and Agents</h3>
              <p className="text-gray-600 mb-4">
                Add medical professionals and staff members to your clinic with clear role definitions.
              </p>
              
              <div className="grid md:grid-cols-2 gap-4 mb-6 h-full">
                <div className="bg-white border border-gray-200 rounded-lg p-4 h-full flex flex-col">
                  <h4 className="font-semibold text-gray-800 mb-3">Agent Types:</h4>
                  <div className="space-y-3 flex-grow">
                    <div className="bg-indigo-50 rounded-lg p-3">
                      <h5 className="font-semibold text-indigo-700 mb-2">Doctors</h5>
                      <ul className="text-sm text-indigo-600 space-y-1">
                        <li>• Medical qualifications</li>
                        <li>• Specialization details</li>
                        <li>• Availability schedule</li>
                        <li>• Consultation fees</li>
                      </ul>
                    </div>
                    <div className="bg-indigo-50 rounded-lg p-3">
                      <h5 className="font-semibold text-indigo-700 mb-2">Agents/Staff</h5>
                      <ul className="text-sm text-indigo-600 space-y-1">
                        <li>• Staff roles and permissions</li>
                        <li>• Contact information</li>
                        <li>• Working hours</li>
                        <li>• Department assignment</li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4 h-full">
                  <h4 className="font-semibold text-gray-800 mb-2">Screenshot: Agent Creation Form</h4>
                  <div className="border-2 border-gray-300 rounded-lg h-full min-h-[400px] overflow-hidden bg-white relative">
                    <div className="relative h-[400px] overflow-hidden">
                      <img 
                        src={agentImages[currentImageIndex]} 
                        alt="Agent Creation Form" 
                        className="w-full h-full object-contain p-4"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          target.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                      <div className="hidden w-full h-full flex items-center justify-center text-gray-500">
                        <div className="text-center">
                          <Users className="w-16 h-16 mx-auto mb-2" />
                          <p>Agent creation interface screenshot</p>
                          <p className="text-sm">(Image will appear here)</p>
                        </div>
                      </div>
                    </div>
                    <button 
                      className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-md transition-all"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        prevAgentImage();
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <button 
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-md transition-all"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        nextAgentImage();
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h4 className="font-semibold text-gray-800 mb-2">Required Details for Agents:</h4>
                <div className="grid md:grid-cols-2 gap-4">
                  <ul className="space-y-2 text-gray-700">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Full name and contact details
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Professional qualifications
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Specialization and expertise
                    </li>
                  </ul>
                  <ul className="space-y-2 text-gray-700">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Working schedule and availability
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Consultation fees (for doctors)
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Role-specific permissions
                    </li>
                  </ul>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-2">Screenshot: Agent Creation Form</h4>
                <div className="border-2 border-gray-300 rounded-lg min-h-[400px] overflow-hidden bg-white relative">
                  <div className="relative h-[400px] overflow-hidden">
                    <img 
                      src={agentImages[currentImageIndex]} 
                      alt="Agent Creation Form" 
                      className="w-full h-full object-contain p-4"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        target.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                    <div className="hidden w-full h-full flex items-center justify-center text-gray-500">
                      <div className="text-center">
                        <Users className="w-16 h-16 mx-auto mb-2" />
                        <p>Agent creation interface screenshot</p>
                        <p className="text-sm">(Image will appear here)</p>
                      </div>
                    </div>
                  </div>
                  <button 
                    className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-md transition-all"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      prevAgentImage();
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <button 
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-md transition-all"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      nextAgentImage();
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case "service-setup":
        return <ServicesGuide />;

      case "setup-operation":
        return <SetupOperationGuide />;



      case "patients-appointments":
        // Handle specific sub-items
        if (selectedSubItem === "book-appointments") {
          return <BookAppointmentWorkflowGuide />;
        }
        
        // If no sub-item selected, show default message
        if (!selectedSubItem) {
          return (
            <div className="max-w-4xl mx-auto px-6 py-12">
              <div className="text-center mb-8">
                <Calendar className="w-16 h-16 text-teal-600 mx-auto mb-4" />
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Patients & Appointments</h2>
                <p className="text-gray-600">Select a Section</p>
              </div>
              <div className="bg-blue-50 border-l-4 border-blue-500 p-8 rounded-r-lg shadow-sm">
                <div className="flex items-start gap-4">
                  <BookOpen className="w-8 h-8 text-blue-600 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold text-blue-900 mb-2">Choose a workflow section from the navigation to get started</h3>
                    <ul className="list-disc list-inside space-y-2 text-sm text-blue-700 mt-4">
                      <li>Click on any item in the left sidebar navigation</li>
                      <li>View detailed guides and documentation</li>
                      <li>Follow step-by-step instructions for each topic</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          );
        }
        
        // For other sub-items, you can add more cases here
        return (
          <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="flex items-center gap-3 mb-8">
              <Calendar className="w-10 h-10 text-teal-600" />
              <h2 className="text-3xl font-bold text-gray-900">Patients & Appointments</h2>
            </div>
            <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded-r-lg">
              <p className="text-base text-blue-800">
                Select a specific topic from the menu to view detailed guidance.
              </p>
            </div>
          </div>
        );

      case "scheduled-appointments":
        return <ConsentFormGuide />;

      case "job-posting":
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <Briefcase className="w-8 h-8 text-teal-600" />
              <h2 className="text-2xl font-bold text-gray-900">Job Posting</h2>
            </div>
            
            <div className="prose max-w-none">
              <h3 className="text-xl font-semibold text-gray-800 mb-3">Recruitment Management</h3>
              <p className="text-gray-600 mb-4">
                Post job requirements and manage the complete recruitment process for your clinic.
              </p>
              
              <div className="bg-purple-50 border-l-4 border-purple-500 p-4 mb-6">
                <h4 className="font-semibold text-purple-800 mb-2">Job Posting Features:</h4>
                <ul className="list-disc list-inside space-y-2 text-purple-700">
                  <li>Create detailed job descriptions</li>
                  <li>Specify required qualifications and experience</li>
                  <li>Set salary ranges and benefits</li>
                  <li>Define application deadlines</li>
                  <li>Manage applicant submissions</li>
                  <li>Track recruitment progress</li>
                </ul>
              </div>
              
              <div className="grid md:grid-cols-2 gap-6 mb-6 h-full">
                <div className="bg-gray-50 rounded-lg p-4 h-full flex flex-col">
                  <h4 className="font-semibold text-gray-800 mb-2">Job Posting Information:</h4>
                  <ul className="space-y-2 text-gray-700 flex-grow">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Position title and department
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Required qualifications
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Experience requirements
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Compensation and benefits
                    </li>
                  </ul>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4 h-full">
                  <h4 className="font-semibold text-gray-800 mb-2">Applicant Management:</h4>
                  <ul className="space-y-2 text-gray-700">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-blue-500" />
                      Review applications
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-blue-500" />
                      Schedule interviews
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-blue-500" />
                      Track candidate status
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-blue-500" />
                      Send offer letters
                    </li>
                  </ul>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4 h-full">
                <h4 className="font-semibold text-gray-800 mb-2">Screenshot: Job Posting Interface</h4>
                <div className="border-2 border-gray-300 rounded-lg h-full min-h-[400px] overflow-hidden bg-white relative">
                  <div className="relative h-[400px] overflow-hidden">
                    <img 
                      src={jobImages[currentImageIndex]} 
                      alt="Job Posting Interface" 
                      className="w-full h-full object-contain p-4"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        target.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                    <div className="hidden w-full h-full flex items-center justify-center text-gray-500">
                      <div className="text-center">
                        <Briefcase className="w-12 h-12 mx-auto mb-2" />
                        <p>Job posting creation form</p>
                        <p className="text-sm">Complete recruitment management system</p>
                      </div>
                    </div>
                  </div>
                  <button 
                    className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-md transition-all"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      prevJobImage();
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <button 
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-md transition-all"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      nextJobImage();
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case "patient-registration":
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <Users className="w-8 h-8 text-teal-600" />
              <h2 className="text-2xl font-bold text-gray-900">Patient Registration</h2>
            </div>
            
            <div className="prose max-w-none">
              <h3 className="text-xl font-semibold text-gray-800 mb-3">Patient Management System</h3>
              <p className="text-gray-600 mb-4">
                Register new patients and manage their complete medical and contact information.
              </p>
              
              <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6">
                <h4 className="font-semibold text-green-800 mb-2">Patient Registration Process:</h4>
                <ol className="list-decimal list-inside space-y-2 text-green-700">
                  <li>Enter basic patient information (name, DOB, contact)</li>
                  <li>Collect medical history and current conditions</li>
                  <li>Record emergency contact information</li>
                  <li>Set up patient portal access</li>
                  <li>Link to insurance information</li>
                  <li>Create unique patient ID</li>
                </ol>
              </div>
              
              <div className="grid md:grid-cols-2 gap-6 mb-6 h-full">
                <div className="bg-white border border-gray-200 rounded-lg p-4 h-full flex flex-col">
                  <h4 className="font-semibold text-gray-800 mb-3">Required Patient Information:</h4>
                  <ul className="space-y-2 text-gray-700 flex-grow">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Personal details and demographics
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Contact information
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Medical history
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Insurance details
                    </li>
                  </ul>
                </div>
                
                <div className="bg-white border border-gray-200 rounded-lg p-4 h-full">
                  <h4 className="font-semibold text-gray-800 mb-3">Management Features:</h4>
                  <ul className="space-y-2 text-gray-700">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-blue-500" />
                      Update patient records
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-blue-500" />
                      Track appointment history
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-blue-500" />
                      Manage prescriptions
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-blue-500" />
                      Generate patient reports
                    </li>
                  </ul>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4 h-full">
                <h4 className="font-semibold text-gray-800 mb-2">Screenshot: Patient Registration Form</h4>
                <div className="border-2 border-gray-300 rounded-lg h-full min-h-[400px] overflow-hidden bg-white relative">
                  <div className="relative h-[400px] overflow-hidden">
                    <img 
                      src={patientImages[currentImageIndex]} 
                      alt="Patient Registration Form" 
                      className="w-full h-full object-contain p-4"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        target.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                    <div className="hidden w-full h-full flex items-center justify-center text-gray-500">
                      <div className="text-center">
                        <Users className="w-16 h-16 mx-auto mb-2" />
                        <p>Comprehensive patient registration interface</p>
                        <p className="text-sm">Medical history and contact management</p>
                      </div>
                    </div>
                  </div>
                  <button 
                    className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-md transition-all"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      prevPatientImage();
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <button 
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-md transition-all"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      nextPatientImage();
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case "write-blog":
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <FileText className="w-8 h-8 text-teal-600" />
              <h2 className="text-2xl font-bold text-gray-900">Write Blog</h2>
            </div>
            
            <div className="prose max-w-none">
              <h3 className="text-xl font-semibold text-gray-800 mb-3">Content Management</h3>
              <p className="text-gray-600 mb-4">
                Create and publish blogs using the clinic sidebar to share health information and clinic updates.
              </p>
              
              <div className="bg-indigo-50 border-l-4 border-indigo-500 p-4 mb-6">
                <h4 className="font-semibold text-indigo-800 mb-2">Blog Creation Features:</h4>
                <ul className="list-disc list-inside space-y-2 text-indigo-700">
                  <li>Rich text editor with formatting options</li>
                  <li>Image upload and management</li>
                  <li>Category and tag assignment</li>
                  <li>Schedule publishing for future dates</li>
                  <li>SEO optimization tools</li>
                  <li>Draft saving and version control</li>
                </ul>
              </div>
              
              <div className="grid md:grid-cols-2 gap-6 mb-6 h-full">
                <div className="bg-gray-50 rounded-lg p-4 h-full flex flex-col">
                  <h4 className="font-semibold text-gray-800 mb-2">Blog Content Elements:</h4>
                  <ul className="space-y-2 text-gray-700 flex-grow">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Title and meta description
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Featured images
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Content formatting and styling
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Categories and tags
                    </li>
                  </ul>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4 h-full">
                  <h4 className="font-semibold text-gray-800 mb-2">Publishing Options:</h4>
                  <ul className="space-y-2 text-gray-700">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-blue-500" />
                      Immediate publishing
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-blue-500" />
                      Schedule for later
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-blue-500" />
                      Save as draft
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-blue-500" />
                      Preview before publishing
                    </li>
                  </ul>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4 h-full">
                <h4 className="font-semibold text-gray-800 mb-2">Screenshot: Blog Editor Interface</h4>
                <div className="border-2 border-dashed border-gray-300 rounded-lg h-full min-h-[400px] flex items-center justify-center bg-white">
                  <div className="text-center text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-2" />
                    <p>Advanced blog creation editor</p>
                    <p className="text-sm">With formatting tools and media management</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="text-center py-12">
            <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Select a Section</h3>
            <p className="text-gray-600">Choose a workflow section from the navigation to get started</p>
          </div>
        );
    }
  };

  return (
    <>
      <Head>
        <title>Clinic Workflow Guide | ZEVA</title>
        <meta name="description" content="Complete step-by-step guide for clinic workflow management in ZEVA" />
      </Head>

      <div className="min-h-screen bg-gray-50">
        <div className="max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-12 py-8 h-full">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-4xl font-bold text-gray-900">Clinic Workflow Guide</h1>
                <p className="text-lg text-gray-600 mt-2">Complete step-by-step documentation for clinic operations</p>
              </div>
              <Link 
                href="/"
                className="inline-flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
              >
                <ArrowRight className="w-5 h-5" />
                Back to Zeva
              </Link>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-10 h-full">
            {/* Sidebar Navigation */}
            <div className="lg:w-96 flex-shrink-0">
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 h-full flex flex-col">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900">Workflow Sections</h2>
                </div>
                <nav className="p-5 flex-1 overflow-y-auto">
                  <ul className="space-y-2">
                    {workflowSections.map((section) => {
                      const isExpandable = section.children && section.children.length > 0;
                      const isExpanded = expandedModules.includes(section.id);
                      const isActive = activeSection === section.id;
                      
                      return (
                        <li key={section.id}>
                          <div className="space-y-2">
                            <button
                              onClick={() => {
                                setActiveSection(section.id);
                                if (isExpandable) {
                                  toggleModule(section.id);
                                }
                              }}
                              className={`w-full text-left px-5 py-4 rounded-lg flex items-center gap-3 transition-colors ${
                                isActive
                                  ? "bg-teal-50 text-teal-700 border-2 border-teal-300"
                                  : "text-gray-700 hover:bg-gray-50"
                              }`}
                            >
                              <span className={isActive ? "text-teal-600" : "text-gray-500"}>
                                {section.icon}
                              </span>
                              <div className="flex-1">
                                <div className="font-semibold text-base">{section.title}</div>
                                <div className="text-sm text-gray-500 line-clamp-2">{section.description}</div>
                              </div>
                              {isExpandable && (
                                <ChevronDown
                                  className={`w-5 h-5 transition-transform duration-200 ${
                                    isExpanded ? "rotate-180 text-teal-600" : "text-gray-400"
                                  }`}
                                />
                              )}
                            </button>
                            
                            {/* Sub-items (dropdown) */}
                            {isExpandable && isExpanded && section.children && (
                              <div className="ml-9 space-y-1 animate-in slide-in-from-top-2 duration-200">
                                {section.children.map((child) => (
                                  <button
                                    key={child.id}
                                    onClick={() => {
                                      setActiveSection(section.id);
                                      setSelectedSubItem(child.id);
                                    }}
                                    className={`w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm transition-all ${
                                      selectedSubItem === child.id
                                        ? "bg-teal-100 text-teal-800 border border-teal-200"
                                        : "text-gray-600 hover:bg-gray-100"
                                    }`}
                                  >
                                    <span className="text-lg">{child.icon}</span>
                                    <span className="font-medium">{child.label}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </nav>
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 md:p-10 h-full">
                {renderSectionContent()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

WorkflowGuide.getLayout = function PageLayout(page: React.ReactElement) {
  return <Layout>{page}</Layout>;
};

const ProtectedWorkflowGuide = withClinicAuth(WorkflowGuide) as NextPageWithLayout;
ProtectedWorkflowGuide.getLayout = WorkflowGuide.getLayout;

export default ProtectedWorkflowGuide;