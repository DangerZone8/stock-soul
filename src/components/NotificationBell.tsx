import { useEffect, useState, useRef, useCallback } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Bell, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

export function NotificationBell() {
  const { user, profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const notifChannelRef = useRef<RealtimeChannel | null>(null);
  const realtimeSetupDoneRef = useRef(false);

  // Fetch notifications from the database
  const loadNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) {
        console.error("Error loading notifications:", error);
        return;
      }

      if (data) {
        setNotifications(data as Notification[]);
        const unread = data.filter((n: Notification) => !n.read).length;
        setUnreadCount(unread);
      }
    } catch (err) {
      console.error("Exception loading notifications:", err);
    }
  }, [user]);

  // Mark a notification as read
  const markAsRead = useCallback(
    async (notificationId: string) => {
      try {
        const { error } = await supabase
          .from("notifications")
          .update({ read: true })
          .eq("id", notificationId);

        if (error) {
          console.error("Error marking notification as read:", error);
          return;
        }

        setNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (err) {
        console.error("Exception marking notification as read:", err);
      }
    },
    []
  );

  // Delete a notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", notificationId);

      if (error) {
        console.error("Error deleting notification:", error);
        return;
      }

      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    } catch (err) {
      console.error("Exception deleting notification:", err);
    }
  }, []);

  // Load notifications on mount and when user changes
  useEffect(() => {
    loadNotifications();
  }, [user, loadNotifications]);

  // Setup realtime subscription for notifications - ONCE per user
  useEffect(() => {
    if (!user) {
      // Clean up existing channel when user logs out
      if (notifChannelRef.current) {
        supabase.removeChannel(notifChannelRef.current);
        notifChannelRef.current = null;
      }
      realtimeSetupDoneRef.current = false;
      return;
    }

    // Only setup realtime once per user session
    if (realtimeSetupDoneRef.current) {
      return;
    }
    realtimeSetupDoneRef.current = true;

    // Clean up any existing channel first
    if (notifChannelRef.current) {
      supabase.removeChannel(notifChannelRef.current);
    }

    // Create channel with postgres_changes listener BEFORE subscribe
    const ch = supabase.channel(`realtime:notif-${user.id}`);

    // Attach all listeners BEFORE calling subscribe()
    ch.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${user.id}`,
      },
      (payload) => {
        const newNotif = payload.new as Notification;
        setNotifications((prev) => [newNotif, ...prev]);
        setUnreadCount((prev) => prev + 1);

        // Show toast for new notification
        toast({
          title: newNotif.title,
          description: newNotif.message,
        });
      }
    );

    // Also listen for updates (e.g., when a notification is marked as read from another tab)
    ch.on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${user.id}`,
      },
      (payload) => {
        const updatedNotif = payload.new as Notification;
        setNotifications((prev) =>
          prev.map((n) => (n.id === updatedNotif.id ? updatedNotif : n))
        );
      }
    );

    // Now subscribe after all listeners are attached
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        notifChannelRef.current = ch;
        console.log("Notifications realtime channel subscribed");
      } else if (status === "CHANNEL_ERROR") {
        console.error("Notifications realtime channel error");
      }
    });

    return () => {
      if (notifChannelRef.current === ch) {
        supabase.removeChannel(ch);
        notifChannelRef.current = null;
      }
    };
  }, [user]);

  return (
    <div className="relative">
      {/* Notification Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
        aria-label="Notifications"
        title={unreadCount > 0 ? `${unreadCount} unread notification(s)` : "Notifications"}
      >
        <Bell className="w-5 h-5" strokeWidth={1.5} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        )}
      </button>

      {/* Notifications Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 rounded-lg border border-border/30 bg-card shadow-lg z-50 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border/30 bg-background/50">
            <h3 className="font-semibold text-sm">Notifications</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close notifications"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border/20">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-4 hover:bg-secondary/30 transition-colors cursor-pointer ${
                      !notif.read ? "bg-primary/5" : ""
                    }`}
                    onClick={() => markAsRead(notif.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-semibold truncate">
                            {notif.title}
                          </h4>
                          {!notif.read && (
                            <div className="w-2 h-2 bg-primary rounded-full shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {notif.message}
                        </p>
                        <time className="text-[10px] text-muted-foreground/60 mt-1 block">
                          {new Date(notif.created_at).toLocaleDateString()} at{" "}
                          {new Date(notif.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </time>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notif.id);
                        }}
                        className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors shrink-0"
                        aria-label="Delete notification"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-3 border-t border-border/30 bg-background/50 text-center">
              <button
                onClick={() => loadNotifications()}
                className="text-xs text-primary hover:underline"
              >
                Refresh
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
