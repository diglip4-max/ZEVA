// // components/DoctorDesktime.jsx
// 'use client';
// import React, { useEffect, useRef, useState } from 'react';
// import axios from 'axios';
// import * as d3 from 'd3';
// import {
//   Clock,
//   LogIn,
//   LogOut,
//   Calendar,
//   TrendingUp,
//   Zap,
//   Briefcase,
//   PieChart,
//   ChevronLeft,
//   ChevronRight,
//   Activity,
//   MousePointer,
//   Monitor
// } from 'lucide-react';
// import { Toaster, toast } from 'react-hot-toast';

// /*helper functions */
// const formatTime = (sec = 0) => {
//   const h = Math.floor(sec / 3600);
//   const m = Math.floor((sec % 3600) / 60);
//   const s = sec % 60;

//   if (h > 0) {
//     return `${h}h ${m}m`;
//   }
//   if (m > 0) {
//     return `${m}m ${s}s`;
//   }
//   return `${s}s`;
// };

// const formatTimeDetailed = (sec = 0) => {
//   const h = Math.floor(sec / 3600);
//   const m = Math.floor((sec % 3600) / 60);
//   const s = sec % 60;
//   return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
// };

// const productivityColor = (p) => {
//   if (p >= 80) return 'bg-green-500';
//   if (p >= 50) return 'bg-yellow-500';
//   return 'bg-red-500';
// };

// const productivityTextColor = (p) => {
//   if (p >= 80) return 'text-green-400';
//   if (p >= 50) return 'text-yellow-400';
//   return 'text-red-400';
// };

// /* StatCard Component */
// const StatCard = ({ title, value, icon, color, fullWidth = false, tooltip }) => {
//   const colorClasses = {
//     blue: 'border-l-blue-500',
//     green: 'border-l-green-500',
//     purple: 'border-l-purple-500',
//     yellow: 'border-l-yellow-500',
//     indigo: 'border-l-indigo-500',
//     gray: 'border-l-gray-500',
//     orange: 'border-l-orange-500',
//   };

//   return (
//     <div className={`bg-gray-800 rounded-xl p-6 border-l-4 ${colorClasses[color]} ${fullWidth ? 'lg:col-span-2' : ''} relative group`}>
//       <div className="flex justify-between items-start">
//         <div>
//           <p className="text-gray-400 text-sm">{title}</p>
//           <p className="text-2xl font-bold mt-2">{value}</p>
//         </div>
//         <div className="p-2 bg-gray-700 rounded-lg">
//           {icon}
//         </div>
//       </div>
//       {tooltip && (
//         <div className="absolute top-0 right-0 mt-10 mr-4 px-2 py-1 bg-gray-900 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
//           {tooltip}
//         </div>
//       )}
//     </div>
//   );
// };

// /* HourlyProductivityChart Component */
// const HourlyProductivityChart = ({ hourlyData }) => {
//   const ref = useRef(null);

//   const formatTimeAMPM = (hour) => {
//     const ampm = hour >= 12 ? 'PM' : 'AM';
//     const adjustedHour = hour % 12 === 0 ? 12 : hour % 12;
//     return `${adjustedHour}:00 ${ampm}`;
//   }

//   const formatTooltipTime = (hour, minute) => {
//     const ampm = hour >= 12 ? 'PM' : 'AM';
//     const h = hour % 12 === 0 ? 12 : hour % 12;
//     return `${h}:${minute.toString().padStart(2, '0')} ${ampm}`;
//   };

//   useEffect(() => {
//     if (!hourlyData?.length) return;

//     const BUCKET = 600; // 5 minutes
//     const buckets = [];

//     const START_HOUR = 8;   // 08:00 AM
//     const END_HOUR = 21;    // 09:00 PM

//     // Flatten into 5-min buckets
//     hourlyData
//       .filter(h => h.hour >= START_HOUR && h.hour < END_HOUR)
//       .forEach(hour => {
//         const base = (hour.hour - START_HOUR) * 12;
//         const desk = hour.deskTime || 0;
//         const prod = hour.productiveTime || 0;
//         const idle = hour.idleTime || 0;

//         const nonProdDesk = Math.max(0, desk - prod);
//         for (let i = 0; i < 6; i++) {
//           buckets.push({
//             index: base + i,
//             productive: prod / 6,
//             nonProdDesk: nonProdDesk / 6,
//             idle: idle / 6,
//             hour: hour.hour,
//             subIndex: i
//           });
//         }
//       });

//     const width = ref.current.clientWidth;
//     const height = 350;

//     d3.select(ref.current).selectAll('*').remove();

//     const svg = d3.select(ref.current)
//       .append('svg')
//       .attr('width', width)
//       .attr('height', height);

//     // Scale for the 5-min slots
//     const x = d3.scaleBand()
//       .domain(buckets.map(d => d.index))
//       .range([50, width - 30])
//       .paddingInner(0.6)
//       .paddingOuter(0.2);

//     const subX = d3.scaleBand()
//       .domain([0, 1, 2])
//       .range([0, x.bandwidth()])
//       .padding(0.1);

//     const y = d3.scaleLinear()
//       .domain([0, BUCKET])
//       .range([height - 60, 40]);

//     // Create group for each 5-min bucket
//     const groups = svg.selectAll('g.bucket')
//       .data(buckets)
//       .enter()
//       .append('g')
//       .attr('class', 'bucket')
//       .attr('transform', d => `translate(${x(d.index)},0)`);

//     // Productive - left bar (green)
//     groups.append('rect')
//       .attr('x', subX(0))
//       .attr('y', d => y(d.productive))
//       .attr('width', subX.bandwidth())
//       .attr('height', d => height - 60 - y(d.productive))
//       .attr('fill', '#22c55e')
//       .attr('rx', 2);

//     // Non-productive DeskTime - middle bar (blue)
//     groups.append('rect')
//       .attr('x', subX(1))
//       .attr('y', d => y(d.nonProdDesk))
//       .attr('width', subX.bandwidth())
//       .attr('height', d => height - 60 - y(d.nonProdDesk))
//       .attr('fill', '#3b82f6')
//       .attr('rx', 2);

//     // Idle - right bar (gray)
//     groups.append('rect')
//       .attr('x', subX(2))
//       .attr('y', d => y(d.idle))
//       .attr('width', subX.bandwidth())
//       .attr('height', d => height - 60 - y(d.idle))
//       .attr('fill', '#6b7280')
//       .attr('rx', 2);

//     // Tooltip
//     const tooltip = d3.select("body")
//       .append("div")
//       .style("position", "absolute")
//       .style("visibility", "hidden")
//       .style("background", "rgba(0,0,0,0.9)")
//       .style("color", "white")
//       .style("padding", "8px 12px")
//       .style("border-radius", "6px")
//       .style("font-size", "13px")
//       .style("pointer-events", "none")
//       .style("z-index", "10000");

//     groups.on("mouseover", function (event, d) {
//       const startMin = d.subIndex * 5;
//       const endMin = startMin + 5;
//       const timeRange = `${formatTooltipTime(d.hour, startMin)} – ${formatTooltipTime(d.hour, endMin)}`;

//       tooltip
//         .style("visibility", "visible")
//         .html(`
//           ${timeRange}<br>
//           <span style="color:#22c55e">Productive: ${formatTime(Math.round(d.productive))}</span><br>
//           <span style="color:#3b82f6">DeskTime (non-prod): ${formatTime(Math.round(d.nonProdDesk))}</span><br>
//           <span style="color:#6b7280">Idle: ${formatTime(Math.round(d.idle))}</span>
//         `)
//         .style("left", (event.pageX + 15) + "px")
//         .style("top", (event.pageY - 10) + "px");
//     })
//       .on("mousemove", function (event) {
//         tooltip.style("left", (event.pageX + 15) + "px")
//           .style("top", (event.pageY - 10) + "px");
//       })
//       .on("mouseout", () => tooltip.style("visibility", "hidden"));

//     // X-axis labels
//     for (let h = START_HOUR; h < END_HOUR; h += 1) {
//       svg.append('text')
//         .attr('x', x((h - START_HOUR) * 12) + x.bandwidth() / 2)
//         .attr('y', height - 24)
//         .attr('text-anchor', 'middle')
//         .attr('font-size', '11px')
//         .attr('fill', '#9ca3af')
//         .text(formatTimeAMPM(h));
//     }

//     // Y-axis labels
//     svg.append('text')
//       .attr('x', 10)
//       .attr('y', 30)
//       .attr('font-size', '11px')
//       .attr('fill', '#9ca3af')
//       .text('100%');

//     svg.append('text')
//       .attr('x', 50)
//       .attr('y', height - 65)
//       .attr('font-size', '11px')
//       .attr('fill', '#9ca3af')
//       .text('0%');

//   }, [hourlyData]);

//   return (
//     <div className="w-full">
//       <div className="flex justify-between text-sm text-gray-400 mb-3 px-2">
//         <div className="flex items-center gap-2">
//           <div className="w-3 h-3 bg-green-500 rounded"></div>
//           <span>Productive</span>
//         </div>
//         <div className="flex items-center gap-2">
//           <div className="w-3 h-3 bg-blue-500 rounded"></div>
//           <span>DeskTime</span>
//         </div>
//         <div className="flex items-center gap-2">
//           <div className="w-3 h-3 bg-gray-500 rounded"></div>
//           <span>Idle</span>
//         </div>
//       </div>
//       <div
//         ref={ref}
//         className="w-full rounded bg-gray-900 overflow-hidden"
//         style={{ minHeight: '280px' }}
//       />
//     </div>
//   );
// };

// /* Main Doctor Dashboard Component */
// const DoctorDesktime = () => {
//   const [viewMode, setViewMode] = useState('daily');
//   const [weekOffset, setWeekOffset] = useState(0);
//   const [monthOffset, setMonthOffset] = useState(0);

//   const [session, setSession] = useState({
//     arrivalTime: null,
//     leftTime: null,
//     deskTime: 0,
//     productiveTime: 0,
//     timeAtWork: 0,
//     productivity: 0,
//     effectiveness: 0,
//     hasSignificantBreak: false,
//     nextArrivalAfterBreak: null
//   });

//   const [weeklyStats, setWeeklyStats] = useState({
//     totalDeskTime: 0,
//     totalProductiveTime: 0,
//     avgProductivity: 0,
//     totalSessions: 0,
//     days: [],
//     weekStart: new Date(),
//     weekEnd: new Date()
//   });

//   const [monthlyStats, setMonthlyStats] = useState({
//     totalDeskTime: 0,
//     totalProductiveTime: 0,
//     avgProductivity: 0,
//     totalDays: 0,
//     weeks: [],
//     monthStart: new Date(),
//     monthEnd: new Date(),
//     monthName: ''
//   });

//   const [hourlyData, setHourlyData] = useState({
//     hourlyStats: [],
//     totalDeskTime: 0,
//     totalProductiveTime: 0,
//     totalIdleTime: 0,
//     date: new Date()
//   });

//   const token = typeof window !== 'undefined' ? localStorage.getItem('userToken') : null;

//   // Load data functions (ONLY data loading, no activity tracking)
//   const loadHourlyData = async (date = new Date()) => {
//     try {
//       const formattedDate = date.toISOString().split('T')[0];
//       const res = await axios.get(`/api/doctor/work-session/hourly?date=${formattedDate}`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });

