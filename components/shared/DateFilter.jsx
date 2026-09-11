import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

const QUICK_PERIODS = ['Today'];

/**
 * Reusable Date Filter component for Smart Offers dashboard.
 * Shows quick period buttons (Today / 7 Days / 30 Days / This Month)
 * plus a calendar for custom single-date selection.
 *
 * @param {Object} props
 * @param {string} props.selected - 'Today' | '7 Days' | '30 Days' | 'This Month' | ISO date string
 * @param {function} props.onChange - Callback when date changes, receives the selected value
 * @param {string} [props.className] - Additional CSS classes for the container
 */
const DateFilter = ({ selected, onChange, className = '' }) => {
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const calendarRef = useRef(null);

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

  const handleQuickSelect = (period) => {
    setShowCalendar(false);
    onChange(period);
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setShowCalendar(false);
    const dateStr = date.toISOString();
    onChange(dateStr);
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const getDaysInMonth = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];

    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const isToday = (date) => {
    if (!date) return false;
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  const isSelected = (date) => {
    if (!date) return false;
    return date.getDate() === selectedDate.getDate() &&
           date.getMonth() === selectedDate.getMonth() &&
           date.getFullYear() === selectedDate.getFullYear();
  };

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

  const getDisplayText = () => {
    if (!selected) return 'Today';
    if (QUICK_PERIODS.includes(selected)) return selected;
    try {
      const date = new Date(selected);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    } catch (e) {
      // Fall through to default
    }
    return 'Today';
  };

  const isQuick = (p) => selected === p;
  const isCustom = selected && !QUICK_PERIODS.includes(selected);

  return (
    <div className={`relative flex items-center gap-1.5 ${className}`} ref={calendarRef}>
      {/* Quick period buttons */}
      <div className="flex items-center gap-1">
        {QUICK_PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => handleQuickSelect(p)}
            className={`text-[11px] font-medium px-2.5 py-1.5 rounded-full border transition-colors ${
              isQuick(p)
                ? 'bg-gray-900 dark:bg-indigo-600 text-white border-gray-900 dark:border-indigo-600 shadow-sm'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Custom calendar picker */}
      <div className="relative">
        <button
          onClick={() => setShowCalendar(!showCalendar)}
          className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-full transition-colors border ${
            showCalendar || isCustom
              ? 'bg-gray-900 dark:bg-indigo-600 text-white border-gray-900 dark:border-indigo-600 shadow-sm'
              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          {isCustom ? getDisplayText() : 'Custom'}
        </button>

        {/* Calendar Popup */}
        {showCalendar && (
          <div className="absolute top-full mt-2 right-0 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 z-50 w-72">
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={prevMonth}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-300" />
              </button>
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </span>
              <button
                onClick={nextMonth}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-300" />
              </button>
            </div>

            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {dayNames.map((day) => (
                <div key={day} className="text-center text-xs font-medium text-gray-400 dark:text-gray-500 py-1">
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
                          ? 'bg-gray-900 dark:bg-indigo-600 text-white'
                          : isToday(date)
                          ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50'
                          : isFuture(date)
                          ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      {date.getDate()}
                    </button>
                  ) : null}
                </div>
              ))}
            </div>

            {/* Quick Actions */}
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex gap-2">
              <button
                onClick={() => {
                  const today = new Date();
                  setSelectedDate(today);
                  handleDateSelect(today);
                }}
                className="flex-1 text-xs font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg py-2 transition-colors"
              >
                Today
              </button>
              <button
                onClick={() => setShowCalendar(false)}
                className="flex-1 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg py-2 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DateFilter;
