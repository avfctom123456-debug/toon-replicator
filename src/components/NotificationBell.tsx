import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Bell, Check, Trash2, Gavel, AlertTriangle, Trophy, X, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications, Notification } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";

const notificationIcons: Record<string, React.ReactNode> = {
  outbid: <AlertTriangle className="h-4 w-4 text-orange-500" />,
  auction_won: <Trophy className="h-4 w-4 text-yellow-500" />,
  auction_lost: <Gavel className="h-4 w-4 text-muted-foreground" />,
  auction_sold: <Trophy className="h-4 w-4 text-green-500" />,
  auction_expired: <Gavel className="h-4 w-4 text-muted-foreground" />,
  trade_accepted: <ArrowRightLeft className="h-4 w-4 text-emerald-500" />,
  trade_completed: <ArrowRightLeft className="h-4 w-4 text-teal-500" />,
};

const notificationColors: Record<string, string> = {
  outbid: "border-l-orange-500",
  auction_won: "border-l-yellow-500",
  auction_lost: "border-l-muted",
  auction_sold: "border-l-green-500",
  auction_expired: "border-l-muted",
  trade_accepted: "border-l-emerald-500",
  trade_completed: "border-l-teal-500",
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { 
    notifications, 
    unreadCount, 
    loading, 
    markAsRead, 
    markAllAsRead,
    deleteNotification 
  } = useNotifications();

  const formatTime = (timestamp: string) => {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-bold">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <h3 className="font-semibold text-foreground">Notifications</h3>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs h-7"
              onClick={markAllAsRead}
            >
              <Check className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        <ScrollArea className="h-[300px]">
          {loading ? (
            <div className="p-4 text-center text-muted-foreground">
              Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onRead={() => markAsRead(notification.id)}
                  onDelete={() => deleteNotification(notification.id)}
                  formatTime={formatTime}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

interface NotificationItemProps {
  notification: Notification;
  onRead: () => void;
  onDelete: () => void;
  formatTime: (timestamp: string) => string;
}

function NotificationItem({ notification, onRead, onDelete, formatTime }: NotificationItemProps) {
  const icon = notificationIcons[notification.type] || <Bell className="h-4 w-4" />;
  const borderColor = notificationColors[notification.type] || "border-l-muted";

  return (
    <div
      className={cn(
        "p-3 hover:bg-muted/50 transition-colors border-l-4 cursor-pointer",
        borderColor,
        !notification.read && "bg-primary/5"
      )}
      onClick={() => {
        if (!notification.read) onRead();
      }}
    >
      <div className="flex gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={cn(
              "text-sm",
              !notification.read ? "font-semibold text-foreground" : "text-muted-foreground"
            )}>
              {notification.title}
            </p>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 -mt-1 -mr-1 opacity-0 group-hover:opacity-100 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {notification.message}
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            {formatTime(notification.created_at)}
          </p>
        </div>
      </div>
    </div>
  );
}