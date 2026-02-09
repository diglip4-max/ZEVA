// // pages/staff/desktime/index.jsx
// 'use client';
// import React, { useEffect, useRef, useState } from 'react';
// import AgentLayout from '../../../components/AgentLayout';
// import withAgentAuth from '../../../components/withAgentAuth';
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
// import html2canvas from 'html2canvas';

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

// /* main component */
// const DeskTimeDashboard = () => {
//   const [viewMode, setViewMode] = useState('daily');
//   const [weekOffset, setWeekOffset] = useState(0);
//   const [monthOffset, setMonthOffset] = useState(0);

//   console.log('Render view mode:', viewMode);

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


//   console.log('Render session:', session);
//   const token = typeof window !== 'undefined' ? localStorage.getItem('agentToken') : null;
//   const doctorAgentToken = typeof window !== 'undefined' ? localStorage.getItem('userToken') : null;

//   console.log('Render Agent Token:', token ? `${token.substring(0, 100)}...` : 'No Token');
//   console.log('Render Doctor Token:', doctorAgentToken ?  `${doctorAgentToken.substring(0, 100)}...` : 'No Token');

//   // now correctly reports productive time + idle + desktime
//   useEffect(() => {
//     if (!token) return;

//     let lastActivity = Date.now();
//     let idleTimer = null;
//     let visibilityInterval = null;

//     const IDLE_THRESHOLD = 3 * 60 * 1000; // 3 minutes

//     const report = async (type, durationSec) => {
//       if (durationSec < 1) return;
//       try {
//         await axios.post(`/api/agent/work-session/${type}`, { duration: durationSec }, {
//           headers: { Authorization: `Bearer ${token}` },
//         });
//         console.log(`Reported ${type}: ${durationSec}s`);
//       } catch (err) {
//         console.error(`Failed to report ${type}:`, err);
//       }
//     };

//     // Reset + report productive time when user interacts
//     const resetActivity = () => {
//       const now = Date.now();
//       const elapsed = now - lastActivity;

//       // Report productive time for the active period
//       if (elapsed >= 1 && document.visibilityState === 'visible') {
//         const activeSec = Math.floor(elapsed / 1000);
//         report('mouse-activity', activeSec);
//       }

//       // If long enough → also report idle before activity resumed
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

//     // Start idle timer
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

//     // Visibility handling
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

//     // Input events trigger productive time
//     const handleInput = () => {
//       if (document.visibilityState === 'visible') {
//         resetActivity();
//         startIdleTimer();
//       }
//     };

//     // Safety net (every 30s)
//     visibilityInterval = setInterval(() => {
//       if (document.visibilityState === 'visible') {
//         const now = Date.now();
//         const elapsed = now - lastActivity;

//         if (elapsed >= IDLE_THRESHOLD) {
//           const idleSec = Math.floor((elapsed - IDLE_THRESHOLD) / 1000);
//           if (idleSec > 0) {
//             report('idle', idleSec);
//             lastActivity = now - (idleSec * 1000); // adjust
//           }
//         } else if (elapsed >= 5) { // report small productive chunks
//           report('mouse-activity', Math.floor(elapsed / 1000));
//           lastActivity = now;
//         }
//       }
//     }, 30000);

//     // Attach listeners
//     document.addEventListener('visibilitychange', handleVisibility);
//     ['mousemove', 'keydown', 'wheel', 'mousedown', 'touchstart'].forEach(evt => {
//       window.addEventListener(evt, handleInput, { passive: true });
//     });

//     // Initial start
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

//   /* fetch today session with break detection */
//   useEffect(() => {
//     if (!token) return;

//     const markArrival = async () => {
//       try {
//         const res = await axios.post(
//           '/api/agent/work-session/arrival',
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

//   const loadHourlyData = async (date = new Date()) => {
//     try {
//       const formattedDate = date.toISOString().split('T')[0];
//       const res = await axios.get(`/api/agent/work-session/hourly?date=${formattedDate}`, {
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
//       const res = await axios.get('/api/agent/work-session/today', {
//         headers: { Authorization: `Bearer ${token}` },
//       });

//       if (res.data?.success && res.data.data) {
//         const data = res.data.data;

