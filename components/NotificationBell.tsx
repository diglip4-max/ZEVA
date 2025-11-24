import { useState, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { jwtDecode } from "jwt-decode";

interface Notification {
  _id: string;
  message: string;
  isRead: boolean;
  type?: string;
  relatedBlog?: string;
  relatedComment?: string;
  relatedJob?: string;
  createdAt: string;
}

interface DecodedToken {
  userId: string;
  [key: string]: unknown;
}

let socket: Socket | null = null;

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    // Type assertion to satisfy TS
    const decoded = jwtDecode(token) as DecodedToken;
    setUserId(decoded.userId);

    fetch(`/api/push-notification/reply-notifications?userId=${decoded.userId}`)
      .then((res) => res.json())
      .then((data) => setNotifications(data.notifications || []))
      .catch((err) => console.error("Error fetching notifications:", err));

    socket = io({ path: "/api/push-notification/socketio" });
    socket.emit("register", decoded.userId);

    socket.on("newNotification", (notif: Notification) => {
      if (Notification.permission === "granted") {
        new Notification("New Reply", { body: notif.message });
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

  const handleToggleDropdown = () => {
    const newState = !showDropdown;
    setShowDropdown(newState);

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

  const deleteNotification = (id: string) => {
    fetch(`/api/push-notification/delete-notification?id=${id}`, { method: "DELETE" })
      .then((res) => res.json())
      .then(() => {
        setNotifications((prev) => prev.filter((n) => n._id !== id));
      })
      .catch((err) => console.error("Delete error:", err));
  };

  const clearAllNotifications = () => {
    if (!userId) return;
    fetch(`/api/push-notification/clearAll-notification?userId=${userId}`, {
      method: "DELETE",
    })
      .then((res) => res.json())
      .then(() => setNotifications([]))
      .catch((err) => console.error("Clear all error:", err));
  };

  return (
    <div className="relative">
      <button onClick={handleToggleDropdown} className="relative p-2">
        🔔
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full px-1">
            {unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <div className="absolute right-0 mt-2 w-80 bg-white border rounded shadow-lg z-50">
          {notifications.length === 0 ? (
            <p className="p-4 text-gray-500">No notifications</p>
          ) : (
            <>
              <div className="flex justify-between items-center px-3 py-2 border-b">
                <span className="font-semibold">Notifications</span>
                <button
                  onClick={clearAllNotifications}
                  className="text-xs text-red-500 hover:underline"
                >
                  Clear All
                </button>
              </div>

              {notifications.map((n) => (
                <div
                  key={n._id}
                  className={`p-3 border-b flex justify-between items-start ${
                    n.isRead ? "bg-gray-100" : "bg-white"
                  } hover:bg-gray-50`}
                >
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => {
                      if (n.type === "blog-reply" && n.relatedBlog) {
                        window.location.href = `/blogs/${n.relatedBlog}#${n.relatedComment}`;
                      } else if (n.type === "job-status" && n.relatedJob) {
                        window.location.href = `/job-details/${n.relatedJob}`;
                      }
                    }}
                  >
                    <p className="text-sm">{n.message}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteNotification(n._id)}
                    className="ml-2 text-xs text-gray-500 hover:text-red-600"
                  >
                    ✖
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}