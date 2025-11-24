"use client";
import React, { useState, useEffect } from "react";
import axios from "axios";
import ClinicLayout from '../../components/staffLayout';
import withClinicAuth from '../../components/withStaffAuth';
import { Toaster, toast } from 'react-hot-toast';

const EodNotePad = () => {
  const [note, setNote] = useState("");
  const [notes, setNotes] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [expandedNotes, setExpandedNotes] = useState({});
  const [activeTab, setActiveTab] = useState("add");

  const token = localStorage.getItem("userToken");

  const handleAddNote = async () => {
    if (!note.trim()) {
      toast.error("Please enter a note", {
        duration: 3000,
        position: 'top-right',
      });
      return;
    }

    const loadingToast = toast.loading("Saving your note...", {
      position: 'top-right',
    });

    try {
      const res = await axios.post(
        "/api/staff/addEodNote",
        { note },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setNotes(res.data.eodNotes);
      setNote("");
      toast.success("Note saved successfully!", {
        duration: 3000,
        position: 'top-right',
      });
      setActiveTab("view");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save note. Please try again.", {
        duration: 4000,
        position: 'top-right',
      });
    } finally {
      toast.dismiss(loadingToast);
    }
  };

  const fetchNotes = async (date = "") => {
    try {
      const res = await axios.get(`/api/staff/getEodNotes${date ? `?date=${date}` : ""}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotes(res.data.eodNotes || []);
      setExpandedNotes({});
      
      if (date) {
        toast.success(`Notes filtered for ${new Date(date).toLocaleDateString()}`, {
          duration: 2000,
          position: 'top-right',
        });
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch notes. Please try again.", {
        duration: 3000,
        position: 'top-right',
      });
    }
  };

  useEffect(() => {
    const loadNotes = async () => {
      try {
        await fetchNotes();
        toast.success("Notes loaded successfully", {
          duration: 2000,
          position: 'top-right',
        });
      } catch (err) {
        toast.error("Failed to load notes", {
          duration: 3000,
          position: 'top-right',
        });
      }
    };
    loadNotes();
  }, []);

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    setSelectedDate(newDate);
    fetchNotes(newDate);
  };

  const clearDateFilter = () => {
    setSelectedDate("");
    fetchNotes();
    toast.success("Filter cleared. Showing all notes.", {
      duration: 2000,
      position: 'top-right',
    });
  };

  const toggleExpand = (index) => {
    setExpandedNotes(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
    
    if (!expandedNotes[index]) {
      toast.success("Note expanded", {
        duration: 1500,
        position: 'bottom-right',
        icon: '📖',
      });
    }
  };

  const shouldTruncate = (text) => {
    return text.split('\n').length > 4;
  };

  const getTruncatedText = (text) => {
    const lines = text.split('\n');
    return lines.slice(0, 4).join('\n');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster 
        toastOptions={{
          success: {
            style: {
              background: '#10b981',
              color: '#fff',
            },
            iconTheme: {
              primary: '#fff',
              secondary: '#10b981',
            },
          },
          error: {
            style: {
              background: '#ef4444',
              color: '#fff',
            },
            iconTheme: {
              primary: '#fff',
              secondary: '#ef4444',
            },
          },
          loading: {
            style: {
              background: '#3b82f6',
              color: '#fff',
            },
          },
        }}
      />
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
            End of Day Notes
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your daily notes and observations
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab("add")}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "add"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Add Note
            </button>
            <button
              onClick={() => setActiveTab("view")}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "view"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              View Notes
            </button>
          </nav>
        </div>
      </div>

      {/* Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Add Note Section */}
        {activeTab === "add" && (
          <div className="max-w-3xl">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sm:p-8">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Create New Note
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="note" className="block text-sm font-medium text-gray-700 mb-2">
                    Note Content
                  </label>
                  <textarea
                    id="note"
                    rows="10"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Enter your end-of-day notes here..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-gray-900 placeholder-gray-400 transition-shadow"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleAddNote}
                    className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    Save Note
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* View Notes Section */}
        {activeTab === "view" && (
          <div>
            {/* Filter Bar */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h2 className="text-lg font-medium text-gray-900">
                  Your Notes
                </h2>
                
                <div className="flex items-center gap-3">
                  <label htmlFor="date-filter" className="text-sm font-medium text-gray-700 whitespace-nowrap">
                    Filter by date:
                  </label>
                  <input
                    id="date-filter"
                    type="date"
                    value={selectedDate}
                    onChange={handleDateChange}
                    className="text-gray-800 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                  {selectedDate && (
                    <button
                      onClick={clearDateFilter}
                      className="text-sm text-gray-500 hover:text-gray-700 underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Notes List */}
            <div className="space-y-4">
              {notes.length > 0 ? (
                notes.map((n, i) => {
                  const isExpanded = expandedNotes[i];
                  const needsTruncation = shouldTruncate(n.note);
                  const displayText = needsTruncation && !isExpanded 
                    ? getTruncatedText(n.note) 
                    : n.note;

                  return (
                    <div 
                      key={i} 
                      className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <p className="text-sm text-gray-500">
                            {new Date(n.createdAt).toLocaleDateString('en-US', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {new Date(n.createdAt).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                      
                      <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {displayText}
                      </p>

                      {needsTruncation && (
                        <button
                          onClick={() => toggleExpand(i)}
                          className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          {isExpanded ? "Show less" : "Show more"}
                        </button>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No notes found</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {selectedDate 
                      ? "No notes available for the selected date." 
                      : "Get started by creating your first note."}
                  </p>
                  {!selectedDate && (
                    <div className="mt-6">
                      <button
                        onClick={() => setActiveTab("add")}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Add Note
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

EodNotePad.getLayout = function PageLayout(page) {
  return <ClinicLayout>{page}</ClinicLayout>;
};

const ProtectedDashboard = withClinicAuth(EodNotePad);
ProtectedDashboard.getLayout = EodNotePad.getLayout;

export default ProtectedDashboard;