//         let hasSignificantBreak = false;
//         let nextArrivalAfterBreak = null;
//         let displayLeftTime = 'ONLINE';

//         // let displayLeftTime = res.data.data.leftTime;
//         // console.log('display left time init:', displayLeftTime);

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

//         console.log('Session data:', {
//           deskTime: `${formatTime(deskTime)} (time on  website)`,
//           productiveTime: `${formatTime(productiveTime)} (mouse activity in DeskTime)`,
//           effectiveness: `${effectiveness.toFixed(2)}% (productive/desktime)`,
//           productivity: `${productivity.toFixed(2)}% (productive/8hr workday)`
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


 

//   const loadWeeklyStats = async (offset = 0) => {
//     if (!token) return;

//     try {
//       const res = await axios.get(`/api/agent/work-session/weekly?offset=${offset}`, {
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

//   // Load monthly stats
//   const loadMonthlyStats = async (offset = 0) => {
//     if (!token) return;

//     try {
//       const res = await axios.get(`/api/agent/work-session/monthly?offset=${offset}`, {
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


//   const calculateTimeAtWork = () => {
//     const productive = session.productiveTime || 0;
//     const desk = session.deskTime || 0;

//     return productive + desk;
//   };


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
//       {/* Weekly Navigation */}
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

//       {/* Weekly Stats Grid */}
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

//       {/* Weekly Days Grid */}
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
//       {/* Monthly Navigation */}
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

//       {/* Monthly Stats Grid */}
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

//       {/* Monthly Weeks Grid */}
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


// /* Stat Card Component with tooltip */
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

//     // Scale for the 5-min slots (288 slots = 24h × 12)
//     const x = d3.scaleBand()
//       .domain(buckets.map(d => d.index))
//       .range([50, width - 30])
//       .paddingInner(0.6)     // space between groups
//       .paddingOuter(0.2);

//     const subX = d3.scaleBand()
//       .domain([0, 1, 2])     // 0=productive, 1=non-prod desk, 2=idle
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

// // const HourlyProductivityChart = ({ hourlyData }) => {
// //   const ref = useRef(null);

// //   // Helper to format time for display
// //   const formatIntervalTime = (hour, minute) => {
// //     const ampm = hour >= 12 ? 'PM' : 'AM';
// //     const adjustedHour = hour % 12 === 0 ? 12 : hour % 12;
// //     return `${adjustedHour}:${minute.toString().padStart(2, '0')} ${ampm}`;
// //   };

// //   // Helper to format hour label at bottom
// //   const formatHourLabel = (hour) => {
// //     const ampm = hour >= 12 ? 'PM' : 'AM';
// //     const adjustedHour = hour % 12 === 0 ? 12 : hour % 12;
// //     return `${adjustedHour} ${ampm}`;
// //   };

// //   useEffect(() => {
// //     if (!hourlyData?.length) return;

// //     const width = ref.current.clientWidth;
// //     const height = 350;

// //     d3.select(ref.current).selectAll('*').remove();

// //     const svg = d3.select(ref.current)
// //       .append('svg')
// //       .attr('width', width)
// //       .attr('height', height);

// //     // Constants for 5-minute intervals
// //     const START_HOUR = 8;
// //     const END_HOUR = 21; // 8 PM is 20:00, we go to 21 for exclusive
// //     const TOTAL_INTERVALS = (END_HOUR - START_HOUR) * 12; // 13 hours * 12 intervals/hour = 156 intervals
    
// //     // Maximum seconds in a 5-minute interval (300 seconds)
// //     const MAX_INTERVAL_SECONDS = 300;

// //     // Create array for all 5-minute intervals
// //     const intervals = Array.from({ length: TOTAL_INTERVALS }, (_, i) => {
// //       const totalMinutes = i * 5;
// //       const hour = START_HOUR + Math.floor(totalMinutes / 60);
// //       const minute = totalMinutes % 60;
      
// //       // Find which hourly bucket this belongs to
// //       const hourData = hourlyData.find(h => h.hour === hour);
      
// //       if (hourData) {
// //         // Distribute data across 12 intervals (5 minutes each)
// //         const deskTimePerInterval = (hourData.deskTime || 0) / 12;
// //         const productiveTimePerInterval = (hourData.productiveTime || 0) / 12;
// //         const idleTimePerInterval = (hourData.idleTime || 0) / 12;
        