//       if (res.data?.success) {
//         setHourlyData(res.data.data);
//       } else {
//         const emptyHourlyStats = Array.from({ length: 24 }, (_, hour) => ({
//           hour,
//           deskTime: 0,
//           productiveTime: 0,
//           idleTime: 0,
//           productivity: 0
//         }));
//         setHourlyData({
//           hourlyStats: emptyHourlyStats,
//           totalDeskTime: 0,
//           totalProductiveTime: 0,
//           totalIdleTime: 0,
//           date: date
//         });
//       }
//     } catch (e) {
//       console.error('Load hourly data error:', e);
//       const emptyHourlyStats = Array.from({ length: 24 }, (_, hour) => ({
//         hour,
//         deskTime: 0,
//         productiveTime: 0,
//         idleTime: 0,
//         productivity: 0
//       }));
//       setHourlyData({
//         hourlyStats: emptyHourlyStats,
//         totalDeskTime: 0,
//         totalProductiveTime: 0,
//         totalIdleTime: 0,
//         date: date
//       });
//     }
//   };

//   const loadSession = async () => {
//     try {
//       const res = await axios.get('/api/doctor/work-session/today', {
//         headers: { Authorization: `Bearer ${token}` },
//       });

//       if (res.data?.success && res.data.data) {
//         const data = res.data.data;

//         let hasSignificantBreak = false;
//         let nextArrivalAfterBreak = null;
//         let displayLeftTime = 'ONLINE';

//         if (data.leftTime) {
//           const leftTime = new Date(data.leftTime);
//           const nextArrival = data.nextArrivalTime ? new Date(data.nextArrivalTime) : null;

//           if (nextArrival) {
//             const breakDuration = (nextArrival.getTime() - leftTime.getTime()) / (1000 * 60 * 60);

//             if (breakDuration >= 5) {
//               hasSignificantBreak = true;
//               nextArrivalAfterBreak = nextArrival.toLocaleTimeString([], {
//                 hour: '2-digit',
//                 minute: '2-digit'
//               });
//               displayLeftTime = leftTime.toLocaleTimeString([], {
//                 hour: '2-digit',
//                 minute: '2-digit'
//               });
//             } else {
//               displayLeftTime = 'ONLINE';
//             }
//           } else {
//             displayLeftTime = leftTime.toLocaleTimeString([], {
//               hour: '2-digit',
//               minute: '2-digit'
//             });
//           }
//         }

//         const deskTime = data.deskTimeSeconds || 0;
//         const productiveTime = data.productiveSeconds || 0;
//         const timeAtWork = data.timeAtWorkSeconds || 0;

//         const effectiveness = timeAtWork > 0
//           ? Math.min(100, (productiveTime / timeAtWork) * 100)
//           : 0;

//         const workDayHours = 8 * 3600;
//         const productivity = workDayHours > 0
//           ? Math.min(100, (productiveTime / workDayHours) * 100)
//           : 0;

//         setSession({
//           arrivalTime: data.arrivalTime
//             ? new Date(data.arrivalTime).toLocaleTimeString([], {
//               hour: '2-digit',
//               minute: '2-digit'
//             })
//             : null,
//           leftTime: displayLeftTime,
//           deskTime: deskTime,
//           productiveTime: productiveTime,
//           timeAtWork: timeAtWork,
//           productivity: productivity,
//           effectiveness: effectiveness,
//           hasSignificantBreak: hasSignificantBreak,
//           nextArrivalAfterBreak: nextArrivalAfterBreak
//         });
//       } else if (res.data?.message === 'No session found for today') {
//         setSession({
//           arrivalTime: null,
//           leftTime: null,
//           deskTime: 0,
//           productiveTime: 0,
//           timeAtWork: 0,
//           productivity: 0,
//           effectiveness: 0,
//           hasSignificantBreak: false,
//           nextArrivalAfterBreak: null
//         });
//       }
//     } catch (e) {
//       console.error('Load session error:', e);
//       toast.error('Failed to load desk time data');
//     }
//   };

//   const loadWeeklyStats = async (offset = 0) => {
//     if (!token) return;

//     try {
//       const res = await axios.get(`/api/doctor/work-session/weekly?offset=${offset}`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });

//       if (res.data?.success) {
//         setWeeklyStats(res.data.data);
//       }
//     } catch (e) {
//       console.error('Load weekly stats error:', e);
//       toast.error('Failed to load weekly stats');
//     }
//   };

//   const loadMonthlyStats = async (offset = 0) => {
//     if (!token) return;

//     try {
//       const res = await axios.get(`/api/doctor/work-session/monthly?offset=${offset}`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });

//       if (res.data?.success) {
//         setMonthlyStats(res.data.data);
//       }
//     } catch (e) {
//       console.error('Load monthly stats error:', e);
//       toast.error('Failed to load monthly stats');
//     }
//   };

//   // Initial data load
//   useEffect(() => {
//     loadSession();
//     loadHourlyData();
//     loadWeeklyStats(weekOffset);
//     loadMonthlyStats(monthOffset);

//     const t = setInterval(() => {
//       loadSession();
//       if (viewMode === 'daily') {
//         loadHourlyData();
//       }
//     }, 30000);

//     return () => clearInterval(t);
//   }, [weekOffset, monthOffset, viewMode, token]);

//   // View handlers
//   const handleViewChange = (mode) => {
//     setViewMode(mode);
//   };

//   const handlePreviousWeek = () => {
//     setWeekOffset(prev => prev - 1);
//   };

//   const handleNextWeek = () => {
//     setWeekOffset(prev => prev + 1);
//   };

//   const handlePreviousMonth = () => {
//     setMonthOffset(prev => prev - 1);
//   };

//   const handleNextMonth = () => {
//     setMonthOffset(prev => prev + 1);
//   };

//   const getCurrentDateRange = () => {
//     const now = new Date();
//     switch (viewMode) {
//       case 'daily':
//         return `Today, ${now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
//       case 'weekly':
//         const weekStart = new Date(weeklyStats.weekStart);
//         const weekEnd = new Date(weeklyStats.weekEnd);
//         return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
//       case 'monthly':
//         return monthlyStats.monthName || now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
//       default:
//         return '';
//     }
//   };

//   const getWeeklyAverageTime = () => {
//     const sessionsCount = weeklyStats.days.filter(day => day.hasSession).length;
//     if (sessionsCount === 0) return 0;
//     return Math.round(weeklyStats.totalDeskTime / sessionsCount);
//   };

//   const getMonthlyAverageTime = () => {
//     const daysCount = monthlyStats.totalDays;
//     if (daysCount === 0) return 0;
//     return Math.round(monthlyStats.totalDeskTime / daysCount);
//   };

//   const calculateHourlyProductivity = () => {
//     return hourlyData.hourlyStats.map(hour => ({
//       hour: hour.hour,
//       deskTime: hour.deskTime,
//       productiveTime: hour.productiveTime,
//       idleTime: hour.idleTime,
//       productivity: hour.deskTime > 0 ? Math.round((hour.productiveTime / hour.deskTime) * 100) : 0
//     }));
//   };

//   const calculateTimeAtWork = () => {
//     const productive = session.productiveTime || 0;
//     const desk = session.deskTime || 0;
//     return productive + desk;
//   };

//   // View renderers
//   const renderDailyView = () => {
//     const hourlyProductivityData = calculateHourlyProductivity();
//     const timeAtWork = calculateTimeAtWork();
//     const timeAtWorkHours = formatTime(timeAtWork);

//     return (
//       <>
//         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
//           <StatCard
//             title="Arrival Time"
//             value={session.arrivalTime || '—'}
//             icon={<LogIn className="text-blue-400" />}
//             color="blue"
//           />
//           <StatCard
//             title="Logout Time"
//             value={session.leftTime || 'ONLINE'}
//             icon={<LogOut className={session.leftTime && session.leftTime !== 'ONLINE' ? 'text-gray-400' : 'text-green-400'} />}
//             color={session.leftTime && session.leftTime !== 'ONLINE' ? 'gray' : 'green'}
//           />
//           <StatCard
//             title="Productive Time"
//             value={formatTime(session.productiveTime)}
//             icon={<MousePointer className="text-green-400" />}
//             color="green"
//           />
//           <StatCard
//             title="DeskTime"
//             value={formatTime(session.deskTime)}
//             icon={<Monitor className="text-purple-400" />}
//             color="purple"
//           />
//         </div>

//         {session.hasSignificantBreak && session.nextArrivalAfterBreak && (
//           <div className="mb-6 p-4 bg-yellow-900/30 border border-yellow-700 rounded-xl">
//             <div className="flex items-center gap-2 text-yellow-300">
//               <Clock size={18} />
//               <span className="font-semibold">Break Detected:</span>
//               <span>Logged out at {session.leftTime}, returned at {session.nextArrivalAfterBreak} (5+ hour break)</span>
//             </div>
//           </div>
//         )}

//         <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
//           <StatCard
//             title="Time at Work"
//             value={timeAtWorkHours}
//             icon={<Briefcase className="text-yellow-400" />}
//             color="yellow"
//             fullWidth
//           />
//           <div className="lg:col-span-1">
//             <div className="bg-gray-800 rounded-xl p-6 h-full">
//               <div className="flex justify-between items-center mb-4">
//                 <h3 className="text-lg font-semibold">Effectiveness</h3>
//                 <Zap className="text-orange-400" />
//               </div>
//               <div className="text-center">
//                 <div className="text-4xl font-bold mb-2">
//                   {session.effectiveness.toFixed(2)}%
//                 </div>
//               </div>
//             </div>
//           </div>
//         </div>

//         <div className="bg-gray-800 rounded-xl p-6 mb-8">
//           <div className="mt-8">
//             <h3 className="text-lg font-semibold mb-4">Productivity Bar</h3>
//             <HourlyProductivityChart hourlyData={hourlyProductivityData} />
//           </div>
//         </div>
//       </>
//     );
//   };

//   const renderWeeklyView = () => (
//     <>
//       <div className="flex justify-between items-center mb-6">
//         <button
//           onClick={handlePreviousWeek}
//           className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700"
//         >
//           <ChevronLeft size={20} />
//         </button>

//         <div className="text-center">
//           <h2 className="text-xl font-bold">Weekly Overview</h2>
//           <p className="text-gray-400">{getCurrentDateRange()}</p>
//         </div>

//         <button
//           onClick={handleNextWeek}
//           className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700"
//         >
//           <ChevronRight size={20} />
//         </button>
//       </div>

//       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
//         <StatCard
//           title="Total DeskTime"
//           value={formatTime(weeklyStats.totalDeskTime)}
//           icon={<Monitor className="text-purple-400" />}
//           color="purple"
//         />
//         <StatCard
//           title="Total Productive"
//           value={formatTime(weeklyStats.totalProductiveTime)}
//           icon={<MousePointer className="text-green-400" />}
//           color="green"
//         />
//         <StatCard
//           title="Avg Effectiveness"
//           value={`${weeklyStats.avgProductivity.toFixed(1)}%`}
//           icon={<TrendingUp className="text-blue-400" />}
//           color="blue"
//         />
//         <StatCard
//           title="Avg DeskTime/Day"
//           value={formatTime(getWeeklyAverageTime())}
//           icon={<Activity className="text-yellow-400" />}
//           color="yellow"
//         />
//       </div>

//       <div className="bg-gray-800 rounded-xl p-6 mb-8">
//         <h3 className="text-lg font-semibold mb-6">Weekly Breakdown</h3>
//         <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
//           {weeklyStats.days.map((day, index) => (
//             <div
//               key={index}
//               className={`rounded-lg p-4 ${day.hasSession ? 'bg-gray-700' : 'bg-gray-900'}`}
//             >
//               <div className="text-center mb-3">
//                 <div className="text-sm text-gray-400">{day.dayName}</div>
//                 <div className="text-xs text-gray-500">
//                   {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
//                 </div>
//               </div>

