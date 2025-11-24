"use client";
import { useEffect, useState, useRef, ReactNode } from "react";
import axios from "axios";
import withClinicAuth from "../../components/withClinicAuth";
import type { NextPageWithLayout } from "../_app";
import ClinicLayout from "../../components/ClinicLayout";
import {
  Edit3,
  MapPin,
  Heart,
  Clock,
  Plus,
  X,
  Calendar,
  Leaf,
  Building2,
  Camera,
  Star,
  Mail,
  TrendingUp,
  BarChart3,
  Users,
  Activity,
} from "lucide-react";
import Image from "next/image";
import { Toaster, toast } from "react-hot-toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend, LineChart, Line, PieChart, Pie, Cell } from "recharts";

interface Clinic {
  _id: string;
  name: string;
  address: string;
  treatments: Array<{
    mainTreatment: string;
    mainTreatmentSlug: string;
    subTreatments: Array<{
      name: string;
      slug: string;
      price?: number;
    }>;
  }>;
  servicesName: string[];
  pricing: string;
  timings: string;
  photos: string[];
  location: { coordinates: [number, number] };
  createdAt: string;
}

interface Treatment {
  _id: string;
  name: string;
  slug: string;
  subcategories: Array<{
    name: string;
    slug: string;
    price?: number;
  }>;
}

interface ClinicStats {
  totalReviews: number;
  totalEnquiries: number;
  averageRating: number;
  totalTreatments: number;
  totalServices: number;
  totalSubTreatments: number;
}

const LoadingSpinner = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
    <div className="bg-white rounded-lg p-8 shadow-sm border border-gray-300 max-w-md w-full">
      <div className="animate-spin rounded-full h-12 w-12 border-2 border-gray-300 border-t-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-700 text-center font-medium">Loading Clinic Profile...</p>
    </div>
  </div>
);