// //         // Calculate percentages for the 5-minute interval
// //         const deskTimePct = Math.min(100, (deskTimePerInterval / MAX_INTERVAL_SECONDS) * 100);
// //         const productiveTimePct = Math.min(100, (productiveTimePerInterval / MAX_INTERVAL_SECONDS) * 100);
// //         const idleTimePct = Math.min(100, (idleTimePerInterval / MAX_INTERVAL_SECONDS) * 100);
        
// //         return {
// //           index: i,
// //           hour: hour,
// //           minute: minute,
// //           deskTime: deskTimePerInterval,
// //           productiveTime: productiveTimePerInterval,
// //           idleTime: idleTimePerInterval,
// //           deskTimePct: deskTimePct,
// //           productiveTimePct: productiveTimePct,
// //           idleTimePct: idleTimePct,
// //           timeLabel: formatIntervalTime(hour, minute),
// //           isHourStart: minute === 0
// //         };
// //       }
      
// //       // No data for this hour
// //       return {
// //         index: i,
// //         hour: hour,
// //         minute: minute,
// //         deskTime: 0,
// //         productiveTime: 0,
// //         idleTime: 0,
// //         deskTimePct: 0,
// //         productiveTimePct: 0,
// //         idleTimePct: 0,
// //         timeLabel: formatIntervalTime(hour, minute),
// //         isHourStart: minute === 0
// //       };
// //     });

// //     // Create x scale for intervals
// //     const x = d3.scaleBand()
// //       .domain(intervals.map(d => d.index))
// //       .range([70, width - 40]) // Increased left margin for y-axis labels
// //       .padding(0.1);

// //     // Create y scale for percentage (0-100%)
// //     const y = d3.scaleLinear()
// //       .domain([0, 100])
// //       .range([height - 80, 40]); // Increased bottom margin for hour labels

// //     // Draw y-axis with labels and grid lines
// //     const yAxisLabels = [0, 25, 50, 75, 100];
    
// //     // Y-axis line
// //     svg.append('line')
// //       .attr('x1', 65)
// //       .attr('y1', height - 80)
// //       .attr('x2', 65)
// //       .attr('y2', 40)
// //       .attr('stroke', '#4b5563')
// //       .attr('stroke-width', 1);

// //     // Y-axis labels and grid lines
// //     yAxisLabels.forEach(value => {
// //       // Grid line (across the whole chart)
// //       svg.append('line')
// //         .attr('x1', 70)
// //         .attr('y1', y(value))
// //         .attr('x2', width - 40)
// //         .attr('y2', y(value))
// //         .attr('stroke', '#374151')
// //         .attr('stroke-width', 0.5)
// //         .attr('stroke-dasharray', '2,2');

// //       // Label
// //       svg.append('text')
// //         .attr('x', 55)
// //         .attr('y', y(value))
// //         .attr('text-anchor', 'end')
// //         .attr('font-size', '11px')
// //         .attr('fill', '#9ca3af')
// //         .attr('dominant-baseline', 'middle')
// //         .text(`${value}%`);
// //     });

// //     // Draw the 5-minute interval bars
// //     intervals.forEach(interval => {
// //       const group = svg.append('g')
// //         .attr('class', 'interval-group')
// //         .attr('transform', `translate(${x(interval.index)}, 0)`);

// //       // Draw stacked bars with different shades of green
// //       const barWidth = x.bandwidth();
      
// //       // DeskTime bar (lightest green) - full height based on deskTimePct
// //       if (interval.deskTimePct > 0) {
// //         const deskTimeHeight = y(0) - y(interval.deskTimePct);
// //         group.append('rect')
// //           .attr('x', 0)
// //           .attr('y', y(interval.deskTimePct))
// //           .attr('width', barWidth)
// //           .attr('height', deskTimeHeight)
// //           .attr('fill', '#86efac') // Light green for DeskTime
// //           .attr('rx', 1)
// //           .attr('ry', 1)
// //           .attr('data-type', 'desktime')
// //           .attr('data-interval-index', interval.index);
// //       }

