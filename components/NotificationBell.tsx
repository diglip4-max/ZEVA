// NotificationBell.tsx
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { io, Socket } from "socket.io-client";
import { jwtDecode } from "jwt-decode";
import { 
  BellIcon, 
  XMarkIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentTextIcon,
  UserCircleIcon,
  CalendarIcon,
  TagIcon,
  ArrowTopRightOnSquareIcon,
  EnvelopeIcon,
  EyeIcon,
  PaperClipIcon
} from "@heroicons/react/24/outline";
import { CheckCircleIcon as CheckCircleSolid } from "@heroicons/react/24/solid";

interface AppNotification {
  _id: string;
  message: string;
  isRead: boolean;
  type?: string;
  relatedBlog?: string;
  relatedComment?: string;
  relatedJob?: string;
  relatedAcknowledgment?: string;
  createdAt: string;
}

interface DecodedToken {
  userId?: string;
  id?: string;
  [key: string]: unknown;
}

let socket: Socket | null = null;

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showPanel, setShowPanel] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [selected, setSelected] = useState<AppNotification | null>(null);
  const [ackDetails, setAckDetails] = useState<any | null>(null);
  const [docDetails, setDocDetails] = useState<any | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    setIsClient(true);
    const t =
      (typeof window !== "undefined" && (localStorage.getItem("agentToken") || localStorage.getItem("userToken"))) ||
      null;
    if (!t) return;
    setToken(t);

    // Type assertion to satisfy TS
    const decoded = jwtDecode(t) as DecodedToken;
    const uid = decoded.userId || decoded.id as string | undefined;
    if (!uid) return;
    setUserId(uid);

    fetch(`/api/push-notification/reply-notifications?userId=${uid}`)
      .then((res) => res.json())
      .then((data) => setNotifications(data.notifications || []))
      .catch((err) => console.error("Error fetching notifications:", err));

    socket = io({ path: "/api/push-notification/socketio" });
    socket.emit("register", uid);

    socket.on("newNotification", (notif: AppNotification) => {
      if (Notification.permission === "granted") {
        new Notification("New Notification", { body: notif.message });
      }
      setNotifications((prev) => [{ ...notif, isRead: false }, ...prev]);
    });

    if (Notification.permission !== "granted") {
      Notification.requestPermission();
    }

    return () => {
      socket?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (showPanel) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showPanel]);

  const handleTogglePanel = () => {
    const newState = !showPanel;
    setShowPanel(newState);

    if (newState && unreadCount > 0) {
      fetch(`/api/push-notification/mark-read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: notifications.filter((n) => !n.isRead).map((n) => n._id),
        }),
      }).then(() => {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      });
    }
  };

  const deleteNotification = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    fetch(`/api/push-notification/delete-notification?id=${id}`, { method: "DELETE" })
      .then((res) => res.json())
      .then(() => {
        setNotifications((prev) => prev.filter((n) => n._id !== id));
        if (selected?._id === id) {
          setSelected(null);
          setAckDetails(null);
        }
      })
      .catch((err) => console.error("Delete error:", err));
  };

  const clearAllNotifications = () => {
    if (!userId) return;
    fetch(`/api/push-notification/clearAll-notification?userId=${userId}`, {
      method: "DELETE",
    })
      .then((res) => res.json())
      .then(() => {
        setNotifications([]);
        setSelected(null);
        setAckDetails(null);
      })
      .catch((err) => console.error("Clear all error:", err));
  };

  const openAckDetails = async (n: AppNotification) => {
    setSelected(n);
    setAckDetails(null);
    setDocDetails(null);
    if (n.relatedAcknowledgment) {
      try {
        const res = await fetch(`/api/compliance/acknowledgments?id=${n.relatedAcknowledgment}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const json = await res.json();
        if (json.success) {
          setAckDetails(json.item);
          if (json.item.status !== "Acknowledged") {
            try {
              await fetch(`/api/compliance/acknowledgments`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({ acknowledgmentId: json.item._id, status: "Viewed" }),
              });
              setAckDetails((prev: any) => prev ? { ...prev, status: "Viewed" } : prev);
            } catch {}
          }
          try {
            const t = json.item.documentType;
            const id = json.item.documentId;
            const endpoint = t === "SOP" ? `/api/compliance/sops?id=${id}` : t === "Policy" ? `/api/compliance/policies?id=${id}` : `/api/compliance/playbooks?id=${id}`;
            const r2 = await fetch(endpoint, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
            const j2 = await r2.json();
            if (j2.success && j2.item) setDocDetails(j2.item);
          } catch {}
        }
      } catch (e) {}
    }
  };

  const markAckStatus = async (status: "Viewed" | "Acknowledged") => {
    if (!ackDetails) return;
    try {
      const res = await fetch(`/api/compliance/acknowledgments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ acknowledgmentId: ackDetails._id, status }),
      });
      const json = await res.json();
      if (json.success) {
        setAckDetails(json.item);
      }
    } catch (e) {}
  };

  const getNotificationIcon = (type?: string) => {
    switch(type) {
      case 'acknowledgment':
        return <DocumentTextIcon className="h-5 w-5 text-blue-500" />;
      case 'blog-reply':
        return <EnvelopeIcon className="h-5 w-5 text-green-500" />;
      case 'job-status':
        return <CheckCircleIcon className="h-5 w-5 text-purple-500" />;
      default:
        return <BellIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'Acknowledged':
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircleSolid className="h-3 w-3 mr-1" /> Acknowledged</span>;
      case 'Viewed':
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"><EyeIcon className="h-3 w-3 mr-1" /> Viewed</span>;
      default:
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><ClockIcon className="h-3 w-3 mr-1" /> Pending</span>;
    }
  };

  const filteredNotifications = activeTab === 'unread' 
    ? notifications.filter(n => !n.isRead)
    : notifications;

  return (
    <div className="relative">
      <button 
        onClick={handleTogglePanel} 
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-white border border-gray-200 shadow-sm hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2" 
        aria-label="Open notifications"
      >
        <BellIcon className="h-5 w-5 text-gray-600"/>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-r from-red-500 to-red-600 text-white text-xs font-bold shadow-sm">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showPanel && isClient && createPortal(
        <div className="fixed inset-0 z-[1000]">
          <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity" onClick={handleTogglePanel} />
          
          {/* Main Panel */}
          <div className="absolute right-4 top-20 bottom-4 w-[480px] rounded-2xl bg-white border border-gray-200 shadow-2xl flex flex-col overflow-hidden animate-slide-in-right">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
                  <BellIcon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
                  <p className="text-xs text-gray-500">Stay updated with your activities</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={clearAllNotifications} 
                  className="text-xs px-3 py-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors duration-200 font-medium"
                >
                  Clear All
                </button>
                <button 
                  onClick={handleTogglePanel} 
                  className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-gray-200/50 transition-colors duration-200"
                >
                  <XMarkIcon className="h-5 w-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100 px-6 pt-2">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors duration-200 ${
                  activeTab === 'all' 
                    ? 'border-blue-500 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                All ({notifications.length})
              </button>
              {/* <button
                onClick={() => setActiveTab('unread')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors duration-200 ${
                  activeTab === 'unread' 
                    ? 'border-blue-500 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Unread ({unreadCount})
              </button> */}
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto bg-gray-50/50">
              {filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-8">
                  <div className="h-20 w-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                    <BellIcon className="h-10 w-10 text-gray-400" />
                  </div>
                  <p className="text-gray-500 text-sm font-medium">No notifications</p>
                  <p className="text-gray-400 text-xs mt-1">You're all caught up!</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredNotifications.map((n) => (
                    <button
                      key={n._id}
                      className={`w-full text-left p-4 hover:bg-gray-50 transition-colors duration-200 group ${
                        selected?._id === n._id ? 'bg-blue-50/50' : ''
                      } ${!n.isRead ? 'bg-white' : 'bg-gray-50/50'}`}
                      onClick={() => {
                        if (n.type === "acknowledgment") {
                          openAckDetails(n);
                        } else if (n.type === "blog-reply" && n.relatedBlog) {
                          window.location.href = `/blogs/${n.relatedBlog}#${n.relatedComment}`;
                        } else if (n.type === "job-status" && n.relatedJob) {
                          window.location.href = `/job-details/${n.relatedJob}`;
                        }
                      }}
                    >
                      <div className="flex gap-3">
                        <div className="flex-shrink-0 mt-1">
                          {getNotificationIcon(n.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-sm ${!n.isRead ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                              {n.message}
                            </p>
                            <button
                              onClick={(e) => deleteNotification(n._id, e)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 hover:bg-red-50 rounded"
                            >
                              <XMarkIcon className="h-4 w-4 text-gray-400 hover:text-red-500" />
                            </button>
                          </div>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-xs text-gray-400">
                              {new Date(n.createdAt).toLocaleString()}
                            </span>
                            {!n.isRead && (
                              <span className="inline-flex h-2 w-2 rounded-full bg-blue-500"></span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Acknowledgment Details Modal */}
            {selected && ackDetails && (
              <div className="border-t border-gray-200 bg-white rounded-t-2xl shadow-lg">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <DocumentTextIcon className="h-5 w-5 text-blue-600" />
                      <h3 className="text-sm font-semibold text-gray-900">Acknowledgment Details</h3>
                    </div>
                    <button 
                      onClick={() => {
                        setSelected(null);
                        setAckDetails(null);
                      }}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <XMarkIcon className="h-4 w-4 text-gray-500" />
                    </button>
                  </div>
                  
                  <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2">
                        <UserCircleIcon className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500">Staff Name</p>
                          <p className="text-sm font-medium text-gray-900">{ackDetails.staffName || '-'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <TagIcon className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500">Role</p>
                          <p className="text-sm font-medium text-gray-900 capitalize">{ackDetails.role || '-'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <DocumentTextIcon className="h-4 w-4 text-gray-400" />
                        <div className="flex-1">
                          <p className="text-xs text-gray-500">Document Name</p>
                          <p className="text-sm font-medium text-gray-900">{ackDetails.documentName || '-'}</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center gap-2">
                          <TagIcon className="h-4 w-4 text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-500">Type</p>
                            <p className="text-sm font-medium text-gray-900">{ackDetails.documentType || '-'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <TagIcon className="h-4 w-4 text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-500">Version</p>
                            <p className="text-sm font-medium text-gray-900">{ackDetails.version || '-'}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {getStatusBadge(ackDetails.status)}
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4 text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-500">Assigned Date</p>
                            <p className="text-sm text-gray-900">
                              {ackDetails.assignedDate ? new Date(ackDetails.assignedDate).toLocaleDateString() : '-'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4 text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-500">Due Date</p>
                            <p className="text-sm text-gray-900">
                              {ackDetails.dueDate ? new Date(ackDetails.dueDate).toLocaleDateString() : '-'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {ackDetails.acknowledgedOn && (
                        <div className="flex items-center gap-2">
                          <CheckCircleIcon className="h-4 w-4 text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-500">Acknowledged On</p>
                            <p className="text-sm text-gray-900">
                              {new Date(ackDetails.acknowledgedOn).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {docDetails && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          {ackDetails.documentType === "SOP" && (
                            <>
                              <div className="flex items-center gap-2">
                                <TagIcon className="h-4 w-4 text-gray-400" />
                                <div>
                                  <p className="text-xs text-gray-500">Category</p>
                                  <p className="text-sm font-medium text-gray-900">{docDetails.category || "-"}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <TagIcon className="h-4 w-4 text-gray-400" />
                                <div>
                                  <p className="text-xs text-gray-500">Risk Level</p>
                                  <p className="text-sm font-medium text-gray-900">{docDetails.riskLevel || "-"}</p>
                                </div>
                              </div>
                            </>
                          )}
                          {ackDetails.documentType === "Policy" && (
                            <div className="flex items-center gap-2">
                              <TagIcon className="h-4 w-4 text-gray-400" />
                              <div>
                                <p className="text-xs text-gray-500">Policy Type</p>
                                <p className="text-sm font-medium text-gray-900">{docDetails.policyType || "-"}</p>
                              </div>
                            </div>
                          )}
                          {ackDetails.documentType === "Playbook" && (
                            <>
                              <div className="flex items-center gap-2">
                                <TagIcon className="h-4 w-4 text-gray-400" />
                                <div>
                                  <p className="text-xs text-gray-500">Trigger</p>
                                  <p className="text-sm font-medium text-gray-900">{docDetails.triggerCondition || "-"}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <UserCircleIcon className="h-4 w-4 text-gray-400" />
                                <div>
                                  <p className="text-xs text-gray-500">Owner</p>
                                  <p className="text-sm font-medium text-gray-900">{docDetails.ownerName || "-"}</p>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap gap-2 pt-2">
                          {docDetails.documentUrl && (
                            <button 
                              onClick={() => window.open(docDetails.documentUrl, "_blank")}
                              className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-1"
                            >
                              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                              View Document
                            </button>
                          )}
                          {/* {Array.isArray(docDetails.attachments) && docDetails.attachments.length > 0 && docDetails.attachments.map((a: string, idx: number) => (
                            <button
                              key={`${a}-${idx}`}
                              onClick={() => window.open(a, "_blank")}
                              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1"
                            >
                              <PaperClipIcon className="h-4 w-4" />
                              {(a && typeof a === "string" && a.split("/").pop()) || `Attachment ${idx + 1}`}
                            </button>
                          ))} */}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex justify-end gap-2">
                    {ackDetails.status !== "Acknowledged" && (
                      <>
                        {/* <button 
                          onClick={() => markAckStatus("Viewed")} 
                          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
                        >
                          Mark as Viewed
                        </button> */}
                        <button 
                          onClick={() => markAckStatus("Acknowledged")} 
                          className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-sm flex items-center gap-1"
                        >
                          <CheckCircleSolid className="h-4 w-4" />
                          Acknowledge
                        </button>
                      </>
                    )}
                    {ackDetails.status === "Acknowledged" && (
                      <button 
                        className="px-4 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg flex items-center gap-1"
                      >
                        <CheckCircleSolid className="h-4 w-4" />
                        Acknowledged
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      <style jsx>{`
        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        .animate-slide-in-right {
          animation: slideInRight 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