//               <div className="space-y-2">
//                 <div className="text-center">
//                   <div className="text-sm text-gray-400">DeskTime</div>
//                   <div className="font-semibold">{formatTime(day.deskTime)}</div>
//                 </div>

//                 <div className="text-center">
//                   <div className="text-sm text-gray-400">Productive</div>
//                   <div className="font-semibold">{formatTime(day.productiveTime)}</div>
//                 </div>

//                 <div className="text-center">
//                   <div className="text-sm text-gray-400">Effectiveness</div>
//                   <div className={`font-semibold ${productivityTextColor(day.productivity)}`}>
//                     {day.productivity}%
//                   </div>
//                 </div>
//               </div>

//               {!day.hasSession && (
//                 <div className="text-center mt-3">
//                   <div className="text-xs text-gray-500 italic">No session</div>
//                 </div>
//               )}
//             </div>
//           ))}
//         </div>
//       </div>
//     </>
//   );

//   const renderMonthlyView = () => (
//     <>
//       <div className="flex justify-between items-center mb-6">
//         <button
//           onClick={handlePreviousMonth}
//           className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700"
//         >
//           <ChevronLeft size={20} />
//         </button>

//         <div className="text-center">
//           <h2 className="text-xl font-bold">Monthly Overview</h2>
//           <p className="text-gray-400">{getCurrentDateRange()}</p>
//         </div>

//         <button
//           onClick={handleNextMonth}
//           className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700"
//         >
//           <ChevronRight size={20} />
//         </button>
//       </div>

//       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
//         <StatCard
//           title="Total DeskTime"
//           value={formatTime(monthlyStats.totalDeskTime)}
//           icon={<Monitor className="text-purple-400" />}
//           color="purple"
//         />
//         <StatCard
//           title="Total Productive"
//           value={formatTime(monthlyStats.totalProductiveTime)}
//           icon={<MousePointer className="text-green-400" />}
//           color="green"
//         />
//         <StatCard
//           title="Avg Effectiveness"
//           value={`${monthlyStats.avgProductivity.toFixed(1)}%`}
//           icon={<TrendingUp className="text-blue-400" />}
//           color="blue"
//         />
//         <StatCard
//           title="Working Days"
//           value={`${monthlyStats.totalDays} days`}
//           icon={<Calendar className="text-yellow-400" />}
//           color="yellow"
//         />
//       </div>

//       <div className="bg-gray-800 rounded-xl p-6 mb-8">
//         <h3 className="text-lg font-semibold mb-6">Monthly Breakdown by Week</h3>
//         <div className="space-y-4">
//           {monthlyStats.weeks.map((week, index) => (
//             <div key={index} className="bg-gray-700 rounded-lg p-4">
//               <div className="flex justify-between items-center mb-3">
//                 <div>
//                   <div className="font-semibold">Week {week.weekNumber}</div>
//                   <div className="text-sm text-gray-400">
//                     {new Date(week.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} -
//                     {new Date(week.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
//                   </div>
//                 </div>
//                 <div className={`px-3 py-1 rounded-full text-sm font-medium ${productivityTextColor(week.productivity)} ${productivityColor(week.productivity).replace('bg-', 'bg-opacity-20 ')}`}>
//                   {week.productivity}%
//                 </div>
//               </div>

//               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
//                 <div className="text-center">
//                   <div className="text-sm text-gray-400">DeskTime</div>
//                   <div className="font-semibold">{formatTime(week.deskTime)}</div>
//                 </div>

//                 <div className="text-center">
//                   <div className="text-sm text-gray-400">Productive</div>
//                   <div className="font-semibold">{formatTime(week.productiveTime)}</div>
//                 </div>

//                 <div className="text-center">
//                   <div className="text-sm text-gray-400">Days</div>
//                   <div className="font-semibold">{week.days.filter(d => d.hasSession).length}</div>
//                 </div>

//                 <div className="text-center">
//                   <div className="text-sm text-gray-400">Avg/Day</div>
//                   <div className="font-semibold">
//                     {formatTime(week.days.filter(d => d.hasSession).length > 0
//                       ? week.deskTime / week.days.filter(d => d.hasSession).length
//                       : 0)}
//                   </div>
//                 </div>
//               </div>
//             </div>
//           ))}
//         </div>
//       </div>
//     </>
//   );

//   const renderViewContent = () => {
//     switch (viewMode) {
//       case 'weekly':
//         return renderWeeklyView();
//       case 'monthly':
//         return renderMonthlyView();
//       default:
//         return renderDailyView();
//     }
//   };

//   return (
//     <div className="min-h-screen bg-gray-900 text-white">
//       <Toaster position="top-right" />

//       <div className="max-w-7xl mx-auto p-6">
//         <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
//           <div>
//             <h1 className="text-3xl font-bold text-white">My DeskTime</h1>
//             <p className="text-gray-400 mt-1">{getCurrentDateRange()}</p>
//           </div>

//           <div className="flex flex-wrap gap-3 mt-4 md:mt-0">
//             <button
//               onClick={() => handleViewChange('daily')}
//               className={`px-4 py-2 rounded-lg flex items-center gap-2 ${viewMode === 'daily' ? 'bg-cyan-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
//             >
//               <Calendar size={18} />
//               Daily
//             </button>
//             <button
//               onClick={() => handleViewChange('weekly')}
//               className={`px-4 py-2 rounded-lg flex items-center gap-2 ${viewMode === 'weekly' ? 'bg-cyan-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
//             >
//               <TrendingUp size={18} />
//               Weekly
//             </button>
//             <button
//               onClick={() => handleViewChange('monthly')}
//               className={`px-4 py-2 rounded-lg flex items-center gap-2 ${viewMode === 'monthly' ? 'bg-cyan-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
//             >
//               <PieChart size={18} />
//               Monthly
//             </button>
//           </div>
//         </div>

//         {renderViewContent()}
//       </div>
//     </div>
//   );
// };

// export default DoctorDesktime;

// components/DoctorDesktime.jsx
// 'use client';
// import React, { useEffect, useRef, useState } from 'react';
// import axios from 'axios';
// import * as d3 from 'd3';
// import {
//   Clock,
//   LogIn,
//   LogOut,
//   Calendar,
//   TrendingUp,
//   Zap,
//   Briefcase,
//   PieChart,
//   ChevronLeft,
//   ChevronRight,
//   Activity,
//   MousePointer,
//   Monitor
// } from 'lucide-react';
// import { Toaster, toast } from 'react-hot-toast';

// /* helpers */
// const formatTime = (sec = 0) => {
//   const h = Math.floor(sec / 3600);
//   const m = Math.floor((sec % 3600) / 60);
//   const s = sec % 60;

//   if (h > 0) {
//     return `${h}h ${m}m`;
//   }
//   if (m > 0) {
//     return `${m}m ${s}s`;
//   }
//   return `${s}s`;
// };

// const formatTimeDetailed = (sec = 0) => {
//   const h = Math.floor(sec / 3600);
//   const m = Math.floor((sec % 3600) / 60);
//   const s = sec % 60;
//   return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
// };

// const productivityColor = (p) => {
//   if (p >= 80) return 'bg-green-500';
//   if (p >= 50) return 'bg-yellow-500';
//   return 'bg-red-500';
// };

// const productivityTextColor = (p) => {
//   if (p >= 80) return 'text-green-400';
//   if (p >= 50) return 'text-yellow-400';
//   return 'text-red-400';
// };

// /* Stat Card Component */
// const StatCard = ({ title, value, icon, color, fullWidth = false, tooltip }) => {
//   const colorClasses = {
//     blue: 'border-l-blue-500',
//     green: 'border-l-green-500',
//     purple: 'border-l-purple-500',
//     yellow: 'border-l-yellow-500',
//     indigo: 'border-l-indigo-500',
//     gray: 'border-l-gray-500',
//     orange: 'border-l-orange-500',
//   };

//   return (
//     <div className={`bg-gray-800 rounded-xl p-6 border-l-4 ${colorClasses[color]} ${fullWidth ? 'lg:col-span-2' : ''} relative group`}>
//       <div className="flex justify-between items-start">
//         <div>
//           <p className="text-gray-400 text-sm">{title}</p>
//           <p className="text-2xl font-bold mt-2">{value}</p>
//         </div>

//         {icon && (
//           <div className="p-2 bg-gray-700 rounded-lg">
//             {icon}
//           </div>
//         )}
//       </div>

//       {tooltip && (
//         <div className="absolute top-0 right-0 mt-10 mr-4 px-2 py-1 bg-gray-900 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
//           {tooltip}
//         </div>
//       )}
//     </div>
//   );
// };

// /* Hourly Productivity Chart Component */
// const HourlyProductivityChart = ({ hourlyData }) => {
//   const ref = useRef(null);

//   const formatTime = (seconds) => {
//     const s = Math.max(0, Math.floor(seconds || 0));
//     const m = Math.floor(s / 60);
//     const r = s % 60;
//     return `${m}:${String(r).padStart(2, "0")}`;
//   };

//   const formatTimeAMPM = (hour) => {
//     const ampm = hour >= 12 ? "PM" : "AM";
//     const adjustedHour = hour % 12 === 0 ? 12 : hour % 12;
//     return `${adjustedHour}:00 ${ampm}`;
//   };

//   const formatTooltipTime = (hour, minute) => {
//     const ampm = hour >= 12 ? "PM" : "AM";
//     const h = hour % 12 === 0 ? 12 : hour % 12;
//     return `${h}:${minute.toString().padStart(2, "0")} ${ampm}`;
//   };

//   useEffect(() => {
//     if (!hourlyData?.length || !ref.current) return;

//     const BUCKET = 300; // 5 minutes (in seconds)
//     const BUCKETS_PER_HOUR = 12; // 60 / 5

//     const START_HOUR = 8; // 08:00 AM
//     const END_HOUR = 21; // 09:00 PM

//     const renderChart = () => {
//       const width = ref.current.clientWidth;
//       const height = 150;

//       d3.select(ref.current).selectAll("*").remove();

//       const svg = d3
//         .select(ref.current)
//         .append("svg")
//         .attr("width", width)
//         .attr("height", height);

//       // Flatten into 5-min buckets
//       const buckets = [];
//       hourlyData
//         .filter((h) => h.hour >= START_HOUR && h.hour < END_HOUR)
//         .forEach((hour) => {
//           const base = (hour.hour - START_HOUR) * BUCKETS_PER_HOUR;

//           const desk = hour.deskTime || 0;
//           const prod = hour.productiveTime || 0;
//           const idle = hour.idleTime || 0;

//           const nonProdDesk = Math.max(0, desk - prod);

//           for (let i = 0; i < BUCKETS_PER_HOUR; i++) {
//             buckets.push({
//               index: base + i,
//               productive: prod / BUCKETS_PER_HOUR,
//               nonProdDesk: nonProdDesk / BUCKETS_PER_HOUR,
//               idle: idle / BUCKETS_PER_HOUR,
//               hour: hour.hour,
//               subIndex: i,
//             });
//           }
//         });

//       // Scale for the 5-min slots
//       const x = d3
//         .scaleBand()
//         .domain(buckets.map((d) => d.index))
//         .range([50, width - 30]);

//       const subX = d3
//         .scaleBand()
//         .domain([0, 1, 2])
//         .range([0, x.bandwidth()])

//       const y = d3
//         .scaleLinear()
//         .domain([0, BUCKET]) // 0..300 seconds
//         .range([height - 60, 40]);

//       // Create group for each 5-min bucket
//       const groups = svg
//         .selectAll("g.bucket")
//         .data(buckets)
//         .enter()
//         .append("g")
//         .attr("class", "bucket")
//         .attr("transform", (d) => `translate(${x(d.index)},0)`);