// //       // Productive bar (medium green) - stacked on top of DeskTime
// //       if (interval.productiveTimePct > 0) {
// //         const productiveHeight = y(0) - y(interval.productiveTimePct);
// //         group.append('rect')
// //           .attr('x', 0)
// //           .attr('y', y(interval.productiveTimePct))
// //           .attr('width', barWidth)
// //           .attr('height', productiveHeight)
// //           .attr('fill', '#22c55e') // Medium green for Productive
// //           .attr('rx', 1)
// //           .attr('ry', 1)
// //           .attr('data-type', 'productive')
// //           .attr('data-interval-index', interval.index);
// //       }

// //       // Idle bar (darkest green) - represents the gap between DeskTime and 100%
// //       if (interval.idleTimePct > 0) {
// //         // Idle is the time when not at desk, so it goes from deskTimePct to 100%
// //         const idleStartPct = interval.deskTimePct;
// //         const idleHeight = y(idleStartPct) - y(100);
// //         group.append('rect')
// //           .attr('x', 0)
// //           .attr('y', y(100))
// //           .attr('width', barWidth)
// //           .attr('height', idleHeight)
// //           .attr('fill', '#14532d') // Dark green for Idle
// //           .attr('rx', 1)
// //           .attr('ry', 1)
// //           .attr('data-type', 'idle')
// //           .attr('data-interval-index', interval.index);
// //       }
// //     });

// //     // Draw hour labels at the bottom
// //     for (let hour = START_HOUR; hour < END_HOUR; hour++) {
// //       const intervalIndex = (hour - START_HOUR) * 12;
// //       const xPos = x(intervalIndex) + (x.bandwidth() * 6); // Center of the hour block
      
// //       svg.append('text')
// //         .attr('x', xPos)
// //         .attr('y', height - 50)
// //         .attr('text-anchor', 'middle')
// //         .attr('font-size', '11px')
// //         .attr('fill', '#9ca3af')
// //         .attr('font-weight', '500')
// //         .text(formatHourLabel(hour));
// //     }

// //     // Draw baseline at 0%
// //     svg.append('line')
// //       .attr('x1', 70)
// //       .attr('y1', height - 80)
// //       .attr('x2', width - 40)
// //       .attr('y2', height - 80)
// //       .attr('stroke', '#4b5563')
// //       .attr('stroke-width', 1);

// //     // Tooltip
// //     const tooltip = d3.select("body")
// //       .append("div")
// //       .style("position", "absolute")
// //       .style("visibility", "hidden")
// //       .style("background", "rgba(0,0,0,0.95)")
// //       .style("color", "white")
// //       .style("padding", "12px 16px")
// //       .style("border-radius", "8px")
// //       .style("font-size", "13px")
// //       .style("pointer-events", "none")
// //       .style("z-index", "10000")
// //       .style("border", "1px solid #4b5563")
// //       .style("min-width", '200px')
// //       .style("box-shadow", "0 4px 12px rgba(0,0,0,0.3)");

// //     // Add hover effects to all bars
// //     svg.selectAll('rect')
// //       .on("mouseover", function (event) {
// //         const intervalIndex = parseInt(d3.select(this).attr('data-interval-index'));
// //         const barType = d3.select(this).attr('data-type');
// //         const interval = intervals[intervalIndex];
        
// //         if (!interval) return;

// //         const nextMinute = interval.minute + 5;
// //         const endHour = nextMinute === 60 ? interval.hour + 1 : interval.hour;
// //         const endMinute = nextMinute === 60 ? 0 : nextMinute;
        
// //         const timeRange = `${formatIntervalTime(interval.hour, interval.minute)} - ${formatIntervalTime(endHour, endMinute)}`;
        
// //         let barColor, barLabel;
// //         switch(barType) {
// //           case 'desktime':
// //             barColor = '#86efac';
// //             barLabel = 'DeskTime';
// //             break;
// //           case 'productive':
// //             barColor = '#22c55e';
// //             barLabel = 'Productive';
// //             break;
// //           case 'idle':
// //             barColor = '#14532d';
// //             barLabel = 'Idle';
// //             break;
// //         }

