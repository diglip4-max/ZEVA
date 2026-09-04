import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Reusable Date Filter component for Smart Offers dashboard.
 * Shows "Today" button that opens a calendar for custom date selection.
 * 
 * @param {Object} props
 * @param {string} props.selected - Currently selected date (ISO string or 'Today')
 * @param {function} props.onChange - Callback when date changes, receives the selected value
 * @param {string} [props.className] - Additional CSS classes for the container
 */
const DateFilter = ({ selected, onChange, className = '' }) => {
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const calendarRef = useRef(null);

  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target)) {
        setShowCalendar(false);
      }
    };

    if (showCalendar) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showCalendar]);

  // Handle Today button click
  const handleTodayClick = () => {
    setShowCalendar(!showCalendar);
  };

  // Handle date selection from calendar
  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setShowCalendar(false);
    // Format date as ISO string for the API
    const dateStr = date.toISOString();
    onChange(dateStr);
  };

  // Navigate months
  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  // Get days in month
  const getDaysInMonth = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];

    // Add empty slots for days before first day of month
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }

    // Add days of the month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  // Check if date is today
  const isToday = (date) => {
    if (!date) return false;
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  // Check if date is selected
  const isSelected = (date) => {
    if (!date) return false;
    return date.getDate() === selectedDate.getDate() &&
           date.getMonth() === selectedDate.getMonth() &&
           date.getFullYear() === selectedDate.getFullYear();
  };

  // Check if date is in the future
  const isFuture = (date) => {
    if (!date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date > today;
  };

  const days = getDaysInMonth();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  // Format display text for the button
  const getDisplayText = () => {
    if (selected && selected !== 'Today' && !['7 Days', '30 Days', '90 Days'].includes(selected)) {
      try {
        const date = new Date(selected);
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
      } catch (e) {
        // Fall through to default
      }
    }
    return 'Today';
  };

  return (
    <div className={`relative flex items-center ${className}`} ref={calendarRef}>
      <button
        onClick={handleTodayClick}
        className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-colors border ${
          showCalendar || (selected && selected !== 'Today' && !['7 Days', '30 Days', '90 Days'].includes(selected))
            ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
            : 'bg-gray-100/50 text-gray-700 border-gray-200/60 hover:bg-gray-100'
        }`}
      >
        <Calendar className="w-3.5 h-3.5" />
        {getDisplayText()}
      </button>

      {/* Calendar Popup */}
      {showCalendar && (
        <div className="absolute top-full mt-2 right-0 bg-white rounded-xl shadow-lg border border-gray-200 p-4 z-50 w-72">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={prevMonth}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <span className="text-sm font-semibold text-gray-900">
              {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </span>
            <button
              onClick={nextMonth}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayNames.map((day) => (
              <div key={day} className="text-center text-xs font-medium text-gray-400 py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((date, idx) => (
              <div key={idx} className="aspect-square">
                {date ? (
                  <button
                    onClick={() => !isFuture(date) && handleDateSelect(date)}
                    disabled={isFuture(date)}
                    className={`w-full h-full rounded-lg text-xs font-medium transition-colors ${
                      isSelected(date)
                        ? 'bg-gray-900 text-white'
                        : isToday(date)
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : isFuture(date)
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {date.getDate()}
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
            <button
              onClick={() => {
                const today = new Date();
                setSelectedDate(today);
                handleDateSelect(today);
              }}
              className="flex-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg py-2 transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => setShowCalendar(false)}
              className="flex-1 text-xs font-medium text-gray-500 hover:text-gray-700 rounded-lg py-2 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateFilter;
