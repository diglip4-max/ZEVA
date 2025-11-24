import React, { useEffect, useState, ChangeEvent } from "react";
import axios from "axios";
import Link from "next/link";

type Job = {
  _id: string;
  companyName: string;
  location: string;
  salary?: string;
  salaryType?: string;
  role: string;
  createdAt: string;
  jobType?: string;
  department?: string;
  experience?: string;
  jobTitle?: string;
};

type Filters = {
  location: string;
  jobType: string;
  department: string;
  skills: string;
  salary: string;
  time: string;
  experience?: string;
};

const AllJobs: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filters, setFilters] = useState<Filters>({
    location: "",
    jobType: "",
    department: "",
    skills: "",
    salary: "",
    time: "",
    experience: "",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const jobsPerPage = 6;

  const fetchJobs = async () => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params.append(k, v);
      });

      // Add search query if it exists
      if (searchQuery.trim()) {
        params.append("search", searchQuery.trim());
      }

      const res = await axios.get<{ jobs: Job[] }>(
        `/api/job-postings/all?${params.toString()}`
      );
      setJobs(res.data.jobs);
      setCurrentPage(1); // Reset to first page when filters change
    } catch (err) {
      console.error("Error fetching jobs:", err);
    }
  };

  const formatPostedDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "1 day ago";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatSalary = (job: Job) => {
    if (job.salary) return `${job.salary} ${job.salaryType ? `/ ${job.salaryType}` : ""}`;
    if (job.salaryType) return `Not specified / ${job.salaryType}`;
    return "Not specified";
  };

  // Calculate pagination
  const totalPages = Math.ceil(jobs.length / jobsPerPage);
  const indexOfLastJob = currentPage * jobsPerPage;
  const indexOfFirstJob = indexOfLastJob - jobsPerPage;
  const currentJobs = jobs.slice(indexOfFirstJob, indexOfLastJob);

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      }
    }

    return pages;
  };

  useEffect(() => {
    fetchJobs();
  }, [filters, searchQuery]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleSearchSubmit = () => {
    fetchJobs();
    window.scrollTo({ top: window.innerHeight, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section with Search */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-10">
            <h1 className="text-5xl md:text-6xl font-bold mb-4 tracking-tight">
              Find Your Dream Job
            </h1>
            <p className="text-xl text-teal-50 max-w-2xl mx-auto">
              Discover thousands of job opportunities with all the information you need
            </p>
          </div>

          {/* Main Search Bar */}
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl shadow-2xl p-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="relative">
                  <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    value={searchQuery}
                    onChange={handleSearchChange}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearchSubmit()}
                    placeholder="Job title, keywords, or company"
                    className="w-full pl-12 pr-4 py-4 text-gray-900 placeholder-gray-500 rounded-xl border-2 border-transparent focus:border-teal-500 focus:outline-none transition-colors"
                  />
                </div>
                <div className="relative">
                  <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <input
                    name="location"
                    value={filters.location}
                    onChange={handleChange}
                    placeholder="City or state"
                    className="w-full pl-12 pr-4 py-4 text-gray-900 placeholder-gray-500 rounded-xl border-2 border-transparent focus:border-teal-500 focus:outline-none transition-colors"
                  />
                </div>
                <button
                  onClick={handleSearchSubmit}
                  className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Search Jobs
                </button>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto mt-10">
            <div className="text-center">
              <div className="text-3xl font-bold mb-1">{jobs.length}+</div>
              <div className="text-teal-100 text-sm">Live Jobs</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold mb-1">500+</div>
              <div className="text-teal-100 text-sm">Companies</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold mb-1">300+</div>
              <div className="text-teal-100 text-sm">New Jobs</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold mb-1">1M+</div>
              <div className="text-teal-100 text-sm">Candidates</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Filters */}
          <aside className="lg:w-80 flex-shrink-0">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900">Filters</h3>
                <button
                  onClick={() => {
                    setFilters({ location: "", jobType: "", department: "", skills: "", salary: "", time: "", experience: "" });
                    setSearchQuery("");
                  }}
                  className="text-sm text-teal-600 hover:text-teal-700 font-medium"
                >
                  Clear all
                </button>
              </div>

              <div className="space-y-6">
                {/* Date Posted */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Date Posted
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="time"
                        value=""
                        checked={filters.time === ""}
                        onChange={handleChange}
                        className="w-4 h-4 text-teal-600 border-gray-300 focus:ring-teal-500"
                      />
                      <span className="ml-3 text-sm text-gray-700">All time</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="time"
                        value="week"
                        checked={filters.time === "week"}
                        onChange={handleChange}
                        className="w-4 h-4 text-teal-600 border-gray-300 focus:ring-teal-500"
                      />
                      <span className="ml-3 text-sm text-gray-700">Last 7 days</span>
                    </label>
                  </div>
                </div>

                <div className="border-t border-gray-200"></div>

                {/* Job Type */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Job Type
                  </label>
                  <select
                    name="jobType"
                    value={filters.jobType}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 text-gray-900 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
                  >
                    <option value="">All Types</option>
                    <option>Full Time</option>
                    <option>Part Time</option>
                    <option>Internship</option>
                  </select>
                </div>

                <div className="border-t border-gray-200"></div>

                {/* Experience Level */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Experience Level
                  </label>
                  <select
                    name="experience"
                    value={filters.experience}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 text-gray-900 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
                  >
                    <option value="">All Levels</option>
                    <option value="fresher">Fresher</option>
                    <option value="1-2">1-2 years</option>
                    <option value="2-4">2-4 years</option>
                    <option value="4-6">4-6 years</option>
                    <option value="7+">7+ years</option>
                  </select>
                </div>

                <div className="border-t border-gray-200"></div>

                {/* Department */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Department
                  </label>
                  <select
                    name="department"
                    value={filters.department}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 text-gray-900 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
                  >
                    <option value="">All Departments</option>
                    <option>Software Development</option>
                    <option>Frontend</option>
                    <option>Backend</option>
                    <option>Full Stack</option>
                    <option>DevOps</option>
                    <option>QA & Testing</option>
                    <option>Automation Testing</option>
                    <option>Manual Testing</option>
                    <option>UI/UX</option>
                    <option>Data Science</option>
                    <option>AI/ML</option>
                    <option>Cloud Computing</option>
                    <option>Cybersecurity</option>
                    <option>Database Administration</option>
                    <option>Product Management</option>
                    <option>Business Analysis</option>
                    <option>General Medicine</option>
                    <option>Cardiology</option>
                    <option>Radiology</option>
                    <option>Dental</option>
                    <option>Pathology</option>
                    <option>Pediatrics</option>
                    <option>Orthopedics</option>
                    <option>Gynecology</option>
                    <option>Dermatology</option>
                    <option>Anesthesiology</option>
                    <option>Surgery</option>
                    <option>ENT</option>
                    <option>Psychiatry</option>
                    <option>Physiotherapy</option>
                    <option>Administration</option>
                    <option>Pharmacy</option>
                    <option>Research</option>
                    <option>Other</option>
                  </select>
                </div>

                <div className="border-t border-gray-200"></div>

                {/* Salary Range */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Minimum Salary (AED)
                  </label>
                  <input
                    name="salary"
                    value={filters.salary}
                    onChange={handleChange}
                    type="number"
                    placeholder="e.g. 20000"
                    className="w-full px-4 py-2.5 text-gray-900 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
                  />
                </div>
              </div>
            </div>
          </aside>

          {/* Job Listings */}
          <main className="flex-1">
            {/* Results Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {jobs.length > 0 ? `${jobs.length} jobs found` : "No jobs found"}
                </h2>
                <p className="text-gray-600 mt-1">
                  {jobs.length > 0
                    ? `Showing ${indexOfFirstJob + 1}-${Math.min(indexOfLastJob, jobs.length)} of ${jobs.length} results`
                    : "Try adjusting your search criteria"}
                </p>
              </div>
              <select className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 focus:ring-2 focus:ring-teal-500 focus:border-teal-500">
                <option>Most Recent</option>
                <option>Most Relevant</option>
                <option>Salary: High to Low</option>
                <option>Salary: Low to High</option>
              </select>
            </div>

            {/* Job Cards */}
            {jobs.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  No jobs found
                </h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  We couldn't find any positions matching your criteria. Try adjusting your filters.
                </p>
                <button
                  onClick={() => {
                    setFilters({ location: "", jobType: "", department: "", skills: "", salary: "", time: "", experience: "" });
                    setSearchQuery("");
                  }}
                  className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {currentJobs.map((job) => (
                  <Link key={job._id} href={`/job-details/${job._id}`} className="block">
                    <div className="bg-white border border-gray-200 rounded-xl p-6 hover:border-teal-500 hover:shadow-lg transition-all duration-200 group h-full flex flex-col">
                      <div className="flex items-start gap-4 mb-4">
                        {/* Company Logo */}
                        <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                          {job.companyName.charAt(0)}
                        </div>

                        {/* Save Button */}
                        <button className="ml-auto flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border-2 border-gray-200 text-gray-400 hover:border-teal-500 hover:text-teal-600 hover:bg-teal-50 transition-all">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                          </svg>
                        </button>
                      </div>

                      {/* Job Info */}
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900 group-hover:text-teal-600 transition-colors mb-1 line-clamp-2">
                          {job.jobTitle}
                        </h3>
                        <p className="text-sm text-gray-700 font-medium mb-3">
                          {job.companyName}
                        </p>

                        {/* Job Meta */}
                        <div className="space-y-2 text-sm text-gray-600 mb-4">
                          <div className="flex items-center gap-1.5">
                            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span className="truncate">{job.location}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="font-semibold text-teal-700">{formatSalary(job)}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>{formatPostedDate(job.createdAt)}</span>
                          </div>
                        </div>

                        {/* Tags */}
                        <div className="flex flex-wrap gap-2 items-center justify-between">
                          <div className="flex flex-wrap gap-2">
                            {job.jobType && (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                {job.jobType}
                              </span>
                            )}
                            {job.experience && (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-teal-50 text-teal-700">
                                {job.experience}
                              </span>
                            )}
                          </div>

                          {/* Right Arrow Icon */}
                          <div className="w-8 h-8 flex items-center justify-center rounded-full bg-teal-50 text-teal-600 group-hover:bg-teal-600 group-hover:text-white transition-all ml-auto">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-10">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>

                {getPageNumbers().map((page, index) => (
                  page === '...' ? (
                    <span key={`ellipsis-${index}`} className="px-2 text-gray-500">...</span>
                  ) : (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page as number)}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${currentPage === page
                          ? 'bg-teal-600 text-white'
                          : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                      {page}
                    </button>
                  )
                ))}

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default AllJobs;