// //         tooltip
// //           .style("visibility", "visible")
// //           .html(`
// //             <div style="font-weight: 600; margin-bottom: 6px; color: #f3f4f6">${timeRange}</div>
// //             <div style="border-top: 1px solid #4b5563; padding-top: 6px;">
// //               <div style="display: flex; align-items: center; margin-bottom: 4px;">
// //                 <div style="width: 12px; height: 12px; background:${barColor}; margin-right: 8px; border-radius: 2px;"></div>
// //                 <span style="font-weight: 500">${barLabel}:</span>
// //                 <span style="margin-left: auto; font-weight: 600">
// //                   ${barType === 'desktime' ? `${Math.round(interval.deskTimePct)}% (${formatTime(Math.round(interval.deskTime))})` :
// //                     barType === 'productive' ? `${Math.round(interval.productiveTimePct)}% (${formatTime(Math.round(interval.productiveTime))})` :
// //                     `${Math.round(interval.idleTimePct)}% (${formatTime(Math.round(interval.idleTime))})`}
// //                 </span>
// //               </div>
// //               <div style="font-size: 12px; color: #d1d5db; margin-top: 4px;">
// //                 Hover over other bars in this time slot to see all metrics
// //               </div>
// //             </div>
// //           `)
// //           .style("left", (event.pageX + 15) + "px")
// //           .style("top", (event.pageY - 10) + "px");

// //         // Highlight all bars in this interval
// //         d3.select(ref.current).selectAll(`rect[data-interval-index="${intervalIndex}"]`)
// //           .attr('opacity', 0.8)
// //           .attr('stroke', '#ffffff')
// //           .attr('stroke-width', '1');
// //       })
// //       .on("mousemove", function (event) {
// //         tooltip
// //           .style("left", (event.pageX + 15) + "px")
// //           .style("top", (event.pageY - 10) + "px");
// //       })
// //       .on("mouseout", function () {
// //         tooltip.style("visibility", "hidden");
// //         const intervalIndex = parseInt(d3.select(this).attr('data-interval-index'));
// //         d3.select(ref.current).selectAll(`rect[data-interval-index="${intervalIndex}"]`)
// //           .attr('opacity', 1)
// //           .attr('stroke', 'none');
// //       });

// //   }, [hourlyData]);

// //   return (
// //     <div className="w-full">
// //       {/* <div className="flex justify-center gap-6 text-sm text-gray-400 mb-4 px-2">
// //         <div className="flex items-center gap-2">
// //           <div className="w-3 h-3 bg-green-300 rounded"></div>
// //           <span>DeskTime</span>
// //         </div>
// //         <div className="flex items-center gap-2">
// //           <div className="w-3 h-3 bg-green-500 rounded"></div>
// //           <span>Productive</span>
// //         </div>
// //         <div className="flex items-center gap-2">
// //           <div className="w-3 h-3 bg-green-800 rounded"></div>
// //           <span>Idle</span>
// //         </div>
// //       </div> */}
      
// //       <div
// //         ref={ref}
// //         className="w-full rounded bg-gray-900 overflow-hidden"
// //         style={{ minHeight: '280px' }}
// //       />
// // {/*       
// //       <div className="text-xs text-gray-500 mt-2 text-center">
// //         Each bar represents a 5-minute interval (8 AM - 8 PM)
// //       </div> */}
// //     </div>
// //   );
// // };



// DeskTimeDashboard.getLayout = function PageLayout(page) {
//   return <AgentLayout>{page}</AgentLayout>;
// };
// // const ProtectedDeskTimeDashboard = withStaffAuth(DeskTimeDashboard);
// const ProtectedDeskTimeDashboard = withAgentAuth(DeskTimeDashboard);
// ProtectedDeskTimeDashboard.getLayout = DeskTimeDashboard.getLayout;
// export default ProtectedDeskTimeDashboard;

// pages/staff/desktime/index.jsx
'use client';
import React from 'react';
import AgentLayout from '../../../components/AgentLayout';
import AgentDesktime from '../../../components/AgentDesktime';
import AgentDesktimeTracker from '../../../components/AgentDesktimeTracker';


const AgentDesktimeDashboard = () => {
 return (
    <>
      <AgentDesktime />
      <AgentDesktimeTracker />
    </>
  );
}

// Add layout function to the component
AgentDesktimeDashboard.getLayout = function PageLayout(page) {
  return <AgentLayout>{page}</AgentLayout>;
};

export default AgentDesktimeDashboard;