//       // Productive - left bar (green)
//       groups
//         .append("rect")
//         .attr("x", subX(0))
//         .attr("y", (d) => y(d.productive))
//         .attr("width", subX.bandwidth())
//         .attr("height", (d) => height - 60 - y(d.productive))
//         .attr("fill", "#22c55e")
//         .attr("rx", 2);

//       // Non-productive DeskTime - middle bar (blue)
//       groups
//         .append("rect")
//         .attr("x", subX(1))
//         .attr("y", (d) => y(d.nonProdDesk))
//         .attr("width", subX.bandwidth())
//         .attr("height", (d) => height - 60 - y(d.nonProdDesk))
//         .attr("fill", "#3b82f6")
//         .attr("rx", 2);

//       // Idle - right bar (gray)
//       groups
//         .append("rect")
//         .attr("x", subX(2))
//         .attr("y", (d) => y(d.idle))
//         .attr("width", subX.bandwidth())
//         .attr("height", (d) => height - 60 - y(d.idle))
//         .attr("fill", "#6b7280")
//         .attr("rx", 2);

//       // Tooltip (remove old first to prevent duplicates)
//       d3.select("body").selectAll(".hourly-prod-tooltip").remove();

//       const tooltip = d3
//         .select("body")
//         .append("div")
//         .attr("class", "hourly-prod-tooltip")
//         .style("position", "absolute")
//         .style("visibility", "hidden")
//         .style("background", "rgba(0,0,0,0.9)")
//         .style("color", "white")
//         .style("padding", "8px 12px")
//         .style("border-radius", "6px")
//         .style("font-size", "13px")
//         .style("pointer-events", "none")
//         .style("z-index", "10000");

//       groups
//         .on("mouseover", function (event, d) {
//           const startMin = d.subIndex * 5;

//           // handle end time correctly
//           let endHour = d.hour;
//           let endMin = startMin + 5;
//           if (endMin >= 60) {
//             endMin = 0;
//             endHour = d.hour + 1;
//           }

//           const timeRange = `${formatTooltipTime(
//             d.hour,
//             startMin
//           )} – ${formatTooltipTime(endHour, endMin)}`;

//           tooltip
//             .style("visibility", "visible")
//             .html(`
//               ${timeRange}<br>
//               <span style="color:#22c55e">Productive: ${formatTime(
//                 Math.round(d.productive)
//               )}</span><br>
//               <span style="color:#3b82f6">DeskTime (non-prod): ${formatTime(
//                 Math.round(d.nonProdDesk)
//               )}</span><br>
//               <span style="color:#6b7280">Idle: ${formatTime(
//                 Math.round(d.idle)
//               )}</span>
//             `)
//             .style("left", event.pageX + 15 + "px")
//             .style("top", event.pageY - 10 + "px");
//         })
//         .on("mousemove", function (event) {
//           tooltip
//             .style("left", event.pageX + 15 + "px")
//             .style("top", event.pageY - 10 + "px");
//         })
//         .on("mouseout", () => tooltip.style("visibility", "hidden"));

//       // X-axis labels
//       for (let h = START_HOUR; h < END_HOUR; h += 1) {
//         svg
//           .append("text")
//           .attr("x", x((h - START_HOUR) * BUCKETS_PER_HOUR) + x.bandwidth() / 2)
//           .attr("y", height - 24)
//           .attr("text-anchor", "middle")
//           .attr("font-size", "11px")
//           .attr("fill", "#9ca3af")
//           .text(formatTimeAMPM(h));
//       }

//       // Y-axis labels (0% to 100%)
//       const ticks = [0, 0.25, 0.5, 0.75, 1];
//       ticks.forEach((t) => {
//         svg
//           .append("text")
//           .attr("x", 10)
//           .attr("y", y(BUCKET * t) + 4)
//           .attr("font-size", "11px")
//           .attr("fill", "#9ca3af")
//           .text(`${Math.round(t * 100)}%`);
//       });
//     };

//     renderChart();

//     // resize support
//     const handleResize = () => renderChart();
//     window.addEventListener("resize", handleResize);

//     return () => {
//       window.removeEventListener("resize", handleResize);
//       d3.select(ref.current).selectAll("*").remove();
//       d3.select("body").selectAll(".hourly-prod-tooltip").remove();
//     };
//   }, [hourlyData]);

//   return (
//     <div className="w-full">
//       <div className="flex justify-between text-sm text-gray-400 mb-3 px-2">
//         {/* legend removed as in your format */}
//       </div>

//       <div
//         ref={ref}
//         className="w-full rounded bg-gray-900 overflow-hidden"
//         style={{ minHeight: "80px" }}
//       />
//     </div>
//   );
// };

// /* Main Dashboard Component */
// const DoctorDesktime = () => {
//   const [viewMode, setViewMode] = useState('daily');
//   const [weekOffset, setWeekOffset] = useState(0);
//   const [monthOffset, setMonthOffset] = useState(0);

//   const [session, setSession] = useState({
//     arrivalTime: null,
//     leftTime: null,
//     deskTime: 0,
//     productiveTime: 0,
//     timeAtWork: 0,
//     productivity: 0,
//     effectiveness: 0,
//     hasSignificantBreak: false,
//     nextArrivalAfterBreak: null
//   });

//   const [weeklyStats, setWeeklyStats] = useState({
//     totalDeskTime: 0,
//     totalProductiveTime: 0,
//     avgProductivity: 0,
//     totalSessions: 0,
//     days: [],
//     weekStart: new Date(),
//     weekEnd: new Date()
//   });

//   const [monthlyStats, setMonthlyStats] = useState({
//     totalDeskTime: 0,
//     totalProductiveTime: 0,
//     avgProductivity: 0,
//     totalDays: 0,
//     weeks: [],
//     monthStart: new Date(),
//     monthEnd: new Date(),
//     monthName: ''
//   });

//   const [hourlyData, setHourlyData] = useState({
//     hourlyStats: [],
//     totalDeskTime: 0,
//     totalProductiveTime: 0,
//     totalIdleTime: 0,
//     date: new Date()
//   });

//   const token = typeof window !== 'undefined' ? localStorage.getItem('userToken') : null;

//   // Activity tracking - SAME as AgentDesktime but with doctor API endpoints
//   useEffect(() => {
//     if (!token) return;

//     let lastActivity = Date.now();
//     let idleTimer = null;
//     let visibilityInterval = null;

//     const IDLE_THRESHOLD = 3 * 60 * 1000;

//     const report = async (type, durationSec) => {
//       if (durationSec < 1) return;
//       try {
//         await axios.post(`/api/doctor/work-session/${type}`, { duration: durationSec }, {
//           headers: { Authorization: `Bearer ${token}` },
//         });
//       } catch (err) {
//         console.error(`Failed to report ${type}:`, err);
//       }
//     };

//     const resetActivity = () => {
//       const now = Date.now();
//       const elapsed = now - lastActivity;

//       if (elapsed >= 1 && document.visibilityState === 'visible') {
//         const activeSec = Math.floor(elapsed / 1000);
//         report('mouse-activity', activeSec);
//       }

//       if (elapsed >= IDLE_THRESHOLD) {
//         const idleSec = Math.floor((elapsed - IDLE_THRESHOLD) / 1000);
//         if (idleSec > 0 && document.visibilityState === 'visible') {
//           report('idle', idleSec);
//         }
//       }

//       lastActivity = now;
//       clearTimeout(idleTimer);
//       idleTimer = null;
//     };

//     const startIdleTimer = () => {
//       clearTimeout(idleTimer);
//       idleTimer = setTimeout(() => {
//         const now = Date.now();
//         const idleSec = Math.floor((now - lastActivity) / 1000);
//         if (idleSec > 0 && document.visibilityState === 'visible') {
//           report('idle', idleSec);
//         }
//       }, IDLE_THRESHOLD + 1000);
//     };

//     const handleVisibility = () => {
//       const now = Date.now();

//       if (document.visibilityState === 'visible') {
//         const awaySec = Math.floor((now - lastActivity) / 1000);
//         if (awaySec >= 30) {
//           report('desktime', awaySec);
//         }
//         lastActivity = now;
//         startIdleTimer();
//       } else {
//         const activeSec = Math.floor((now - lastActivity) / 1000);
//         if (activeSec > 0) {
//           report('desktime', activeSec);
//           report('mouse-activity', activeSec);
//         }
//         lastActivity = now;
//         clearTimeout(idleTimer);
//       }
//     };

//     const handleInput = () => {
//       if (document.visibilityState === 'visible') {
//         resetActivity();
//         startIdleTimer();
//       }
//     };

//     visibilityInterval = setInterval(() => {
//       if (document.visibilityState === 'visible') {
//         const now = Date.now();
//         const elapsed = now - lastActivity;

//         if (elapsed >= IDLE_THRESHOLD) {
//           const idleSec = Math.floor((elapsed - IDLE_THRESHOLD) / 1000);
//           if (idleSec > 0) {
//             report('idle', idleSec);
//             lastActivity = now - (idleSec * 1000);
//           }
//         } else if (elapsed >= 5) {
//           report('mouse-activity', Math.floor(elapsed / 1000));
//           lastActivity = now;
//         }
//       }
//     }, 30000);

//     document.addEventListener('visibilitychange', handleVisibility);
//     ['mousemove', 'keydown', 'wheel', 'mousedown', 'touchstart'].forEach(evt => {
//       window.addEventListener(evt, handleInput, { passive: true });
//     });

//     lastActivity = Date.now();
//     startIdleTimer();

//     return () => {
//       document.removeEventListener('visibilitychange', handleVisibility);
//       ['mousemove', 'keydown', 'wheel', 'mousedown', 'touchstart'].forEach(evt => {
//         window.removeEventListener(evt, handleInput);
//       });
//       clearInterval(visibilityInterval);
//       clearTimeout(idleTimer);
//     };
//   }, [token]);

//   // Mark arrival - doctor endpoint
//   useEffect(() => {
//     if (!token) return;

//     const markArrival = async () => {
//       try {
//         const res = await axios.post(
//           '/api/doctor/work-session/arrival',
//           {},
//           {
//             headers: { Authorization: `Bearer ${token}` },
//           }
//         );

//         if (res.data?.arrivalTime) {
//           setSession((prev) => ({
//             ...prev,
//             arrivalTime: new Date(res.data.arrivalTime).toLocaleTimeString([], {
//               hour: '2-digit',
//               minute: '2-digit'
//             }),
//           }));
//         }
//       } catch (err) {
//         console.error('Arrival time error');
//       }
//     };

//     markArrival();
//   }, [token]);

//   // Load data functions - doctor endpoints
//   const loadHourlyData = async (date = new Date()) => {
//     try {
//       const formattedDate = date.toISOString().split('T')[0];
//       const res = await axios.get(`/api/doctor/work-session/hourly?date=${formattedDate}`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });

//       if (res.data?.success) {
//         setHourlyData(res.data.data);
//       } else {
//         const emptyHourlyStats = Array.from({ length: 24 }, (_, hour) => ({
//           hour,
//           deskTime: 0,
//           productiveTime: 0,
//           idleTime: 0,
//           productivity: 0
//         }));
//         setHourlyData({
//           hourlyStats: emptyHourlyStats,
//           totalDeskTime: 0,
//           totalProductiveTime: 0,
//           totalIdleTime: 0,
//           date: date
//         });
//       }
//     } catch (e) {
//       console.error('Load hourly data error:', e);
//       const emptyHourlyStats = Array.from({ length: 24 }, (_, hour) => ({
//         hour,
//         deskTime: 0,
//         productiveTime: 0,
//         idleTime: 0,
//         productivity: 0
//       }));
//       setHourlyData({
//         hourlyStats: emptyHourlyStats,
//         totalDeskTime: 0,
//         totalProductiveTime: 0,
//         totalIdleTime: 0,
//         date: date
//       });
//     }
//   };

