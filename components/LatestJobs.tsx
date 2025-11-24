import React, { useEffect, useState } from "react";
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

type CategoryStat = {
    name: string;
    growth: string;
    icon: string;
};

interface LatestJobsSliderProps {
    className?: string;
}

const LatestJobsSlider: React.FC<LatestJobsSliderProps> = ({ className = "" }) => {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchLocation, setSearchLocation] = useState("");
    const [searchSalary, setSearchSalary] = useState("");
    const [sortBy, setSortBy] = useState("relevance");
    const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([]);

    const fetchLatestJobs = async () => {
        try {
            setLoading(true);
            const res = await axios.get<{ jobs: Job[] }>(
                `/api/job-postings/all?limit=50&sort=createdAt&order=desc`
            );
            const latestJobs = res.data.jobs || [];
            setJobs(latestJobs);
            setFilteredJobs(latestJobs.slice(0, 4));
        } catch (err) {
            // console.error("Error fetching latest jobs:", err);
            setJobs([]);
            setFilteredJobs([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchCategoryStats = async () => {
        try {
            const res = await axios.get<{ stats: CategoryStat[] }>(`/api/job-postings/category-stats`);
            setCategoryStats(res.data.stats || []);
        } catch (err) {
            // console.error("Error fetching category stats:", err);
            // Fallback to default stats if API fails
            ; setCategoryStats([
                { name: "Technology", growth: "+25%", icon: "💻" },
                { name: "Healthcare", growth: "+18%", icon: "🏥" },
                { name: "Finance", growth: "+12%", icon: "💰" },
                { name: "Education", growth: "+15%", icon: "🎓" }
            ])
        }
    };

    useEffect(() => {
        fetchLatestJobs();
        fetchCategoryStats();
    }, []);

    // Search and filter logic
    useEffect(() => {
        if (!searchQuery && !searchLocation && !searchSalary) {
            // No search - show 4 latest jobs
            let sorted = [...jobs];

            // Apply sorting
            if (sortBy === "date") {
                sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            } else if (sortBy === "salary") {
                sorted.sort((a, b) => {
                    const getSalaryValue = (job: Job) => {
                        if (!job.salary) return 0;
                        const salaryStr = job.salary.toString();
                        const numbers = salaryStr.match(/\d+/g);
                        return numbers ? parseInt(numbers[0]) : 0;
                    };
                    return getSalaryValue(b) - getSalaryValue(a);
                });
            }

            setFilteredJobs(sorted.slice(0, 4));
        } else {
            // Filter based on search criteria
            const filtered = jobs.filter((job) => {
                const matchesTitle = !searchQuery ||
                    (job.jobTitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        job.role?.toLowerCase().includes(searchQuery.toLowerCase()));

                const matchesLocation = !searchLocation ||
                    job.location?.toLowerCase().includes(searchLocation.toLowerCase());

                const matchesSalary = !searchSalary || checkSalaryMatch(job, searchSalary);

                return matchesTitle && matchesLocation && matchesSalary;
            });

            // Apply sorting to filtered results
            let sorted = [...filtered];
            if (sortBy === "date") {
                sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            } else if (sortBy === "salary") {
                sorted.sort((a, b) => {
                    const getSalaryValue = (job: Job) => {
                        if (!job.salary) return 0;
                        const salaryStr = job.salary.toString();
                        const numbers = salaryStr.match(/\d+/g);
                        return numbers ? parseInt(numbers[0]) : 0;
                    };
                    return getSalaryValue(b) - getSalaryValue(a);
                });
            }

            setFilteredJobs(sorted.slice(0, 4));
        }
    }, [searchQuery, searchLocation, searchSalary, jobs, sortBy]);

    const checkSalaryMatch = (job: Job, searchSalary: string) => {
        if (!job.salary) return false;

        const salaryStr = job.salary.toString();
        const searchNum = parseInt(searchSalary.replace(/[^\d]/g, ''));

        if (isNaN(searchNum)) return false;

        // Handle salary ranges
        const rangePattern = /(\d+)[\s]*[-,][\s]*(\d+)/;
        const match = salaryStr.match(rangePattern);

        if (match) {
            const minSalary = parseInt(match[1]);
            const maxSalary = parseInt(match[2]);
            return searchNum >= minSalary && searchNum <= maxSalary;
        } else {
            const jobSalary = parseInt(salaryStr.replace(/[^\d]/g, ''));
            return Math.abs(jobSalary - searchNum) <= 50000; // Within 50k range
        }
    };

    const formatPostedDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return "Today";
        if (diffDays === 1) return "Yesterday";
        if (diffDays < 7) return `${diffDays} days ago`;
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    };

    const formatSalary = (job: Job) => {
        if (job.salary) {
            const salaryStr = job.salary.toString();
            const rangePattern = /(\d+)[\s]*[-,][\s]*(\d+)/;
            const match = salaryStr.match(rangePattern);

            if (match) {
                const minSalary = parseInt(match[1]);
                const maxSalary = parseInt(match[2]);

                const formatNumber = (num: number) => {
                    return num >= 1000 ? `${(num / 1000).toFixed(0)}K` : num.toString();
                };

                return `${formatNumber(minSalary)}-${formatNumber(maxSalary)} AED`;
            } else {
                const salaryNum = parseInt(salaryStr.replace(/[^\d]/g, ''));
                if (salaryNum >= 1000) {
                    return `${(salaryNum / 1000).toFixed(0)}K AED`;
                }
                return `${salaryStr} AED`;
            }
        }
        return "Competitive";
    };

    const truncateText = (text: string, maxLength: number) => {
        if (!text) return "";
        return text.length <= maxLength ? text : text.substring(0, maxLength) + "...";
    };

    const handleClearSearch = () => {
        setSearchQuery("");
        setSearchLocation("");
        setSearchSalary("");
    };

    const hasActiveSearch = searchQuery || searchLocation || searchSalary;

    const getCategoryColor = (index: number) => {
        const colors = ['text-blue-600', 'text-green-600', 'text-purple-600', 'text-orange-600'];
        return colors[index % colors.length];
    };

    const getCategoryBgColor = (index: number) => {
        const colors = ['bg-blue-50', 'bg-green-50', 'bg-purple-50', 'bg-orange-50'];
        return colors[index % colors.length];
    };

    return (
        <div className={`w-full ${className}`}>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 lg:p-8">

                {/* Header */}
                <div className="flex flex-col gap-4 mb-6 sm:mb-8">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex-1">
                            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">
                                Latest Jobs
                            </h2>
                            <p className="text-gray-500 text-sm">Find your perfect job opportunity</p>
                        </div>
                        <Link
                            href="/job-listings"
                            className="inline-flex items-center justify-center px-4 sm:px-6 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-all duration-200 font-medium text-sm whitespace-nowrap"
                        >
                            <span>View All Jobs</span>
                        </Link>
                    </div>

                    {/* Search Section */}
                    <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            {/* Job Title Search */}
                            <div className="relative">
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Search jobs, companies, or skills..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="text-gray-700 w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-sm"
                                    />
                                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                            </div>

                            {/* Salary Search */}
                            <div className="relative">
                                <select
                                    value={searchSalary}
                                    onChange={(e) => setSearchSalary(e.target.value)}
                                    className="text-gray-700 w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-sm appearance-none cursor-pointer"
                                >
                                    <option value="">Salary Range</option>
                                    <option value="50000">50K+ AED</option>
                                    <option value="100000">100K+ AED</option>
                                    <option value="150000">150K+ AED</option>
                                </select>
                                <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>

                            {/* Location Search */}
                            <div className="relative">
                                <select
                                    value={searchLocation}
                                    onChange={(e) => setSearchLocation(e.target.value)}
                                    className="text-gray-700 w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-sm appearance-none cursor-pointer"
                                >
                                    <option value="">Remote</option>
                                    <option value="Dubai">Dubai</option>
                                    <option value="Abu Dhabi">Abu Dhabi</option>
                                    <option value="Remote">Remote Only</option>
                                </select>
                                <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>

                        {/* Results count */}
                        {hasActiveSearch && (
                            <div className="mt-3 text-sm text-gray-600">
                                Showing {filteredJobs.length} job{filteredJobs.length !== 1 ? 's' : ''}
                            </div>
                        )}
                    </div>
                </div>

                {/* Loading State */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="animate-pulse">
                                <div className="bg-gray-50 rounded-lg border border-gray-200 p-5">
                                    <div className="bg-gray-200 h-5 rounded mb-3 w-3/4"></div>
                                    <div className="bg-gray-200 h-4 rounded mb-2 w-1/2"></div>
                                    <div className="bg-gray-200 h-4 rounded w-2/3 mb-4"></div>
                                    <div className="bg-gray-200 h-3 rounded w-1/2"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : filteredJobs.length === 0 ? (
                    <div className="text-center py-12 sm:py-16">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No jobs found</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            {hasActiveSearch
                                ? "Try adjusting your search criteria"
                                : "New opportunities will appear here soon"}
                        </p>
                        {hasActiveSearch && (
                            <button
                                onClick={handleClearSearch}
                                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium text-sm"
                            >
                                Clear Search
                            </button>
                        )}
                    </div>
                ) : (
                    /* Job Cards Grid */
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                        {filteredJobs.map((job) => (
                            <Link
                                key={job._id}
                                href={`/job-details/${job._id}`}
                                className="group"
                            >
                                <div className="bg-gray-50 rounded-lg border border-gray-200 p-5 hover:shadow-md hover:border-gray-300 transition-all duration-200 h-full flex flex-col">

                                    {/* Job Header */}
                                    <div className="flex items-start justify-between mb-4 gap-3">
                                        <div className="flex items-start gap-3 flex-1 min-w-0">
                                            {/* Company Avatar */}
                                            <div className="w-12 h-12 bg-white rounded-lg border border-gray-200 flex items-center justify-center flex-shrink-0">
                                                <span className="text-lg font-bold text-gray-400">
                                                    {job.companyName.charAt(0).toUpperCase()}
                                                </span>
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-bold text-gray-900 text-base mb-1 break-words group-hover:text-blue-600 transition-colors">
                                                    {truncateText(job.jobTitle || job.role, 50)}
                                                </h3>
                                                <p className="text-gray-600 text-sm break-words">
                                                    {truncateText(job.companyName, 35)}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Featured Badge */}
                                        {new Date().getTime() - new Date(job.createdAt).getTime() < 24 * 60 * 60 * 1000 && (
                                            <span className="flex-shrink-0 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded">
                                                Featured
                                            </span>
                                        )}

                                        {/* Bookmark Icon */}
                                        <button className="flex-shrink-0 w-8 h-8 flex items-center justify-center hover:bg-gray-200 rounded transition-colors">
                                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                                            </svg>
                                        </button>
                                    </div>

                                    {/* Details */}
                                    <div className="space-y-2 mb-4">
                                        <div className="flex items-center text-sm text-gray-600">
                                            <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                            </svg>
                                            {job.location}
                                            {job.jobType && (
                                                <>
                                                    <span className="mx-2 text-gray-300">|</span>
                                                    <span className="px-2 py-0.5 bg-green-50 text-green-700 text-xs font-medium rounded border border-green-200">
                                                        {job.jobType}
                                                    </span>
                                                </>
                                            )}
                                        </div>

                                        <div className="flex items-center text-sm text-gray-600">
                                            <span className="mr-2 ml-1">د.إ</span>
                                            {formatSalary(job)}
                                        </div>

                                    </div>

                                    {/* Footer */}
                                    <div className="flex items-center justify-between pt-3 border-t border-gray-200 mt-auto">
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center text-xs text-gray-500">
                                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                {formatPostedDate(job.createdAt)}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4">

                                            <button className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors">
                                                Apply Now
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}

                {/* Category Stats Footer
                {!loading && categoryStats.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-gray-200">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {categoryStats.map((stat, index) => (
                                <div key={index} className="text-center">
                                    <div className={`w-16 h-16 mx-auto mb-3 ${getCategoryBgColor(index)} rounded-lg flex items-center justify-center`}>
                                        <svg className={`w-8 h-8 ${getCategoryColor(index)}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                        </svg>
                                    </div>
                                    <h3 className="font-semibold text-gray-900 text-sm mb-1">{stat.name}</h3>
                                    <div className="flex items-center justify-center gap-1">
                                        <svg className={`w-3 h-3 ${getCategoryColor(index)}`} fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M12 7a1 1 0 011 1v4a1 1 0 11-2 0V8a1 1 0 011-1zM5.293 9.293a1 1 0 011.414 0L10 12.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                        <span className={`text-sm font-semibold ${getCategoryColor(index)}`}>{stat.growth}</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">Job growth this year</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )} */}
            </div>
        </div>
    );
};

export default LatestJobsSlider;