// Lightweight inline placeholder to avoid 404 loops
const PLACEHOLDER_DATA_URI =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="320" viewBox="0 0 800 320">
      <rect width="100%" height="100%" fill="#f3f4f6"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#9ca3af" font-size="20" font-family="Arial, sans-serif">No image available</text>
    </svg>`
  );

const Header = ({
  onEditClick,
  hasClinic,
  isEditing,
  canUpdate,
  clinicName,
}: {
  onEditClick: () => void;
  hasClinic: boolean;
  isEditing: boolean;
  canUpdate: boolean;
  clinicName?: string;
}) => (
  <div className="bg-white rounded-lg p-6 sm:p-8 border border-gray-300 shadow-sm">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-3">
          <Building2 className="w-6 h-6 text-gray-700" />
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            {clinicName || 'Clinic Profile'}
          </h1>
        </div>
        <p className="text-sm text-gray-600">
          Manage your clinic information and settings
        </p>
      </div>
      {hasClinic && !isEditing && canUpdate && (
        <button
          onClick={onEditClick}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm hover:shadow-md"
        >
          <Edit3 className="w-4 h-4" />
          <span>Edit Profile</span>
        </button>
      )}
    </div>
  </div>
);

interface FormInputProps {
  label: ReactNode;
  icon: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  rows?: number;
}
const FormInput = ({
  label,
  icon,
  value,
  onChange,
  type = "text",
  placeholder,
  rows,
}: FormInputProps) => (
  <div className="space-y-2">
    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
      {icon}
      {label}
    </label>
    {type === "textarea" ? (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none placeholder-gray-400 text-gray-700 bg-white transition-all"
        rows={rows || 3}
        placeholder={placeholder}
      />
    ) : (
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 text-gray-700 bg-white transition-all"
        placeholder={placeholder}
      />
    )}
  </div>
);

interface TagManagerProps {
  label: string;
  icon: React.ReactNode;
  items: string[];
  newItem: string;
  setNewItem: (value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  className?: string;
}
const TagManager = ({
  label,
  icon,
  items,
  newItem,
  setNewItem,
  onAdd,
  onRemove,
  className,
}: TagManagerProps) => (
  <div className={`space-y-3 ${className || ""}`}>
    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
      {icon}
      {label}
    </label>
    <div className="flex gap-2">
      <input
        type="text"
        value={newItem}
        onChange={(e) => setNewItem(e.target.value)}
        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 text-gray-700 bg-white transition-all"
        placeholder={`Add ${label.toLowerCase()}`}
        onKeyPress={(e) => e.key === "Enter" && onAdd()}
      />
      <button
        onClick={onAdd}
        className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm hover:shadow-md"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
    <div className="flex flex-wrap gap-2">
      {items?.map((item: string, index: number) => (
        <span
          key={index}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-gray-700 rounded-full text-sm border border-blue-200"
        >
          {item}
          <button
            onClick={() => onRemove(index)}
            className="text-gray-500 hover:text-red-600 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </span>
      ))}
    </div>
  </div>
);

interface TreatmentManagerProps {
  label: string;
  icon: React.ReactNode;
  items: Array<{
    mainTreatment: string;
    mainTreatmentSlug: string;
    subTreatments: Array<{
      name: string;
      slug: string;
      price?: number;
    }>;
  }>;
  newItem: string;
  setNewItem: (value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  availableTreatments: Treatment[];
  showCustomInput: boolean;
  setShowCustomInput: (value: boolean) => void;
  onAddFromDropdown: (treatmentName: string) => void;
  onUpdateTreatment: (index: number, treatment: {
    mainTreatment: string;
    mainTreatmentSlug: string;
    subTreatments: Array<{
      name: string;
      slug: string;
      price?: number;
    }>;
  }) => void;
  // Add this missing prop
  setAvailableTreatments: (treatments: Treatment[]) => void;
}
const TreatmentManager = ({
  label,
  icon,
  items,
  newItem,
  setNewItem,
  onAdd,
  onRemove,
  availableTreatments,
  showCustomInput,
  setShowCustomInput,
  onAddFromDropdown,
  onUpdateTreatment,
  setAvailableTreatments, // Now properly typed and available
}: TreatmentManagerProps) => {
  const [customSubTreatment, setCustomSubTreatment] = useState<string>("");
  const [customSubTreatmentPrice, setCustomSubTreatmentPrice] =
    useState<string>("");
  const [showSubTreatmentInput, setShowSubTreatmentInput] = useState<
    number | null
  >(null);
  const [showCustomSubTreatmentInput, setShowCustomSubTreatmentInput] =
    useState<number | null>(null);

      const handleAddSubTreatment = async (mainTreatmentIndex: number) => {
    if (customSubTreatment.trim()) {
      const currentTreatment = items[mainTreatmentIndex];
      const newSubTreatment = {
        name: customSubTreatment.trim(),
        slug: customSubTreatment.trim().toLowerCase().replace(/\s+/g, "-"),
        price: Number(customSubTreatmentPrice) || 0,
      };

      // Try to save to database
      try {
        const token = localStorage.getItem("clinicToken");
        await axios.post(
          "/api/doctor/add-custom-treatment",
          {
            mainTreatment: currentTreatment.mainTreatment,
            subTreatments: [newSubTreatment],
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        // Refresh available treatments
        const treatmentsResponse = await axios.get("/api/doctor/getTreatment", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setAvailableTreatments(treatmentsResponse.data.treatments || []);
        toast.success("Sub-treatment added to database");
      } catch (error) {
        console.error("Error adding custom sub-treatment to database:", error);
        toast.error("Failed to save sub-treatment to database, but added locally");
        // Continue with local addition even if database call fails
      }

      const updatedTreatment = {
        ...currentTreatment,
        subTreatments: [
          ...(currentTreatment.subTreatments || []),
          newSubTreatment,
        ],
      };

      onUpdateTreatment(mainTreatmentIndex, updatedTreatment);
      toast.success(`Sub-treatment "${customSubTreatment.trim()}" added`);
      setCustomSubTreatment("");
      setCustomSubTreatmentPrice("");
      setShowSubTreatmentInput(null);
      setShowCustomSubTreatmentInput(null);
    } else {
      toast.error("Please enter a sub-treatment name");
    }
  };

  const handleRemoveSubTreatment = (
    mainTreatmentIndex: number,
    subTreatmentIndex: number
  ) => {
    const currentTreatment = items[mainTreatmentIndex];
    const subTreatmentName = currentTreatment.subTreatments[subTreatmentIndex]?.name;
    const updatedSubTreatments = currentTreatment.subTreatments.filter(
      (_, index) => index !== subTreatmentIndex
    );

    const updatedTreatment = {
      ...currentTreatment,
      subTreatments: updatedSubTreatments,
    };

    onUpdateTreatment(mainTreatmentIndex, updatedTreatment);
    toast.success(`Sub-treatment "${subTreatmentName}" removed`)
  };

  const handleAddFromAvailableSubTreatments = (
    mainTreatmentIndex: number,
    subTreatmentName: string
  ) => {
    const currentTreatment = items[mainTreatmentIndex];
    
    // Check if sub-treatment already exists
    if (currentTreatment.subTreatments?.some(st => st.name === subTreatmentName)) {
      toast.error("Sub-treatment already exists");
      return;
    }
    
    const newSubTreatment = {
      name: subTreatmentName,
      slug: subTreatmentName.toLowerCase().replace(/\s+/g, "-"),
    };

    const updatedTreatment = {
      ...currentTreatment,
      subTreatments: [
        ...(currentTreatment.subTreatments || []),
        newSubTreatment,
      ],
    };

    onUpdateTreatment(mainTreatmentIndex, updatedTreatment);
    toast.success(`Sub-treatment "${subTreatmentName}" added`);
  };

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-3 text-sm font-semibold text-gray-800 sm:text-base">
        {icon}
        {label}
      </label>

      {/* Treatment Selection */}
      <div className="space-y-3">
        {!showCustomInput ? (
          <div className="relative">
            <select
              onChange={(e) => {
                if (e.target.value === "custom") {
                  setShowCustomInput(true);
                } else if (e.target.value) {
                  const selectedTreatment = availableTreatments.find(
                    (t: Treatment) => t._id === e.target.value
                  );
                  if (selectedTreatment) {
                    onAddFromDropdown(selectedTreatment.name);
                  }
                }
              }}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2D9AA5] focus:border-[#2D9AA5] text-gray-800 transition-all duration-200 text-sm sm:text-base"
              value=""
            >
              <option value="">Select a treatment</option>
              {availableTreatments?.map((treatment: Treatment) => (
                <option key={treatment._id} value={treatment._id}>
                  {treatment.name}
                </option>
              ))}
              <option value="custom">+ Add Custom Treatment</option>
            </select>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2D9AA5] focus:border-[#2D9AA5] placeholder-gray-400 text-gray-800 transition-all duration-200 text-sm sm:text-base"
              placeholder="Enter custom treatment name"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onAdd();
                }
              }}
            />
            <div className="flex gap-2 sm:gap-3">
              <button
                onClick={onAdd}
                className="flex-1 sm:flex-initial px-4 py-3 bg-[#2D9AA5] text-white rounded-xl hover:bg-[#238891] active:bg-[#1f7177] transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span className="sm:hidden">Add</span>
              </button>
              <button
                onClick={() => {
                  setShowCustomInput(false);
                  setNewItem("");
                }}
                className="flex-1 sm:flex-initial px-4 py-3 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 active:bg-gray-300 transition-all duration-200 shadow-sm flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" />
                <span className="sm:hidden">Cancel</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Selected Treatments */}
      <div className="space-y-4">
        {items?.map(
          (
            item: {
              mainTreatment: string;
              subTreatments?: Array<{
                name: string;
                slug: string;
                price?: number;
              }>;
            },
            index: number
          ) => {
            const selectedTreatment = availableTreatments.find(
              (t) => t.name === item.mainTreatment
            );

            return (
              <div
                key={index}
                className="bg-white border border-gray-100 rounded-xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-start justify-between mb-4 gap-3">
                  <h3 className="font-semibold text-gray-800 text-sm sm:text-base leading-tight">
                    {item.mainTreatment}
                  </h3>
                  <button
                    onClick={() => onRemove(index)}
                    className="text-red-400 hover:text-red-600 active:text-red-700 transition-colors duration-200 p-1 rounded-lg hover:bg-red-50"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Sub-treatment Section */}
                <div className="space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-sm font-medium text-gray-600">
                      Sub-treatments
                    </span>
                    <button
                      onClick={() => setShowSubTreatmentInput(index)}
                      className="self-start sm:self-auto px-3 py-2 bg-[#2D9AA5]/10 text-[#2D9AA5] rounded-lg text-xs font-medium hover:bg-[#2D9AA5]/20 active:bg-[#2D9AA5]/30 transition-all duration-200"
                    >
                      + Add Sub-treatment
                    </button>
                  </div>

                  {/* Sub-treatment Input */}
                  {showSubTreatmentInput === index && (
                    <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <select
                          onChange={(e) => {
                            if (e.target.value === "custom") {
                              setShowCustomSubTreatmentInput(index);
                              setCustomSubTreatment("");
                            } else if (e.target.value) {
                              handleAddFromAvailableSubTreatments(
                                index,
                                e.target.value
                              );
                            }
                          }}
                          className="text-black flex-1 px-3 py-2 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2D9AA5] focus:border-[#2D9AA5] text-sm transition-all duration-200"
                          value=""
                        >
                          <option value="">Select sub-treatment</option>
                          {selectedTreatment?.subcategories?.map((sub) => (
                            <option key={sub.slug} value={sub.name}>
                              {sub.name}
                            </option>
                          ))}
                          <option value="custom">
                            + Add Custom Sub-treatment
                          </option>
                        </select>
                      </div>

                      {showCustomSubTreatmentInput === index && (
                        <div className="flex flex-col gap-3 sm:flex-row">
                          <input
                            type="text"
                            value={customSubTreatment}
                            onChange={(e) =>
                              setCustomSubTreatment(e.target.value)
                            }
                            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2D9AA5] focus:border-[#2D9AA5] text-sm placeholder-gray-400 transition-all duration-200"
                            placeholder="Custom sub-treatment name"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddSubTreatment(index);
                              }
                            }}
                          />
                          <input
                            type="number"
                            min="0"
                            value={customSubTreatmentPrice}
                            onChange={(e) => {
                              setCustomSubTreatmentPrice(e.target.value);
                            }}
                            className="w-32 px-3 py-2 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2D9AA5] focus:border-[#2D9AA5] text-sm placeholder-gray-400 transition-all duration-200"
                            placeholder="Price"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddSubTreatment(index);
                              }
                            }}
                          />
                          <button
                            onClick={() => handleAddSubTreatment(index)}
                            className="px-4 py-2 bg-[#2D9AA5] text-white rounded-lg text-sm font-medium hover:bg-[#238891] active:bg-[#1f7177] transition-all duration-200 shadow-sm"
                          >
                            Add
                          </button>
                        </div>
                      )}

                      <div className="flex justify-end">
                        <button
                          onClick={() => {
                            setShowSubTreatmentInput(null);
                            setShowCustomSubTreatmentInput(null);
                            setCustomSubTreatment("");
                            setCustomSubTreatmentPrice("");
                          }}
                          className="px-4 py-2 bg-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-300 active:bg-gray-400 transition-all duration-200"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Existing Sub-treatments */}
                  {item.subTreatments && item.subTreatments.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {item.subTreatments.map((subTreatment, subIndex) => (
                        <span
                          key={subIndex}
                          className="inline-flex items-center gap-2 px-3 py-2 bg-[#2D9AA5]/10 text-[#2D9AA5] text-sm rounded-full border border-[#2D9AA5]/20 hover:bg-[#2D9AA5]/20 transition-all duration-200"
                        >
                          <span className="font-medium">
                            {subTreatment.name}
                          </span>
                          <input
                            type="number"
                            min="0"
                            value={subTreatment.price ?? 0}
                            onChange={(e) => {
                              const updatedSubTreatments =
                                item.subTreatments!.map((st, i) =>
                                  i === subIndex
                                    ? { ...st, price: Number(e.target.value) }
                                    : st
                                );
                              onUpdateTreatment(index, {
                                mainTreatment: item.mainTreatment,
                                mainTreatmentSlug: item.mainTreatment.toLowerCase().replace(/\s+/g, "-"),
                                subTreatments: updatedSubTreatments,
                              });
                            }}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-xs ml-2"
                            placeholder="Price"
                          />
                          <button
                            onClick={() =>
                              handleRemoveSubTreatment(index, subIndex)
                            }
                            className="text-[#2D9AA5]/60 hover:text-red-500 active:text-red-600 transition-colors duration-200 p-0.5 rounded-full hover:bg-white/50"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          }
        )}
      </div>
    </div>
  );
};

interface ClinicCardProps {
  clinic: Clinic;
  onEdit: (clinic: Clinic) => void;
  getImagePath: (photoPath: string) => string;
  canUpdate: boolean;
  stats?: ClinicStats;
  statsLoading?: boolean;
}
const ClinicCard = ({ clinic, onEdit, getImagePath, canUpdate, stats, statsLoading }: ClinicCardProps) => {
  // Calculate stats from clinic data if not provided
  const totalTreatments = stats?.totalTreatments || clinic.treatments?.length || 0;
  const totalServices = stats?.totalServices || clinic.servicesName?.length || 0;
  const totalSubTreatments = stats?.totalSubTreatments || clinic.treatments?.reduce(
    (sum, t) => sum + (t.subTreatments?.length || 0),
    0
  ) || 0;

  return (
  <div className="bg-white rounded-lg shadow-sm border border-gray-300 overflow-hidden">
    {/* Profile Header Section with Image in Corner */}
    <div className="p-4 sm:p-6 border-b border-gray-200">
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
        {/* Clinic Image - Top Left Corner */}
        <div className="relative flex-shrink-0">
          <div className="relative w-24 h-24 sm:w-32 sm:h-32 lg:w-40 lg:h-40 rounded-lg overflow-hidden border-4 border-gray-200 shadow-md bg-gray-50">
            {clinic.photos?.[0] ? (
              <Image
                src={getImagePath(clinic.photos[0])}
                className="w-full h-full object-contain"
                alt={clinic.name}
                width={160}
                height={160}
                unoptimized={true}
                onError={(e) => {
                  const img = e.currentTarget as HTMLImageElement;
                  (img as any).onerror = null;
                  img.src = PLACEHOLDER_DATA_URI;
                }}
              />
            ) : (
              <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                <Camera className="w-8 h-8 sm:w-10 sm:h-10 text-gray-400" />
              </div>
            )}
          </div>
          {canUpdate && (
            <button
              onClick={() => onEdit(clinic)}
              className="absolute -bottom-2 -right-2 bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all border-2 border-white"
              title="Edit Profile"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Clinic Info - Next to Image */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-2 break-words">
                {clinic.name}
              </h2>
              <div className="flex items-start gap-2 text-gray-700 text-sm sm:text-base">
                <MapPin className="w-4 h-4 sm:w-5 sm:h-5 mt-0.5 flex-shrink-0 text-gray-500" />
                <span className="break-words">{clinic.address}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Content */}
    <div className="p-4 sm:p-6">
      {/* Statistics Section */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-gray-700" />
          <h3 className="text-lg font-bold text-gray-900">Statistics Overview</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          <StatCard
            icon={<Star className="w-5 h-5" />}
            label="Reviews"
            value={stats?.totalReviews || 0}
            color="text-yellow-600"
            bgColor="bg-yellow-50"
            borderColor="border-yellow-200"
            loading={statsLoading}
          />
          <StatCard
            icon={<Mail className="w-5 h-5" />}
            label="Enquiries"
            value={stats?.totalEnquiries || 0}
            color="text-blue-600"
            bgColor="bg-blue-50"
            borderColor="border-blue-200"
            loading={statsLoading}
          />
          <StatCard
            icon={<Star className="w-5 h-5" />}
            label="Rating"
            value={stats?.averageRating && stats.averageRating > 0 ? stats.averageRating.toFixed(1) : "N/A"}
            color="text-green-600"
            bgColor="bg-green-50"
            borderColor="border-green-200"
            loading={statsLoading}
          />
          <StatCard
            icon={<Heart className="w-5 h-5" />}
            label="Treatments"
            value={totalTreatments}
            color="text-rose-600"
            bgColor="bg-rose-50"
            borderColor="border-rose-200"
            loading={false}
          />
          <StatCard
            icon={<Leaf className="w-5 h-5" />}
            label="Services"
            value={totalServices}
            color="text-emerald-600"
            bgColor="bg-emerald-50"
            borderColor="border-emerald-200"
            loading={false}
          />
          <StatCard
            icon={<Activity className="w-5 h-5" />}
            label="Sub-Treatments"
            value={totalSubTreatments}
            color="text-purple-600"
            bgColor="bg-purple-50"
            borderColor="border-purple-200"
            loading={false}
          />
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white text-sm font-bold">
            د.إ
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-600 mb-1">Consultation Fee</div>
            <div className="text-sm font-bold text-gray-900">
              {clinic.pricing || "Contact for pricing"}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <Clock className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-600 mb-1">Timings</div>
            <div className="text-sm font-bold text-gray-900">
              {clinic.timings || "Contact for timings"}
            </div>
          </div>
        </div>
      </div>

      {/* Services */}
      {clinic.servicesName?.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <Leaf className="w-4 h-4 text-green-600" />
            Services
          </h3>
          <div className="flex flex-wrap gap-2">
            {clinic.servicesName.map((service, idx) => (
              <span
                key={idx}
                className="px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-xs font-medium border border-green-200"
              >
                {service}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Treatments */}
      {clinic.treatments?.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Heart className="w-4 h-4 text-rose-600" />
            Treatments
          </h3>
          <div className="space-y-3">
            {clinic.treatments.map((treatment, idx) => (
              <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <span className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold inline-block mb-2">
                  {treatment.mainTreatment}
                </span>
                {treatment.subTreatments &&
                  treatment.subTreatments.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {treatment.subTreatments.map((subTreatment, subIdx) => (
                        <span
                          key={subIdx}
                          className="px-3 py-1.5 bg-white text-gray-700 rounded-lg text-xs font-medium border border-gray-200"
                        >
                          {subTreatment.name}
                          {typeof subTreatment.price === "number" &&
                            subTreatment.price > 0 && (
                              <>
                                {" "}
                                -{" "}
                                <span className="text-blue-600 font-bold">
                                  د.إ{subTreatment.price}
                                </span>
                              </>
                            )}
                        </span>
                      ))}
                    </div>
                  )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="pt-4 border-t border-gray-200">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <Calendar className="w-4 h-4" />
          <span className="font-medium">
            Established{" "}
            {new Date(clinic.createdAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
            })}
          </span>
        </div>
      </div>
    </div>
  </div>
  );
};

// Statistics Card Component
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
  bgColor: string;
  borderColor: string;
  loading?: boolean;
}

const StatCard = ({ icon, label, value, color, bgColor, borderColor, loading }: StatCardProps) => (
  <div className={`bg-white rounded-lg p-3 sm:p-4 border ${borderColor} ${bgColor} shadow-sm hover:shadow-md transition-all`}>
    <div className={`flex items-center gap-2 mb-2 ${color}`}>
      {icon}
      <span className="text-xs font-semibold text-gray-700">{label}</span>
    </div>
    {loading ? (
      <div className="flex items-center gap-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
        <span className="text-xs text-gray-500">Loading...</span>
      </div>
    ) : (
      <p className="text-xl sm:text-2xl font-bold text-gray-900">{value}</p>
    )}
  </div>
);

function ClinicManagementDashboard() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingClinicId, setEditingClinicId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Clinic>>({});
  const [newService, setNewService] = useState("");
  const [newTreatment, setNewTreatment] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [updating, setUpdating] = useState(false);
  const [availableTreatments, setAvailableTreatments] = useState<Treatment[]>(
    []
  );
  const [showCustomTreatmentInput, setShowCustomTreatmentInput] =
    useState(false);
  const [geocodingStatus, setGeocodingStatus] = useState<string>("");
  const addressDebounceTimer = useRef<NodeJS.Timeout | null>(null);
  const [photoError, setPhotoError] = useState("");
  
  // Permission state
  const [permissions, setPermissions] = useState({
    canRead: false,
    canUpdate: false,
    canDelete: false,
  });
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);

  // Statistics state
  const [clinicStats, setClinicStats] = useState<ClinicStats>({
    totalReviews: 0,
    totalEnquiries: 0,
    averageRating: 0,
    totalTreatments: 0,
    totalServices: 0,
    totalSubTreatments: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  const getImagePath = (photoPath: string): string => {
    if (!photoPath) return PLACEHOLDER_DATA_URI;
    if (photoPath.startsWith("http")) return photoPath;
    if (photoPath.startsWith("/")) return photoPath;
    if (photoPath.includes("uploads/clinic/")) {
      const filename = photoPath.split("uploads/clinic/").pop();
      return `/uploads/clinic/${filename}`;
    }
    return `/uploads/clinic/${photoPath}`;
  };

  // Fetch permissions
  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const token = localStorage.getItem("clinicToken");
        if (!token) {
          setPermissions({
            canRead: false,
            canUpdate: false,
            canDelete: false,
          });
          setPermissionsLoaded(true);
          return;
        }

        const res = await axios.get("/api/clinic/permissions", {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = res.data;
        if (data.success && data.data) {
          const modulePermission = data.data.permissions?.find((p: any) => {
            if (!p?.module) return false;
            if (p.module === "health_center") return true;
            if (p.module === "clinic_health_center") return true;
            if (p.module.startsWith("clinic_") && p.module.slice(7) === "health_center") {
              return true;
            }
            return false;
          });

          if (modulePermission) {
            const actions = modulePermission.actions || {};
            
            // Module-level "all" grants all permissions
            const moduleAll = actions.all === true;
            const moduleRead = actions.read === true;
            const moduleUpdate = actions.update === true;
            const moduleDelete = actions.delete === true;

            setPermissions({
              canRead: moduleAll || moduleRead,
              canUpdate: moduleAll || moduleUpdate,
              canDelete: moduleAll || moduleDelete,
            });
          } else {
            // No permissions found for this module, default to false
            setPermissions({
              canRead: false,
              canUpdate: false,
              canDelete: false,
            });
          }
        } else {
          // API failed or no permissions data, default to false
          setPermissions({
            canRead: false,
            canUpdate: false,
            canDelete: false,
          });
        }
        setPermissionsLoaded(true);
      } catch (err: any) {
        console.error("Error fetching permissions:", err);
        // On error, default to false (no permissions)
        setPermissions({
          canRead: false,
          canUpdate: false,
          canDelete: false,
        });
        setPermissionsLoaded(true);
      }
    };

    fetchPermissions();
  }, []);

  useEffect(() => {
    const fetchClinics = async () => {
      // Wait for permissions to load
      if (!permissionsLoaded) return;

      // ✅ Don't make API call if we already know user doesn't have read permission
      // This prevents the 403 error from happening in the first place
      if (!permissions.canRead) {
        setClinics([]);
        setLoading(false);
        return;
      }

      try {
        const token = localStorage.getItem("clinicToken");
        if (!token) {
          setLoading(false);
          return;
        }

        // Use axios with error handling that prevents Next.js error overlay
        const res = await axios.get("/api/clinics/myallClinic", {
          headers: { Authorization: `Bearer ${token}` },
          // Suppress error overlay for 403 errors
          validateStatus: (status) => status === 200 || status === 403,
        });
        
        // Check if response is 403
        if (res.status === 403) {
          // Handle 403 silently - this is expected when permissions are not granted
          setPermissions(prev => ({
            ...prev,
            canRead: false,
          }));
          setClinics([]);
          setLoading(false);
          return;
        }
        
        setClinics(
          Array.isArray(res.data.clinics) ? res.data.clinics : [res.data.clinic]
        );
      } catch (err: any) {
        // Only catch non-403 errors here (validateStatus handles 403 above)
        // For other errors (network, server errors, etc.), log and show message
        console.error("Error fetching clinics:", err);
        if (err.response?.status !== 403) {
          toast.error("Failed to fetch clinic information. Please try again.");
        }
      } finally {
        setLoading(false);
      }
    };

    const fetchTreatments = async () => {
      try {
        const token = localStorage.getItem("clinicToken");
        const res = await axios.get("/api/doctor/getTreatment", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setAvailableTreatments(res.data.treatments || []);
      } catch (err) {
        console.error("Error fetching treatments:", err);
      }
    };

    fetchClinics();
    fetchTreatments();
  }, [permissionsLoaded, permissions.canRead]);

  // Fetch clinic statistics
  useEffect(() => {
    const fetchClinicStats = async () => {
      if (!permissionsLoaded || !permissions.canRead) {
        setStatsLoading(false);
        return;
      }

      try {
        const token = localStorage.getItem("clinicToken");
        if (!token) {
          setStatsLoading(false);
          return;
        }

        // Fetch dashboard stats
        const statsRes = await axios.get("/api/clinics/dashboardStats", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (statsRes.data.success) {
          const stats = statsRes.data.stats;
          
          // Calculate stats from clinic data
          const currentClinic = clinics[0];
          const totalTreatments = currentClinic?.treatments?.length || 0;
          const totalServices = currentClinic?.servicesName?.length || 0;
          const totalSubTreatments = currentClinic?.treatments?.reduce(
            (sum: number, t: any) => sum + (t.subTreatments?.length || 0),
            0
          ) || 0;

          // Fetch reviews for average rating
          let averageRating = 0;
          try {
            const reviewsRes = await axios.get(`/api/clinics/reviews/${currentClinic?._id}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (reviewsRes.data.success && reviewsRes.data.data) {
              averageRating = reviewsRes.data.data.averageRating || 0;
            }
          } catch (error) {
            console.error("Error fetching reviews:", error);
          }

          setClinicStats({
            totalReviews: stats.totalReviews || 0,
            totalEnquiries: stats.totalEnquiries || 0,
            averageRating: averageRating,
            totalTreatments: totalTreatments,
            totalServices: totalServices,
            totalSubTreatments: totalSubTreatments,
          });
        }
      } catch (error) {
        console.error("Error fetching clinic stats:", error);
      } finally {
        setStatsLoading(false);
      }
    };

    if (clinics.length > 0) {
      fetchClinicStats();
    } else {
      setStatsLoading(false);
    }
  }, [clinics, permissionsLoaded, permissions.canRead]);

  const handleEdit = (clinic: unknown) => {
    // Check permission before allowing edit
    if (!permissions.canUpdate) {
      toast.error("You do not have permission to update clinic information");
      return;
    }

    setIsEditing(true);
    setEditingClinicId((clinic as Clinic)._id);
    setEditForm({
      ...(clinic as Clinic),
      treatments: (clinic as Clinic).treatments || [],
      servicesName: (clinic as Clinic).servicesName || [],
    });
  };

  const handleEditFromHeader = () => {
    // Check permission before allowing edit
    if (!permissions.canUpdate) {
      toast.error("You do not have permission to update clinic information");
      return;
    }

    if (clinics.length > 0) {
      handleEdit(clinics[0]); // Edit the first clinic if available
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingClinicId(null);
    setEditForm({});
    setSelectedFile(null);
    setNewService("");
    setNewTreatment("");
    setShowCustomTreatmentInput(false);
  };

  const handleInputChange = (field: string, value: string) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const addService = () => {
    if (newService.trim() && editForm.servicesName) {
      if (editForm.servicesName.includes(newService.trim())) {
        toast.error("Service already exists");
        return;
      }
      setEditForm((prev) => ({
        ...prev,
        servicesName: [...(prev.servicesName || []), newService.trim()],
      }));
      setNewService("");
      toast.success("Service added successfully");
    } else {
      toast.error("Please enter a service name");
    }
  };

  const removeService = (index: number) => {
    const serviceName = editForm.servicesName?.[index];
    setEditForm((prev) => ({
      ...prev,
      servicesName: prev.servicesName?.filter((_, i) => i !== index) || [],
    }));
    toast.success(`Service "${serviceName}" removed`);
  };

  const addTreatment = async () => {
    const trimmed = newTreatment.trim();
    console.log("Adding custom treatment:", trimmed);
    console.log("Current treatments:", editForm.treatments);
    if (
      trimmed &&
      !editForm.treatments?.some((t) => t.mainTreatment === trimmed)
    ) {
      try {
        // Add to database if it's a custom treatment
        const token = localStorage.getItem("clinicToken");
        const response = await axios.post(
          "/api/doctor/add-custom-treatment",
          {
            mainTreatment: trimmed,
            subTreatments: [],
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (response.data.success) {
          // Refresh available treatments
          const treatmentsResponse = await axios.get(
            "/api/doctor/getTreatment",
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          setAvailableTreatments(treatmentsResponse.data.treatments || []);
        }
      } catch (error) {
        console.error("Error adding custom treatment to database:", error);
        // Continue with local addition even if database call fails
      }

      setEditForm((prev) => {
        const newTreatments = [
          ...(prev.treatments || []),
          {
            mainTreatment: trimmed,
            mainTreatmentSlug: trimmed.toLowerCase().replace(/\s+/g, "-"),
            subTreatments: [],
          },
        ];
        console.log("New treatments array after adding custom:", newTreatments);
        return {
          ...prev,
          treatments: newTreatments,
        };
      });
      toast.success(`Treatment "${trimmed}" added successfully`);
    } else {
      if (!trimmed) {
        toast.error("Please enter a treatment name");
      } else {
        toast.error("Treatment already exists");
      }
    }
    setNewTreatment("");
    setShowCustomTreatmentInput(false);
  };

  const addTreatmentFromDropdown = (treatmentName: string) => {
    console.log("Adding treatment from dropdown:", treatmentName);
    console.log("Current treatments:", editForm.treatments);
    if (
      treatmentName &&
      !editForm.treatments?.some((t) => t.mainTreatment === treatmentName)
    ) {
      setEditForm((prev) => {
        const newTreatments = [
          ...(prev.treatments || []),
          {
            mainTreatment: treatmentName,
            mainTreatmentSlug: treatmentName.toLowerCase().replace(/\s+/g, "-"),
            subTreatments: [],
          },
        ];
        console.log("New treatments array:", newTreatments);
        return {
          ...prev,
          treatments: newTreatments,
        };
      });
      toast.success(`Treatment "${treatmentName}" added successfully`);
    } else {
      toast.error("Treatment already exists");
    }
  };

  const removeTreatment = (index: number) => {
    const treatmentName = editForm.treatments?.[index]?.mainTreatment;
    setEditForm((prev) => ({
      ...prev,
      treatments: prev.treatments?.filter((_, i) => i !== index) || [],
    }));
    toast.success(`Treatment "${treatmentName}" removed`);
  };

  const handleUpdateTreatment = (
    index: number,
    updatedTreatment: {
      mainTreatment: string;
      mainTreatmentSlug: string;
      subTreatments: Array<{
        name: string;
        slug: string;
        price?: number;
      }>;
    }
  ) => {
    setEditForm((prev) => ({
      ...prev,
      treatments:
        prev.treatments?.map((treatment, i) =>
          i === index ? updatedTreatment : treatment
        ) || [],
    }));
  };

  const handleUpdate = async () => {
    if (!editingClinicId) return;

    // Check permission before updating
    if (!permissions.canUpdate) {
      toast.error("You do not have permission to update clinic information");
      return;
    }

    setUpdating(true);
    try {
      const token = localStorage.getItem("clinicToken");
      const formData = new FormData();

      // Debug: Log the editForm data
      console.log("EditForm data:", editForm);
      console.log("Treatments to be sent:", editForm.treatments);

      Object.keys(editForm).forEach((key) => {
        if (
          key === "servicesName" ||
          key === "treatments" ||
          key === "location"
        ) {
          formData.append(key, JSON.stringify(editForm[key as keyof Clinic]));
        } else if (editForm[key as keyof Clinic] !== undefined) {
          formData.append(key, String(editForm[key as keyof Clinic]));
        }
      });

      if (selectedFile) formData.append("photo", selectedFile);

      // Debug: Log the FormData contents
      for (const [key, value] of Object.entries(formData.entries())) {
        console.log(`FormData ${key}:`, value);
      }

      const response = await axios.put(
        `/api/clinics/${editingClinicId}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      if (response.data.success) {
        setClinics((prev) =>
          prev.map((clinic) =>
            clinic._id === editingClinicId ? response.data.clinic : clinic
          )
        );
        toast.success("Clinic profile updated successfully!");
        handleCancel();
      } else {
        toast.error(response.data.message || "Failed to update clinic profile");
      }
    } catch (error: any) {
      console.error("Error updating clinic:", error);
      const errorMessage = error.response?.data?.message || "Error updating clinic. Please try again.";
      toast.error(errorMessage);
    } finally {
      setUpdating(false);
    }
  };

  // Geocode address and update coordinates in editForm
  const geocodeAddress = async (address: string) => {
    if (!address.trim()) return;
    setGeocodingStatus("Locating address...");
    try {
      const res = await axios.get("/api/clinics/geocode", {
        params: { place: address },
      });
      if (
        res.data &&
        typeof res.data.lat === "number" &&
        typeof res.data.lng === "number"
      ) {
        setEditForm((prev) => ({
          ...prev,
          location: {
            type: "Point",
            coordinates: [res.data.lng, res.data.lat],
          },
        }));
        setGeocodingStatus("Address located on map!");
        toast.success("Address geocoded successfully");
        setTimeout(() => setGeocodingStatus(""), 2000);
      } else {
        setGeocodingStatus(
          "Could not locate address. Please check the address."
        );
        toast.error("Could not locate address. Please check the address.");
        setTimeout(() => setGeocodingStatus(""), 4000);
      }
    } catch {
      setGeocodingStatus("Geocoding failed. Please check the address.");
      toast.error("Geocoding failed. Please check the address.");
      setTimeout(() => setGeocodingStatus(""), 4000);
    }
  };

  // Enhanced address change handler with debounce and geocoding
  const handleAddressChangeWithGeocode = (value: string) => {
    handleInputChange("address", value);
    if (addressDebounceTimer.current)
      clearTimeout(addressDebounceTimer.current);
    if (value.trim().length > 10) {
      addressDebounceTimer.current = setTimeout(() => {
        geocodeAddress(value);
      }, 1000);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster 
        position="top-right" 
        toastOptions={{
          duration: 3000,
          style: {
            background: '#fff',
            color: '#374151',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '12px 16px',
            fontSize: '14px',
            fontWeight: '500',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8">
        <Header
          onEditClick={handleEditFromHeader}
          hasClinic={clinics.length > 0}
          isEditing={isEditing}
          canUpdate={permissions.canUpdate}
          clinicName={clinics[0]?.name}
        />

        {isEditing ? (
          <div className="max-w-5xl mx-auto">
            <div className="bg-white rounded-lg shadow-sm border border-gray-300 p-6 sm:p-8">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Edit3 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                      Edit Clinic Profile
                    </h2>
                    <p className="text-gray-600 text-sm">
                      Update your clinic information
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleCancel}
                  className="self-end sm:self-auto p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                {/* Left Column */}
                <div className="space-y-4 sm:space-y-6">
                  <FormInput
                    label="Clinic Name"
                    icon={<Building2 className="w-4 h-4" />}
                    value={editForm.name || ""}
                    onChange={(value: string) =>
                      handleInputChange("name", value)
                    }
                    placeholder="Enter clinic name"
                  />

                  <FormInput
                    label={
                      <span className="flex items-center gap-2">
                        Address
                        {geocodingStatus && (
                          <span className="text-[#2D9AA5] text-xs font-medium px-2 py-1 bg-[#2D9AA5]/10 rounded">
                            {geocodingStatus}
                          </span>
                        )}
                      </span>
                    }
                    icon={<MapPin className="w-4 h-4" />}
                    value={editForm.address || ""}
                    onChange={handleAddressChangeWithGeocode}
                    type="textarea"
                    placeholder="Enter complete address with state, city and place"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormInput
                      label="Consultation Fee"
                      icon={
                        <svg
                          className="w-4 h-4"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <text
                            x="2"
                            y="16"
                            fontSize="20"
                            fontWeight="bold"
                            fill="currentColor"
                          >
                            د.إ
                          </text>
                        </svg>
                      }
                      value={editForm.pricing || ""}
                      onChange={(value: string) =>
                        handleInputChange("pricing", value)
                      }
                      placeholder="د.إ500 - د.إ2000"
                    />
                    <FormInput
                      label="Timings"
                      icon={<Clock className="w-4 h-4" />}
                      value={editForm.timings || ""}
                      onChange={(value: string) =>
                        handleInputChange("timings", value)
                      }
                      placeholder="9:00 AM - 8:00 PM"
                    />
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-4 sm:space-y-6">
                  <TagManager
                    label="Services"
                    icon={<Leaf className="w-4 h-4" />}
                    items={editForm.servicesName ?? []}
                    newItem={newService}
                    setNewItem={setNewService}
                    onAdd={addService}
                    onRemove={removeService}
                    className="hidden"
                  />

                  <TreatmentManager
                    label="Treatments"
                    icon={<Heart className="w-4 h-4" />}
                    items={editForm.treatments ?? []}
                    newItem={newTreatment}
                    setNewItem={setNewTreatment}
                    onAdd={addTreatment}
                    onRemove={removeTreatment}
                    availableTreatments={availableTreatments}
                    showCustomInput={showCustomTreatmentInput}
                    setShowCustomInput={setShowCustomTreatmentInput}
                    onAddFromDropdown={addTreatmentFromDropdown}
                    onUpdateTreatment={handleUpdateTreatment}
                    setAvailableTreatments={setAvailableTreatments}
                  />

                  {/* Photo Upload */}
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                      <Camera className="w-4 h-4" />
                      Health Center Photo
                    </label>
                    <div className="relative border-2 border-dashed border-gray-200 rounded-xl p-6 sm:p-8 text-center hover:border-[#2D9AA5]/50 hover:bg-[#2D9AA5]/5 transition-all">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            const file = e.target.files[0];
                            if (
                              file.type !== "image/png" &&
                              file.type !== "image/jpeg" &&
                              file.type !== "image/jpg"
                            ) {
                              setPhotoError("Please upload a PNG or JPG file");
                              setSelectedFile(null);
                              toast.error("Please upload a PNG or JPG file");
                            } else if (file.size > 1024 * 1024) {
                              setPhotoError(
                                "File is too large and you have to upload file less than 1MB"
                              );
                              setSelectedFile(null);
                              toast.error("File size must be less than 1MB");
                            } else {
                              setSelectedFile(file);
                              setPhotoError("");
                              toast.success("Photo selected successfully");
                            }
                          }
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div className="w-12 h-12 bg-[#2D9AA5]/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                        <Camera className="w-6 h-6 text-[#2D9AA5]" />
                      </div>
                      <p className="text-gray-700 font-medium mb-1">
                        Click to upload photo
                      </p>
                      <p className="text-gray-500 text-sm">
                        PNG, JPG up to 1MB
                      </p>
                      {selectedFile && (
                        <div className="mt-3 p-2 bg-[#2D9AA5]/10 rounded-lg">
                          <p className="text-[#2D9AA5] text-sm font-medium">
                            {selectedFile.name}
                          </p>
                        </div>
                      )}
                      {photoError && (
                        <div className="mt-3 p-2 bg-red-50 rounded-lg">
                          <p className="text-red-600 text-sm font-medium">
                            {photoError}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-6 mt-6 border-t border-gray-300">
                <button
                  onClick={handleUpdate}
                  disabled={updating}
                  className="order-2 sm:order-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold transition-colors shadow-sm hover:shadow-md"
                >
                  {updating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Updating...</span>
                    </>
                  ) : (
                    "Update Profile"
                  )}
                </button>
                <button
                  onClick={handleCancel}
                  className="order-1 sm:order-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full">
            {/* Show permission denied message if no read permission */}
            {!permissions.canRead ? (
              <div className="bg-white rounded-lg p-8 sm:p-12 border border-gray-300 shadow-sm">
                <div className="text-center max-w-md mx-auto">
                  <div className="w-16 h-16 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <Building2 className="w-8 h-8 text-red-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    Access Denied
                  </h3>
                  <p className="text-gray-700 mb-4">
                    You do not have permission to view clinic information.
                  </p>
                  <p className="text-sm text-gray-600">
                    Please contact your administrator to request access to the Health Center Management module.
                  </p>
                </div>
              </div>
            ) : clinics.length === 0 ? (
              <div className="bg-white rounded-lg p-8 sm:p-12 border border-gray-300 shadow-sm">
                <div className="text-center max-w-md mx-auto">
                  <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <Building2 className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    No Clinics Found
                  </h3>
                  <p className="text-gray-700">
                    Start by adding your first clinic
                  </p>
                </div>
              </div>
            ) : (
              <div className="w-full space-y-6">
                {clinics.map((clinic) => (
                  <ClinicCard
                    key={clinic._id}
                    clinic={clinic}
                    onEdit={handleEdit}
                    getImagePath={getImagePath}
                    canUpdate={permissions.canUpdate}
                    stats={clinicStats}
                    statsLoading={statsLoading}
                  />
                ))}
                
                {/* Statistics Charts Section */}
                {clinics.length > 0 && (
                  <div className="bg-white rounded-lg p-6 border border-gray-300 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                      <TrendingUp className="w-6 h-6 text-gray-700" />
                      <div>
                        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Analytics & Insights</h2>
                        <p className="text-sm text-gray-600">Visual representation of your clinic performance</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Bar Chart - Reviews vs Enquiries */}
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <h3 className="text-sm font-semibold text-gray-700 mb-4">Reviews & Enquiries</h3>
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={[
                            { name: 'Reviews', value: clinicStats.totalReviews },
                            { name: 'Enquiries', value: clinicStats.totalEnquiries },
                          ]}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="name" stroke="#6b7280" fontSize={12} />
                            <YAxis stroke="#6b7280" fontSize={12} />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: '#fff', 
                                border: '1px solid #e5e7eb',
                                borderRadius: '6px',
                                fontSize: '12px'
                              }}
                            />
                            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                              <Cell fill="#3b82f6" />
                              <Cell fill="#10b981" />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Column Chart - Services Distribution */}
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <h3 className="text-sm font-semibold text-gray-700 mb-4">Services Distribution</h3>
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart
                            data={[
                              { name: 'Treatments', value: clinicStats.totalTreatments },
                              { name: 'Services', value: clinicStats.totalServices },
                              { name: 'Sub-Treatments', value: clinicStats.totalSubTreatments },
                            ]}
                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis 
                              dataKey="name" 
                              stroke="#6b7280" 
                              fontSize={12}
                              tick={{ fill: '#6b7280' }}
                            />
                            <YAxis 
                              stroke="#6b7280" 
                              fontSize={12}
                              tick={{ fill: '#6b7280' }}
                            />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: '#fff', 
                                border: '1px solid #e5e7eb',
                                borderRadius: '6px',
                                fontSize: '12px'
                              }}
                            />
                            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                              <Cell fill="#3b82f6" />
                              <Cell fill="#10b981" />
                              <Cell fill="#8b5cf6" />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                      <SummaryCard
                        title="Total Engagement"
                        value={clinicStats.totalReviews + clinicStats.totalEnquiries}
                        icon={<Users className="w-5 h-5" />}
                        color="blue"
                      />
                      <SummaryCard
                        title="Average Rating"
                        value={clinicStats.averageRating > 0 ? `${clinicStats.averageRating.toFixed(1)} ⭐` : "No ratings"}
                        icon={<Star className="w-5 h-5" />}
                        color="yellow"
                      />
                      <SummaryCard
                        title="Total Offerings"
                        value={clinicStats.totalTreatments + clinicStats.totalServices}
                        icon={<Heart className="w-5 h-5" />}
                        color="rose"
                      />
                      <SummaryCard
                        title="Activity Score"
                        value={clinicStats.totalSubTreatments > 0 ? "Active" : "Setup"}
                        icon={<Activity className="w-5 h-5" />}
                        color="green"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

ClinicManagementDashboard.getLayout = function PageLayout(
  page: React.ReactNode
) {
  return <ClinicLayout>{page}</ClinicLayout>;
};

// ✅ Apply HOC and assign correct type
const ProtectedDashboard: NextPageWithLayout = withClinicAuth(
  ClinicManagementDashboard
);

// ✅ Reassign layout (TS-safe now)
ProtectedDashboard.getLayout = ClinicManagementDashboard.getLayout;

// Summary Card Component
interface SummaryCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: "blue" | "yellow" | "rose" | "green";
}

const SummaryCard = ({ title, value, icon, color }: SummaryCardProps) => {
  const colorClasses = {
    blue: "bg-blue-50 border-blue-200 text-blue-600",
    yellow: "bg-yellow-50 border-yellow-200 text-yellow-600",
    rose: "bg-rose-50 border-rose-200 text-rose-600",
    green: "bg-green-50 border-green-200 text-green-600",
  };

  const [bgColor, borderColor, textColor] = colorClasses[color].split(' ');

  return (
    <div className={`bg-white rounded-lg p-4 border ${borderColor} shadow-sm`}>
      <div className={`flex items-center gap-2 mb-2 ${textColor}`}>
        {icon}
        <span className="text-xs font-semibold text-gray-700">{title}</span>
      </div>
      <p className="text-lg font-bold text-gray-900">{value}</p>
    </div>
  );
};

export default ProtectedDashboard;