//   const loadSession = async () => {
//     try {
//       const res = await axios.get('/api/doctor/work-session/today', {
//         headers: { Authorization: `Bearer ${token}` },
//       });

//       if (res.data?.success && res.data.data) {
//         const data = res.data.data;

//         let hasSignificantBreak = false;
//         let nextArrivalAfterBreak = null;
//         let displayLeftTime = 'ONLINE';

//         if (data.leftTime) {
//           const leftTime = new Date(data.leftTime);
//           const nextArrival = data.nextArrivalTime ? new Date(data.nextArrivalTime) : null;

//           if (nextArrival) {
//             const breakDuration = (nextArrival.getTime() - leftTime.getTime()) / (1000 * 60 * 60);

//             if (breakDuration >= 5) {
//               hasSignificantBreak = true;
//               nextArrivalAfterBreak = nextArrival.toLocaleTimeString([], {
//                 hour: '2-digit',
//                 minute: '2-digit'
//               });
//               displayLeftTime = leftTime.toLocaleTimeString([], {
//                 hour: '2-digit',
//                 minute: '2-digit'
//               });
//             } else {
//               displayLeftTime = 'ONLINE';
//             }
//           } else {
//             displayLeftTime = leftTime.toLocaleTimeString([], {
//               hour: '2-digit',
//               minute: '2-digit'
//             });
//           }
//         }

//         const deskTime = data.deskTimeSeconds || 0;
//         const productiveTime = data.productiveSeconds || 0;
//         const timeAtWork = data.timeAtWorkSeconds || 0;

//         const effectiveness = timeAtWork > 0
//           ? Math.min(100, (productiveTime / timeAtWork) * 100)
//           : 0;

//         const workDayHours = 8 * 3600;
//         const productivity = workDayHours > 0
//           ? Math.min(100, (productiveTime / workDayHours) * 100)
//           : 0;

//         setSession({
//           arrivalTime: data.arrivalTime
//             ? new Date(data.arrivalTime).toLocaleTimeString([], {
//               hour: '2-digit',
//               minute: '2-digit'
//             })
//             : null,
//           leftTime: displayLeftTime,
//           deskTime: deskTime,
//           productiveTime: productiveTime,
//           timeAtWork: timeAtWork,
//           productivity: productivity,
//           effectiveness: effectiveness,
//           hasSignificantBreak: hasSignificantBreak,
//           nextArrivalAfterBreak: nextArrivalAfterBreak
//         });
//       } else if (res.data?.message === 'No session found for today') {
//         setSession({
//           arrivalTime: null,
//           leftTime: null,
//           deskTime: 0,
//           productiveTime: 0,
//           timeAtWork: 0,
//           productivity: 0,
//           effectiveness: 0,
//           hasSignificantBreak: false,
//           nextArrivalAfterBreak: null
//         });
//       }
//     } catch (e) {
//       console.error('Load session error:', e);
//       toast.error('Failed to load desk time data');
//     }
//   };

//   const loadWeeklyStats = async (offset = 0) => {
//     if (!token) return;

//     try {
//       const res = await axios.get(`/api/doctor/work-session/weekly?offset=${offset}`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });

//       if (res.data?.success) {
//         setWeeklyStats(res.data.data);
//       }
//     } catch (e) {
//       console.error('Load weekly stats error:', e);
//       toast.error('Failed to load weekly stats');
//     }
//   };

//   const loadMonthlyStats = async (offset = 0) => {
//     if (!token) return;

//     try {
//       const res = await axios.get(`/api/doctor/work-session/monthly?offset=${offset}`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });

//       if (res.data?.success) {
//         setMonthlyStats(res.data.data);
//       }
//     } catch (e) {
//       console.error('Load monthly stats error:', e);
//       toast.error('Failed to load monthly stats');
//     }
//   };

//   // Initial data load
//   useEffect(() => {
//     loadSession();
//     loadHourlyData();
//     loadWeeklyStats(weekOffset);
//     loadMonthlyStats(monthOffset);

//     const t = setInterval(() => {
//       loadSession();
//       if (viewMode === 'daily') {
//         loadHourlyData();
//       }
//     }, 30000);

//     return () => clearInterval(t);
//   }, [weekOffset, monthOffset, viewMode, token]);

//   // View handlers
//   const handleViewChange = (mode) => {
//     setViewMode(mode);
//   };

//   const handlePreviousWeek = () => {
//     setWeekOffset(prev => prev - 1);
//   };

//   const handleNextWeek = () => {
//     setWeekOffset(prev => prev + 1);
//   };

//   const handlePreviousMonth = () => {
//     setMonthOffset(prev => prev - 1);
//   };

//   const handleNextMonth = () => {
//     setMonthOffset(prev => prev + 1);
//   };

//   const getCurrentDateRange = () => {
//     const now = new Date();
//     switch (viewMode) {
//       case 'daily':
//         return `Today, ${now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
//       case 'weekly':
//         const weekStart = new Date(weeklyStats.weekStart);
//         const weekEnd = new Date(weeklyStats.weekEnd);
//         return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
//       case 'monthly':
//         return monthlyStats.monthName || now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
//       default:
//         return '';
//     }
//   };

//   const getWeeklyAverageTime = () => {
//     const sessionsCount = weeklyStats.days.filter(day => day.hasSession).length;
//     if (sessionsCount === 0) return 0;
//     return Math.round(weeklyStats.totalDeskTime / sessionsCount);
//   };

//   const getMonthlyAverageTime = () => {
//     const daysCount = monthlyStats.totalDays;
//     if (daysCount === 0) return 0;
//     return Math.round(monthlyStats.totalDeskTime / daysCount);
//   };

//   const calculateHourlyProductivity = () => {
//     return hourlyData.hourlyStats.map(hour => ({
//       hour: hour.hour,
//       deskTime: hour.deskTime,
//       productiveTime: hour.productiveTime,
//       idleTime: hour.idleTime,
//       productivity: hour.deskTime > 0 ? Math.round((hour.productiveTime / hour.deskTime) * 100) : 0
//     }));
//   };

//   const calculateTimeAtWork = () => {
//     const productive = session.productiveTime || 0;
//     const desk = session.deskTime || 0;
//     return productive + desk;
//   };

//   // View renderers
//   const renderDailyView = () => {
//     const hourlyProductivityData = calculateHourlyProductivity();
//     const timeAtWork = calculateTimeAtWork();
//     const timeAtWorkHours = formatTime(timeAtWork);

//     return (
//       <>
//         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
//           <StatCard
//             title="Arrival Time"
//             value={session.arrivalTime || '—'}
//             // icon={<LogIn className="text-blue-400" />}
//             color="blue"
//           />
//           <StatCard
//             title="Logout Time"
//             value={session.leftTime || 'ONLINE'}
//             // icon={<LogOut className={session.leftTime && session.leftTime !== 'ONLINE' ? 'text-gray-400' : 'text-green-400'} />}
//             color={session.leftTime && session.leftTime !== 'ONLINE' ? 'gray' : 'green'}
//           />
//           <StatCard
//             title="Productive Time"
//             value={formatTime(session.productiveTime)}
//             // icon={<MousePointer className="text-green-400" />}
//             color="green"
//           />
//           <StatCard
//             title="DeskTime"
//             value={formatTime(session.deskTime)}
//             // icon={<Monitor className="text-purple-400" />}
//             color="purple"
//           />
//         </div>

//         {session.hasSignificantBreak && session.nextArrivalAfterBreak && (
//           <div className="mb-6 p-4 bg-yellow-900/30 border border-yellow-700 rounded-xl">
//             <div className="flex items-center gap-2 text-yellow-300">
//               {/* <Clock size={18} /> */}
//               <span className="font-semibold">Break Detected:</span>
//               <span>Logged out at {session.leftTime}, returned at {session.nextArrivalAfterBreak} (5+ hour break)</span>
//             </div>
//           </div>
//         )}

//         <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
//           <StatCard
//             title="Time at Work"
//             value={timeAtWorkHours}
//             // icon={<Briefcase className="text-yellow-400" />}
//             color="yellow"
//             fullWidth
//           />
//           <div className="lg:col-span-1">
//             <div className="bg-gray-800 rounded-xl p-6 h-full">
//               <div className="flex justify-between items-center mb-4">
//                 <h3 className="text-lg font-semibold">Effectiveness</h3>
//                 {/* <Zap className="text-orange-400" /> */}
//               </div>
//               <div className="text-center">
//                 <div className="text-4xl font-bold mb-2">
//                   {session.effectiveness.toFixed(2)}%
//                 </div>
//               </div>
//             </div>
//           </div>
//         </div>

//         <div className="bg-gray-800 rounded-xl p-6 mb-8">
//           <div className="mt-1">
//             <h3 className="text-lg font-semibold mb-2">Productivity Bar</h3>
//             <HourlyProductivityChart hourlyData={hourlyProductivityData} />
//           </div>
//         </div>
//       </>
//     );
//   };

//   const renderWeeklyView = () => (
//     <>
//       <div className="flex justify-between items-center mb-6">
//         <button
//           onClick={handlePreviousWeek}
//           className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700"
//         >
//           <ChevronLeft size={20} />
//         </button>

//         <div className="text-center">
//           <h2 className="text-xl font-bold">Weekly Overview</h2>
//           <p className="text-gray-400">{getCurrentDateRange()}</p>
//         </div>

//         <button
//           onClick={handleNextWeek}
//           className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700"
//         >
//           <ChevronRight size={20} />
//         </button>
//       </div>

//       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
//         <StatCard
//           title="Total DeskTime"
//           value={formatTime(weeklyStats.totalDeskTime)}
//           icon={<Monitor className="text-purple-400" />}
//           color="purple"
//         />
//         <StatCard
//           title="Total Productive"
//           value={formatTime(weeklyStats.totalProductiveTime)}
//           icon={<MousePointer className="text-green-400" />}
//           color="green"
//         />
//         <StatCard
//           title="Avg Effectiveness"
//           value={`${weeklyStats.avgProductivity.toFixed(1)}%`}
//           icon={<TrendingUp className="text-blue-400" />}
//           color="blue"
//         />
//         <StatCard
//           title="Avg DeskTime/Day"
//           value={formatTime(getWeeklyAverageTime())}
//           icon={<Activity className="text-yellow-400" />}
//           color="yellow"
//         />
//       </div>

//       <div className="bg-gray-800 rounded-xl p-6 mb-8">
//         <h3 className="text-lg font-semibold mb-6">Weekly Breakdown</h3>
//         <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
//           {weeklyStats.days.map((day, index) => (
//             <div
//               key={index}
//               className={`rounded-lg p-4 ${day.hasSession ? 'bg-gray-700' : 'bg-gray-900'}`}
//             >
//               <div className="text-center mb-3">
//                 <div className="text-sm text-gray-400">{day.dayName}</div>
//                 <div className="text-xs text-gray-500">
//                   {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
//                 </div>
//               </div>

//               <div className="space-y-2">
//                 <div className="text-center">
//                   <div className="text-sm text-gray-400">DeskTime</div>
//                   <div className="font-semibold">{formatTime(day.deskTime)}</div>
//                 </div>

//                 <div className="text-center">
//                   <div className="text-sm text-gray-400">Productive</div>
//                   <div className="font-semibold">{formatTime(day.productiveTime)}</div>
//                 </div>

