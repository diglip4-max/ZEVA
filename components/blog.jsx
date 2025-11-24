import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";

export default function BlogList() {
  const [blogs, setBlogs] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showArrows, setShowArrows] = useState(false);
  const sliderRef = useRef(null);

  const extractFirstImageFromContent = (htmlContent) => {
    const imgRegex = /<img[^>]+src="([^">]+)"/i;
    const match = htmlContent.match(imgRegex);
    return match ? match[1] : null;
  };

  const getDisplayImage = (blog) => {
    if (blog.image) return { src: blog.image, isPlaceholder: false };
    const contentImage = extractFirstImageFromContent(blog.content);
    if (contentImage) return { src: contentImage, isPlaceholder: false };
    return { src: "", isPlaceholder: true };
  };

  const limitContentToWords = (htmlContent, wordLimit = 20) => {
    const textContent = htmlContent.replace(/<[^>]*>/g, '');
    const words = textContent.trim().split(/\s+/);
    const limitedWords = words.slice(0, wordLimit);
    return limitedWords.join(' ') + (words.length > wordLimit ? '...' : '');
  };

  const checkIfArrowsNeeded = () => {
    if (sliderRef.current) {
      const hasOverflow = sliderRef.current.scrollWidth > sliderRef.current.clientWidth;
      setShowArrows(hasOverflow);
    }
  };

  const slideLeft = () => {
    if (sliderRef.current) {
      const slideWidth = sliderRef.current.clientWidth;
      sliderRef.current.scrollBy({ left: -slideWidth, behavior: "smooth" });
      setCurrentSlide(prev => Math.max(0, prev - 1));
    }
  };

  const slideRight = () => {
    if (sliderRef.current) {
      const slideWidth = sliderRef.current.clientWidth;
      const maxScroll = sliderRef.current.scrollWidth - sliderRef.current.clientWidth;
      
      if (sliderRef.current.scrollLeft >= maxScroll - 10) {
        sliderRef.current.scrollTo({ left: 0, behavior: "smooth" });
        setCurrentSlide(0);
      } else {
        sliderRef.current.scrollBy({ left: slideWidth, behavior: "smooth" });
        setCurrentSlide(prev => Math.min(blogs.length - 1, prev + 1));
      }
    }
  };

  useEffect(() => {
    async function fetchBlogs() {
      try {
        const res = await fetch("/api/blog/getAllBlogs");
        const json = await res.json();
        if (res.ok && json.success) {
          const allBlogs = json.blogs || json.data;
          const sortedBlogs = allBlogs.sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          setBlogs(sortedBlogs.slice(0, 6));
        } else {
          setError(json.error || "Failed to fetch blogs");
        }
      } catch {
        setError("Network error");
      } finally {
        setIsLoading(false);
      }
    }
    fetchBlogs();
  }, []);

  useEffect(() => {
    checkIfArrowsNeeded();
    window.addEventListener('resize', checkIfArrowsNeeded);
    return () => window.removeEventListener('resize', checkIfArrowsNeeded);
  }, [blogs]);

  if (error) {
    return (
      <div className="w-full max-w-7xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600 text-sm">Unable to load blogs. Please try again later.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"></div>
          <div className="h-10 bg-gray-200 rounded w-32 animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-100 rounded-lg h-80 animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!blogs.length) {
    return (
      <div className="w-full max-w-7xl mx-auto px-4 py-12">
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-600">No blogs available at the moment.</p>
        </div>
      </div>
    );
  }

return (
  <div className="w-full py-20" style={{ backgroundColor: '#f7f6ff' }}>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header Section */}
      <div className="text-center mb-16">
        <h2 className="text-4xl sm:text-5xl font-bold mb-8">
          <span style={{ color: '#9810fa' }}>Health Blogs</span>
          <span className="text-slate-700"> & Articles</span>
        </h2>
      </div>

      {/* Slider Container */}
      <div className="relative">
        {showArrows && (
          <>
            <button
              onClick={slideLeft}
              className="absolute -left-4 top-1/2 -translate-y-1/2 z-20 bg-white hover:bg-gray-100 shadow-lg rounded-full p-3 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
              disabled={currentSlide === 0}
            >
              <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <button
              onClick={slideRight}
              className="absolute -right-4 top-1/2 -translate-y-1/2 z-20 bg-white hover:bg-gray-100 shadow-lg rounded-full p-3 transition-all duration-200"
            >
              <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}

        <div
          ref={sliderRef}
          className="overflow-x-auto scrollbar-hide scroll-smooth"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <div className="flex gap-6 pb-4" style={{ width: 'max-content' }}>
            {blogs.map((blog) => {
              const imageInfo = getDisplayImage(blog);
              
              return (
                <Link key={blog._id} href={`/blogs/${blog._id}`}>
                  <div className="w-[420px] group cursor-pointer">
                    <article className="bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 h-full flex flex-col p-6">
                      {/* Image Container - Smaller and Contained */}
                      <div className="relative h-44 overflow-hidden rounded-xl bg-gray-50 mb-5">
                        {imageInfo.isPlaceholder ? (
                          <div className="w-full h-full bg-gradient-to-br from-cyan-50 to-cyan-100 flex items-center justify-center">
                            <div className="text-center">
                              <svg className="w-16 h-16 text-cyan-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <p className="text-cyan-400 text-sm font-medium">No image</p>
                            </div>
                          </div>
                        ) : (
                          <img
                            src={imageInfo.src}
                            alt={blog.title}
                            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                          />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex flex-col flex-1">
                        {/* Title */}
                        <h3 className="text-lg font-semibold text-slate-700 mb-3 line-clamp-2 leading-snug group-hover:text-slate-900 transition-colors min-h-[48px]">
                          {blog.title}
                        </h3>
                      </div>
                    </article>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Dot Indicators */}
        {showArrows && blogs.length > 1 && (
          <div className="flex justify-center mt-12 gap-3">
            {blogs.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  setCurrentSlide(index);
                  if (sliderRef.current) {
                    const cardWidth = 420 + 24;
                    sliderRef.current.scrollTo({
                      left: index * cardWidth,
                      behavior: 'smooth'
                    });
                  }
                }}
                className={`rounded-full transition-all duration-300 ${
                  index === currentSlide
                    ? 'w-3 h-3'
                    : 'bg-gray-300 w-2.5 h-2.5 hover:bg-gray-400'
                }`}
                style={index === currentSlide ? { backgroundColor: '#9810fa' } : {}}
              />
            ))}
          </div>
        )}
      </div>

      {/* View All Button */}
      {blogs.length > 0 && (
        <div className="text-center mt-12">
          <Link href="/blogs/viewBlogs">
            <button className="inline-flex items-center gap-2 text-white font-semibold px-8 py-3 rounded-lg transition-all group shadow-md hover:shadow-lg" style={{ backgroundColor: '#9810fa' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#7a0dcc'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#9810fa'}>
              <span>View All Blogs</span>
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
          </Link>
        </div>
      )}
    </div>

    <style jsx>{`
      .scrollbar-hide::-webkit-scrollbar {
        display: none;
      }
    `}</style>
  </div>
);
}