//                 <div className="text-center">
//                   <div className="text-sm text-gray-400">Effectiveness</div>
//                   <div className={`font-semibold ${productivityTextColor(day.productivity)}`}>
//                     {day.productivity}%
//                   </div>
//                 </div>
//               </div>

//               {!day.hasSession && (
//                 <div className="text-center mt-3">
//                   <div className="text-xs text-gray-500 italic">No session</div>
//                 </div>
//               )}
//             </div>
//           ))}
//         </div>
//       </div>
//     </>
//   );

//   const renderMonthlyView = () => (
//     <>
//       <div className="flex justify-between items-center mb-6">
//         <button
//           onClick={handlePreviousMonth}
//           className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700"
//         >
//           <ChevronLeft size={20} />
//         </button>

//         <div className="text-center">
//           <h2 className="text-xl font-bold">Monthly Overview</h2>
//           <p className="text-gray-400">{getCurrentDateRange()}</p>
//         </div>

//         <button
//           onClick={handleNextMonth}
//           className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700"
//         >
//           <ChevronRight size={20} />
//         </button>
//       </div>

//       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
//         <StatCard
//           title="Total DeskTime"
//           value={formatTime(monthlyStats.totalDeskTime)}
//           icon={<Monitor className="text-purple-400" />}
//           color="purple"
//         />
//         <StatCard
//           title="Total Productive"
//           value={formatTime(monthlyStats.totalProductiveTime)}
//           icon={<MousePointer className="text-green-400" />}
//           color="green"
//         />
//         <StatCard
//           title="Avg Effectiveness"
//           value={`${monthlyStats.avgProductivity.toFixed(1)}%`}
//           icon={<TrendingUp className="text-blue-400" />}
//           color="blue"
//         />
//         <StatCard
//           title="Working Days"
//           value={`${monthlyStats.totalDays} days`}
//           icon={<Calendar className="text-yellow-400" />}
//           color="yellow"
//         />
//       </div>

//       <div className="bg-gray-800 rounded-xl p-6 mb-8">
//         <h3 className="text-lg font-semibold mb-6">Monthly Breakdown by Week</h3>
//         <div className="space-y-4">
//           {monthlyStats.weeks.map((week, index) => (
//             <div key={index} className="bg-gray-700 rounded-lg p-4">
//               <div className="flex justify-between items-center mb-3">
//                 <div>
//                   <div className="font-semibold">Week {week.weekNumber}</div>
//                   <div className="text-sm text-gray-400">
//                     {new Date(week.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} -
//                     {new Date(week.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
//                   </div>
//                 </div>
//                 <div className={`px-3 py-1 rounded-full text-sm font-medium ${productivityTextColor(week.productivity)} ${productivityColor(week.productivity).replace('bg-', 'bg-opacity-20 ')}`}>
//                   {week.productivity}%
//                 </div>
//               </div>

//               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
//                 <div className="text-center">
//                   <div className="text-sm text-gray-400">DeskTime</div>
//                   <div className="font-semibold">{formatTime(week.deskTime)}</div>
//                 </div>

//                 <div className="text-center">
//                   <div className="text-sm text-gray-400">Productive</div>
//                   <div className="font-semibold">{formatTime(week.productiveTime)}</div>
//                 </div>

//                 <div className="text-center">
//                   <div className="text-sm text-gray-400">Days</div>
//                   <div className="font-semibold">{week.days.filter(d => d.hasSession).length}</div>
//                 </div>

//                 <div className="text-center">
//                   <div className="text-sm text-gray-400">Avg/Day</div>
//                   <div className="font-semibold">
//                     {formatTime(week.days.filter(d => d.hasSession).length > 0
//                       ? week.deskTime / week.days.filter(d => d.hasSession).length
//                       : 0)}
//                   </div>
//                 </div>
//               </div>
//             </div>
//           ))}
//         </div>
//       </div>
//     </>
//   );

//   const renderViewContent = () => {
//     switch (viewMode) {
//       case 'weekly':
//         return renderWeeklyView();
//       case 'monthly':
//         return renderMonthlyView();
//       default:
//         return renderDailyView();
//     }
//   };

//   return (
//     <div className="min-h-screen bg-gray-900 text-white">
//       <Toaster position="top-right" />

//       <div className="max-w-7xl mx-auto p-6">
//         <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
//           <div>
//             <h1 className="text-3xl font-bold text-white">My DeskTime</h1>
//             <p className="text-gray-400 mt-1">{getCurrentDateRange()}</p>
//           </div>

//           <div className="flex flex-wrap gap-3 mt-4 md:mt-0">
//             <button
//               onClick={() => handleViewChange('daily')}
//               className={`px-4 py-2 rounded-lg flex items-center gap-2 ${viewMode === 'daily' ? 'bg-cyan-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
//             >
//               <Calendar size={18} />
//               Daily
//             </button>
//             <button
//               onClick={() => handleViewChange('weekly')}
//               className={`px-4 py-2 rounded-lg flex items-center gap-2 ${viewMode === 'weekly' ? 'bg-cyan-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
//             >
//               <TrendingUp size={18} />
//               Weekly
//             </button>
//             <button
//               onClick={() => handleViewChange('monthly')}
//               className={`px-4 py-2 rounded-lg flex items-center gap-2 ${viewMode === 'monthly' ? 'bg-cyan-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
//             >
//               <PieChart size={18} />
//               Monthly
//             </button>
//           </div>
//         </div>

//         {renderViewContent()}

//          {/* no scrollbar */}
//         <scripts>
//           <style>{`
//             ::-webkit-scrollbar {
//               display: none;
//             }
//             -ms-overflow-style: none;  /* IE and Edge */
//             scrollbar-width: none;  /* Firefox */
//           `}</style>
//         </scripts>
//       </div>
//     </div>
//   );
// };

// export default DoctorDesktime;

// components/DoctorDesktime.jsx
'use client';
import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import * as d3 from 'd3';
import {
  Clock,
  LogIn,
  LogOut,
  Calendar,
  TrendingUp,
  Zap,
  Briefcase,
  PieChart,
  ChevronLeft,
  ChevronRight,
  Activity,
  MousePointer,
  Monitor
} from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';

/* helpers */
const formatTime = (sec = 0) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;

  if (h > 0) {
    return `${h}h ${m}m`;
  }
  if (m > 0) {
    return `${m}m ${s}s`;
  }
  return `${s}s`;
};

const formatTimeDetailed = (sec = 0) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const productivityColor = (p) => {
  if (p >= 80) return 'bg-green-500';
  if (p >= 50) return 'bg-yellow-500';
  return 'bg-red-500';
};

const productivityTextColor = (p) => {
  if (p >= 80) return 'text-green-400';
  if (p >= 50) return 'text-yellow-400';
  return 'text-red-400';
};

/* Stat Card Component */
const StatCard = ({ title, value, icon, color, fullWidth = false, tooltip }) => {
  const colorClasses = {
    blue: 'border-l-blue-500',
    green: 'border-l-green-500',
    purple: 'border-l-purple-500',
    yellow: 'border-l-yellow-500',
    indigo: 'border-l-indigo-500',
    gray: 'border-l-gray-500',
    orange: 'border-l-orange-500',
  };

  return (
    <div className={`bg-gray-800 rounded-xl p-6 border-l-4 ${colorClasses[color]} ${fullWidth ? 'lg:col-span-2' : ''} relative group`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-gray-400 text-sm">{title}</p>
          <p className="text-2xl font-bold mt-2">{value}</p>
        </div>

        {icon && (
          <div className="p-2 bg-gray-700 rounded-lg">
            {icon}
          </div>
        )}
      </div>

      {tooltip && (
        <div className="absolute top-0 right-0 mt-10 mr-4 px-2 py-1 bg-gray-900 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
          {tooltip}
        </div>
      )}
    </div>
  );
};

/* Productivity Bar Component (DeskTime Style) */
const ProductivityBarChart = ({ hourlyData, selectedDate = new Date() }) => {
  const ref = useRef(null);
  const [tooltipData, setTooltipData] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const PRODUCTIVE_COLOR = "#22c55e";
  const NEUTRAL_COLOR = "#3b82f6";
  const UNPRODUCTIVE_COLOR = "#ef4444";
  const INACTIVE_COLOR = "#9ca3af";

  const getProductivityData = () => {
    const intervals = [];
    const HOURS_TO_SHOW = 13;
    const INTERVALS_PER_HOUR = 12;
    const TOTAL_INTERVALS = HOURS_TO_SHOW * INTERVALS_PER_HOUR;
    const SECONDS_PER_INTERVAL = 300;

    for (let i = 0; i < TOTAL_INTERVALS; i++) {
      const hour = Math.floor(i / INTERVALS_PER_HOUR) + 8;
      const minute = (i % INTERVALS_PER_HOUR) * 5;

      const hourData = hourlyData?.find(h => h.hour === hour) || {
        productiveTime: 0,
        deskTime: 0,
        idleTime: 0
      };

      const totalHourlyActivity = hourData.deskTime + hourData.idleTime;

      if (totalHourlyActivity > 0) {
        const productivePct = hourData.productiveTime / totalHourlyActivity;
        const idlePct = hourData.idleTime / totalHourlyActivity;
        const neutralPct = Math.max(0, 1 - productivePct - idlePct);

        intervals.push({
          hour,
          minute,
          time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
          productive: Math.round(productivePct * 100),
          neutral: Math.round(neutralPct * 100),
          unproductive: Math.round(idlePct * 100),
          totalSeconds: SECONDS_PER_INTERVAL,
          isActive: true,
          rawData: {
            productiveSeconds: hourData.productiveTime / INTERVALS_PER_HOUR,
            neutralSeconds: (hourData.deskTime - hourData.productiveTime) / INTERVALS_PER_HOUR,
            unproductiveSeconds: hourData.idleTime / INTERVALS_PER_HOUR
          }
        });
      } else {
        intervals.push({
          hour,
          minute,
          time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
          productive: 0,
          neutral: 0,
          unproductive: 0,
          totalSeconds: 0,
          isActive: false,
          rawData: {
            productiveSeconds: 0,
            neutralSeconds: 0,
            unproductiveSeconds: 0
          }
        });
      }
    }
    return intervals;
  };

  const formatTimeAMPM = (hour) => {
    const ampm = hour >= 12 ? "PM" : "AM";
    const adjustedHour = hour % 12 === 0 ? 12 : hour % 12;
    return `${adjustedHour} ${ampm}`;
  };

  useEffect(() => {
    if (!hourlyData?.length || !ref.current) return;

    const productivityData = getProductivityData();
    const width = ref.current.clientWidth;
    const height = 180;
    const margin = { top: 20, right: 30, bottom: 40, left: 40 };

    d3.select(ref.current).selectAll("*").remove();

    const svg = d3.select(ref.current)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("class", "productivity-bar-chart");

    const xScale = d3.scaleBand()
      .domain(productivityData.map(d => d.time))
      .range([margin.left, width - margin.right])
      .padding(0.1);

    const yScale = d3.scaleLinear()
      .domain([0, 100])
      .range([height - margin.bottom, margin.top]);

    svg.selectAll(".grid-line")
      .data([0, 25, 50, 75, 100])
      .enter()
      .append("line")
      .attr("class", "grid-line")
      .attr("x1", margin.left)
      .attr("x2", width - margin.right)
      .attr("y1", d => yScale(d))
      .attr("y2", d => yScale(d))
      .attr("stroke", "#374151")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "2,2");

    const timeSlots = svg.selectAll(".time-slot")
      .data(productivityData)
      .enter()
      .append("g")
      .attr("class", "time-slot")
      .attr("transform", d => `translate(${xScale(d.time)}, ${height - margin.bottom})`)
      .on("mouseover", function (event, d) {
        const rect = this.getBoundingClientRect();
        setTooltipData(d);
        setTooltipPosition({
          x: rect.left + rect.width / 2,
          y: rect.top - 10
        });
      })
      .on("mouseout", () => setTooltipData(null));

    const drawStackedBar = (group, value, color, yOffset) => {
      if (value > 0) {
        const pixelHeight = (height - margin.bottom - margin.top) * (value / 100);
        group.append("rect")
          .attr("width", xScale.bandwidth())
          .attr("height", pixelHeight)
          .attr("y", -pixelHeight + yOffset)
          .attr("fill", color)
          .attr("rx", 2)
          .attr("ry", 2);
        return yOffset - pixelHeight;
      }
      return yOffset;
    };

    timeSlots.each(function (d) {
      const group = d3.select(this);
      if (d.isActive) {
        let yOffset = 0;
        yOffset = drawStackedBar(group, d.unproductive, UNPRODUCTIVE_COLOR, yOffset);
        yOffset = drawStackedBar(group, d.neutral, NEUTRAL_COLOR, yOffset);
        drawStackedBar(group, d.productive, PRODUCTIVE_COLOR, yOffset);
      } else {
        const inactiveHeight = 15;
        group.append("rect")
          .attr("width", xScale.bandwidth())
          .attr("height", inactiveHeight)
          .attr("y", -inactiveHeight)
          .attr("fill", INACTIVE_COLOR)
          .attr("opacity", 0.5)
          .attr("rx", 1)
          .attr("ry", 1);
      }
    });

    const hourLabels = [];
    for (let hour = 8; hour <= 20; hour += 1) {
      hourLabels.push({
        hour,
        time: `${hour.toString().padStart(2, '0')}:00`
      });
    }

    svg.selectAll(".hour-label")
      .data(hourLabels)
      .enter()
      .append("text")
      .attr("class", "hour-label")
      .attr("x", d => {
        const timeStr = `${d.hour.toString().padStart(2, '0')}:00`;
        const index = productivityData.findIndex(item => item.time === timeStr);
        return index >= 0 ? xScale(productivityData[index].time) + xScale.bandwidth() / 2 : 0;
      })
      .attr("y", height - 10)
      .attr("text-anchor", "middle")
      .attr("font-size", "11px")
      .attr("fill", "#9ca3af")
      .text(d => formatTimeAMPM(d.hour));

    svg.selectAll(".y-label")
      .data([0, 50, 100])
      .enter()
      .append("text")
      .attr("class", "y-label")
      .attr("x", margin.left - 10)
      .attr("y", d => yScale(d))
      .attr("text-anchor", "end")
      .attr("font-size", "11px")
      .attr("fill", "#9ca3af")
      .attr("alignment-baseline", "middle")
      .text(d => `${d}%`);

    svg.append("line")
      .attr("x1", margin.left)
      .attr("x2", margin.left)
      .attr("y1", margin.top)
      .attr("y2", height - margin.bottom)
      .attr("stroke", "#4b5563")
      .attr("stroke-width", 1);

  }, [hourlyData]);

  return (
    <div className="w-full relative">
      {tooltipData && (
        <div
          className="fixed z-50 bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl text-sm min-w-[180px]"
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
            transform: 'translate(-50%, -100%)'
          }}
        >
          <div className="font-semibold mb-2 text-center">{tooltipData.time}</div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: PRODUCTIVE_COLOR }}></div>
                <span className="text-gray-300">Productive:</span>
              </div>
              <span className="font-medium">{tooltipData.productive}%</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: NEUTRAL_COLOR }}></div>
                <span className="text-gray-300">Neutral:</span>
              </div>
              <span className="font-medium">{tooltipData.neutral}%</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: UNPRODUCTIVE_COLOR }}></div>
                <span className="text-gray-300">Unproductive:</span>
              </div>
              <span className="font-medium">{tooltipData.unproductive}%</span>
            </div>
            {!tooltipData.isActive && (
              <div className="pt-1 border-t border-gray-700 mt-1">
                <div className="text-center text-gray-400 text-xs">No activity</div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-center gap-6 mb-4 text-sm flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: PRODUCTIVE_COLOR }}></div>
          <span className="text-gray-300">Productive</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: NEUTRAL_COLOR }}></div>
          <span className="text-gray-300">Neutral</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: UNPRODUCTIVE_COLOR }}></div>
          <span className="text-gray-300">Unproductive</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: INACTIVE_COLOR }}></div>
          <span className="text-gray-300">Inactive</span>
        </div>
      </div>

      <div
        ref={ref}
        className="w-full rounded-lg bg-gray-900 p-4 border border-gray-700"
        style={{ minHeight: '200px' }}
      />
    </div>
  );
};

/* Main Component */
const DoctorDesktime = ({
  userId = null,      // pass when viewing another user's data
  name = null,        // name of the person being viewed
  isDoctor = true     // always true for this component
}) => {
  const isSelf = !userId;

  const baseUrl = '/api/doctor/work-session/';

  const token = typeof window !== 'undefined' ? localStorage.getItem('userToken') : null;


  const [viewMode, setViewMode] = useState('daily');
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);

  const [session, setSession] = useState({
    arrivalTime: null,
    leftTime: null,
    deskTime: 0,
    productiveTime: 0,
    timeAtWork: 0,
    productivity: 0,
    effectiveness: 0,
    hasSignificantBreak: false,
    nextArrivalAfterBreak: null
  });

  const [weeklyStats, setWeeklyStats] = useState({
    totalDeskTime: 0,
    totalProductiveTime: 0,
    avgProductivity: 0,
    totalSessions: 0,
    days: [],
    weekStart: new Date(),
    weekEnd: new Date()
  });

  const [monthlyStats, setMonthlyStats] = useState({
    totalDeskTime: 0,
    totalProductiveTime: 0,
    avgProductivity: 0,
    totalDays: 0,
    weeks: [],
    monthStart: new Date(),
    monthEnd: new Date(),
    monthName: ''
  });


  console.log('Monthly Stats:', monthlyStats);

  const [hourlyData, setHourlyData] = useState({
    hourlyStats: [],
    totalDeskTime: 0,
    totalProductiveTime: 0,
    totalIdleTime: 0,
    date: new Date()
  });

  // Activity tracking & arrival marking only when it's self view
  useEffect(() => {
    if (!isSelf || !token) return;

    let lastActivity = Date.now();
    let idleTimer = null;
    let visibilityInterval = null;

    const IDLE_THRESHOLD = 3 * 60 * 1000;

    const report = async (type, durationSec) => {
      if (durationSec < 1) return;
      try {
        await axios.post(`${baseUrl}${type}`, { duration: durationSec }, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (err) {
        console.error(`Failed to report ${type}:`, err);
      }
    };

    const resetActivity = () => {
      const now = Date.now();
      const elapsed = now - lastActivity;

      if (elapsed >= 1 && document.visibilityState === 'visible') {
        const activeSec = Math.floor(elapsed / 1000);
        report('mouse-activity', activeSec);
      }

      if (elapsed >= IDLE_THRESHOLD) {
        const idleSec = Math.floor((elapsed - IDLE_THRESHOLD) / 1000);
        if (idleSec > 0 && document.visibilityState === 'visible') {
          report('idle', idleSec);
        }
      }

      lastActivity = now;
      clearTimeout(idleTimer);
      idleTimer = null;
    };

    const startIdleTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        const now = Date.now();
        const idleSec = Math.floor((now - lastActivity) / 1000);
        if (idleSec > 0 && document.visibilityState === 'visible') {
          report('idle', idleSec);
        }
      }, IDLE_THRESHOLD + 1000);
    };

    const handleVisibility = () => {
      const now = Date.now();

      if (document.visibilityState === 'visible') {
        const awaySec = Math.floor((now - lastActivity) / 1000);
        if (awaySec >= 30) {
          report('desktime', awaySec);
        }
        lastActivity = now;
        startIdleTimer();
      } else {
        const activeSec = Math.floor((now - lastActivity) / 1000);
        if (activeSec > 0) {
          report('desktime', activeSec);
          report('mouse-activity', activeSec);
        }
        lastActivity = now;
        clearTimeout(idleTimer);
      }
    };

    const handleInput = () => {
      if (document.visibilityState === 'visible') {
        resetActivity();
        startIdleTimer();
      }
    };

    visibilityInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        const elapsed = now - lastActivity;

        if (elapsed >= IDLE_THRESHOLD) {
          const idleSec = Math.floor((elapsed - IDLE_THRESHOLD) / 1000);
          if (idleSec > 0) {
            report('idle', idleSec);
            lastActivity = now - (idleSec * 1000);
          }
        } else if (elapsed >= 5) {
          report('mouse-activity', Math.floor(elapsed / 1000));
          lastActivity = now;
        }
      }
    }, 30000);

    document.addEventListener('visibilitychange', handleVisibility);
    ['mousemove', 'keydown', 'wheel', 'mousedown', 'touchstart'].forEach(evt => {
      window.addEventListener(evt, handleInput, { passive: true });
    });

    lastActivity = Date.now();
    startIdleTimer();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      ['mousemove', 'keydown', 'wheel', 'mousedown', 'touchstart'].forEach(evt => {
        window.removeEventListener(evt, handleInput);
      });
      clearInterval(visibilityInterval);
      clearTimeout(idleTimer);
    };
  }, [isSelf, token, baseUrl]);

  // Mark arrival → only for self
  useEffect(() => {
    if (!isSelf || !token) return;

    const markArrival = async () => {
      try {
        const res = await axios.post(
          `${baseUrl}arrival`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (res.data?.arrivalTime) {
          setSession(prev => ({
            ...prev,
            arrivalTime: new Date(res.data.arrivalTime).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            })
          }));
        }
      } catch (err) {
        console.error('Arrival time error:', err);
      }
    };

    markArrival();
  }, [isSelf, token, baseUrl]);

  // Data loading functions
  const loadHourlyData = async (date = new Date()) => {
    try {
      const formattedDate = date.toISOString().split('T')[0];
      const query = userId ? `?date=${formattedDate}&userId=${userId}` : `?date=${formattedDate}`;
      const res = await axios.get(`${baseUrl}hourly${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data?.success) {
        setHourlyData(res.data.data);
      } else {
        const empty = Array.from({ length: 24 }, (_, h) => ({
          hour: h,
          deskTime: 0,
          productiveTime: 0,
          idleTime: 0,
          productivity: 0
        }));
        setHourlyData({
          hourlyStats: empty,
          totalDeskTime: 0,
          totalProductiveTime: 0,
          totalIdleTime: 0,
          date
        });
      }
    } catch (e) {
      console.error('Load hourly error:', e);
      const empty = Array.from({ length: 24 }, (_, h) => ({
        hour: h,
        deskTime: 0,
        productiveTime: 0,
        idleTime: 0,
        productivity: 0
      }));
      setHourlyData({
        hourlyStats: empty,
        totalDeskTime: 0,
        totalProductiveTime: 0,
        totalIdleTime: 0,
        date
      });
    }
  };

  const loadSession = async () => {
    try {
      const query = userId ? `?userId=${userId}` : '';
      const res = await axios.get(`${baseUrl}today${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    //  try {
    //   const res = await axios.get('/api/doctor/work-session/today', {
    //     headers: { Authorization: `Bearer ${token}` },
    //   });


      if (res.data?.success && res.data.data) {
        const data = res.data.data;

        let hasSignificantBreak = false;
        let nextArrivalAfterBreak = null;
        let displayLeftTime = 'ONLINE';

        if (data.leftTime) {
          const leftTime = new Date(data.leftTime);
          const nextArrival = data.nextArrivalTime ? new Date(data.nextArrivalTime) : null;

          if (nextArrival) {
            const breakDuration = (nextArrival.getTime() - leftTime.getTime()) / (1000 * 60 * 60);
            if (breakDuration >= 5) {
              hasSignificantBreak = true;
              nextArrivalAfterBreak = nextArrival.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              displayLeftTime = leftTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } else {
              displayLeftTime = 'ONLINE';
            }
          } else {
            displayLeftTime = leftTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          }
        }

        const deskTime = data.deskTimeSeconds || 0;
        const productiveTime = data.productiveSeconds || 0;
        const timeAtWork = data.timeAtWorkSeconds || 0;

        const effectiveness = timeAtWork > 0 ? Math.min(100, (productiveTime / timeAtWork) * 100) : 0;
        const workDayHours = 8 * 3600;
        const productivity = workDayHours > 0 ? Math.min(100, (productiveTime / workDayHours) * 100) : 0;

        setSession({
          arrivalTime: data.arrivalTime ? new Date(data.arrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
          leftTime: displayLeftTime,
          deskTime,
          productiveTime,
          timeAtWork,
          productivity,
          effectiveness,
          hasSignificantBreak,
          nextArrivalAfterBreak
        });
      } else if (res.data?.message === 'No session found for today') {
        setSession({
          arrivalTime: null,
          leftTime: null,
          deskTime: 0,
          productiveTime: 0,
          timeAtWork: 0,
          productivity: 0,
          effectiveness: 0,
          hasSignificantBreak: false,
          nextArrivalAfterBreak: null
        });
      }
    } catch (e) {
      console.error('Load session error:', e);
      if (!isSelf) toast.error('Failed to load work session data');
    }
  };

  const loadWeeklyStats = async (offset = 0) => {
    if (!token) return;
    try {
      const query = userId ? `?offset=${offset}&userId=${userId}` : `?offset=${offset}`;
      const res = await axios.get(`${baseUrl}weekly${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.success) {
        setWeeklyStats(res.data.data);
      }
    } catch (e) {
      console.error('Load weekly error:', e);
      if (!isSelf) toast.error('Failed to load weekly stats');
    }
  };

  const loadMonthlyStats = async (offset = 0) => {
    if (!token) return;
    try {
      const query = userId ? `?offset=${offset}&userId=${userId}` : `?offset=${offset}`;
      const res = await axios.get(`${baseUrl}monthly${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.success) {
        setMonthlyStats(res.data.data);
      }
    } catch (e) {
      console.error('Load monthly error:', e);
      if (!isSelf) toast.error('Failed to load monthly stats');
    }
  };

  // Initial & periodic load
  useEffect(() => {
    loadSession();
    loadHourlyData();
    loadWeeklyStats(weekOffset);
    loadMonthlyStats(monthOffset);

    let interval;
    if (isSelf) {
      interval = setInterval(() => {
        loadSession();
        if (viewMode === 'daily') {
          loadHourlyData();
        }
      }, 30000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [weekOffset, monthOffset, viewMode, token, baseUrl, userId, isSelf]);

  const handleViewChange = (mode) => setViewMode(mode);
  const handlePreviousWeek = () => setWeekOffset(p => p - 1);
  const handleNextWeek = () => setWeekOffset(p => p + 1);
  const handlePreviousMonth = () => setMonthOffset(p => p - 1);
  const handleNextMonth = () => setMonthOffset(p => p + 1);

  const getCurrentDateRange = () => {
    const now = new Date();
    switch (viewMode) {
      case 'daily':
        return `Today, ${now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
      case 'weekly':
        const ws = new Date(weeklyStats.weekStart);
        const we = new Date(weeklyStats.weekEnd);
        return `${ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${we.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      case 'monthly':
        return monthlyStats.monthName || now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      default:
        return '';
    }
  };

  const getWeeklyAverageTime = () => {
    const count = weeklyStats.days.filter(d => d.hasSession).length;
    return count > 0 ? Math.round(weeklyStats.totalDeskTime / count) : 0;
  };

  const getMonthlyAverageTime = () => {
    return monthlyStats.totalDays > 0 ? Math.round(monthlyStats.totalDeskTime / monthlyStats.totalDays) : 0;
  };

  const calculateHourlyProductivity = () => {
    return hourlyData.hourlyStats.map(h => ({
      hour: h.hour,
      deskTime: h.deskTime,
      productiveTime: h.productiveTime,
      idleTime: h.idleTime,
      productivity: h.deskTime > 0 ? Math.round((h.productiveTime / h.deskTime) * 100) : 0
    }));
  };

  const calculateTimeAtWork = () => {
    return (session.productiveTime || 0) + (session.deskTime || 0);
  };

  const renderDailyView = () => {
    const hourlyProductivityData = calculateHourlyProductivity();
    const timeAtWork = calculateTimeAtWork();
    const timeAtWorkHours = formatTime(timeAtWork);

    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard title="Arrival Time" value={session.arrivalTime || '—'} color="blue" />
          <StatCard
            title="Logout Time"
            value={session.leftTime || 'ONLINE'}
            color={session.leftTime && session.leftTime !== 'ONLINE' ? 'gray' : 'green'}
          />
          <StatCard title="Productive Time" value={formatTime(session.productiveTime)} color="green" />
          <StatCard title="DeskTime" value={formatTime(session.deskTime)} color="purple" />
        </div>

        {session.hasSignificantBreak && session.nextArrivalAfterBreak && (
          <div className="mb-6 p-4 bg-yellow-900/30 border border-yellow-700 rounded-xl">
            <div className="flex items-center gap-2 text-yellow-300">
              <span className="font-semibold">Break Detected:</span>
              <span>Logged out at {session.leftTime}, returned at {session.nextArrivalAfterBreak} (5+ hour break)</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <StatCard title="Time at Work" value={formatTime(timeAtWork)} color="yellow" fullWidth />
          <div className="lg:col-span-1">
            <div className="bg-gray-800 rounded-xl p-6 h-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Effectiveness</h3>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold mb-2">{session.effectiveness.toFixed(2)}%</div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Productivity Bar</h3>
            <div className="text-sm text-gray-400">Shows time divided into 5-minute segments</div>
          </div>
          <ProductivityBarChart hourlyData={hourlyProductivityData} selectedDate={new Date()} />
        </div>
      </>
    );
  };

  const renderWeeklyView = () => (
    <>
      <div className="flex justify-between items-center mb-6">
        <button onClick={handlePreviousWeek} className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700"><ChevronLeft size={20} /></button>
        <div className="text-center">
          <h2 className="text-xl font-bold">Weekly Overview</h2>
          <p className="text-gray-400">{getCurrentDateRange()}</p>
        </div>
        <button onClick={handleNextWeek} className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700"><ChevronRight size={20} /></button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard title="Total DeskTime" value={formatTime(weeklyStats.totalDeskTime)} color="purple" />
        <StatCard title="Total Productive" value={formatTime(weeklyStats.totalProductiveTime)} color="green" />
        <StatCard title="Avg Effectiveness" value={`${weeklyStats.avgProductivity.toFixed(1)}%`} color="blue" />
        <StatCard title="Avg DeskTime/Day" value={formatTime(getWeeklyAverageTime())} color="yellow" />
      </div>

      <div className="bg-gray-800 rounded-xl p-6 mb-8">
        <h3 className="text-lg font-semibold mb-6">Weekly Breakdown</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
          {weeklyStats.days.map((day, i) => (
            <div key={i} className={`rounded-lg p-4 ${day.hasSession ? 'bg-gray-700' : 'bg-gray-900'}`}>
              <div className="text-center mb-3">
                <div className="text-sm text-gray-400">{day.dayName}</div>
                <div className="text-xs text-gray-500">
                  {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-center">
                  <div className="text-sm text-gray-400">DeskTime</div>
                  <div className="font-semibold">{formatTime(day.deskTime)}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-400">Productive</div>
                  <div className="font-semibold">{formatTime(day.productiveTime)}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-400">Effectiveness</div>
                  <div className={`font-semibold ${productivityTextColor(day.productivity)}`}>{day.productivity}%</div>
                </div>
              </div>
              {!day.hasSession && (
                <div className="text-center mt-3">
                  <div className="text-xs text-gray-500 italic">No session</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );

  const renderMonthlyView = () => (
    <>
      <div className="flex justify-between items-center mb-6">
        <button onClick={handlePreviousMonth} className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700"><ChevronLeft size={20} /></button>
        <div className="text-center">
          <h2 className="text-xl font-bold">Monthly Overview</h2>
          <p className="text-gray-400">{getCurrentDateRange()}</p>
        </div>
        <button onClick={handleNextMonth} className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700"><ChevronRight size={20} /></button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard title="Total DeskTime" value={formatTime(monthlyStats.totalDeskTime)} color="purple" />
        <StatCard title="Total Productive" value={formatTime(monthlyStats.totalProductiveTime)} color="green" />
        <StatCard title="Avg Effectiveness" value={`${monthlyStats.avgProductivity.toFixed(1)}%`} color="blue" />
        <StatCard title="Working Days" value={`${monthlyStats.totalDays} days`} color="yellow" />
      </div>

      <div className="bg-gray-800 rounded-xl p-6 mb-8">
        <h3 className="text-lg font-semibold mb-6">Monthly Breakdown by Week</h3>
        <div className="space-y-4">
          {monthlyStats.weeks.map((week, i) => (
            <div key={i} className="bg-gray-700 rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <div className="font-semibold">Week {week.weekNumber}</div>
                  <div className="text-sm text-gray-400">
                    {new Date(week.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} —
                    {new Date(week.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${productivityTextColor(week.productivity)} ${productivityColor(week.productivity).replace('bg-', 'bg-opacity-20 ')}`}>
                  {week.productivity}%
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-sm text-gray-400">DeskTime</div>
                  <div className="font-semibold">{formatTime(week.deskTime)}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-400">Productive</div>
                  <div className="font-semibold">{formatTime(week.productiveTime)}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-400">Days</div>
                  <div className="font-semibold">{week.days.filter(d => d.hasSession).length}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-400">Avg/Day</div>
                  <div className="font-semibold">
                    {formatTime(week.days.filter(d => d.hasSession).length > 0 ? week.deskTime / week.days.filter(d => d.hasSession).length : 0)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );

  const renderViewContent = () => {
    switch (viewMode) {
      case 'weekly': return renderWeeklyView();
      case 'monthly': return renderMonthlyView();
      default: return renderDailyView();
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Toaster position="top-right" />

      <div className="max-w-7xl mx-auto p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">
              {name ? `${name}'s DeskTime` : 'My DeskTime'}
            </h1>
            <p className="text-gray-400 mt-1">{getCurrentDateRange()}</p>
          </div>

          <div className="flex flex-wrap gap-3 mt-4 md:mt-0">
            <button
              onClick={() => handleViewChange('daily')}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 ${viewMode === 'daily' ? 'bg-cyan-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
            >
              <Calendar size={18} /> Daily
            </button>
            <button
              onClick={() => handleViewChange('weekly')}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 ${viewMode === 'weekly' ? 'bg-cyan-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
            >
              <TrendingUp size={18} /> Weekly
            </button>
            <button
              onClick={() => handleViewChange('monthly')}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 ${viewMode === 'monthly' ? 'bg-cyan-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
            >
              <PieChart size={18} /> Monthly
            </button>
          </div>
        </div>

        <style jsx global>{`
          ::-webkit-scrollbar { display: none; }
          -ms-overflow-style: none;
          scrollbar-width: none;
        `}</style>

        {renderViewContent()}
      </div>
    </div>
  );
};

export default DoctorDesktime;