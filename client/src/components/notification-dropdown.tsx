import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications, AgentNotification } from '@/context/notification-context';
import { Bell, Check, Trash2, CheckCircle2, AlertCircle, Info, BadgeAlert } from 'lucide-react';
import { format } from 'date-fns';
import { CreateTestNotificationButton } from './create-test-notification-button';

export function NotificationDropdown() {
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification,
    isLoading 
  } = useNotifications();

  const handleMarkAsRead = async (id: number) => {
    await markAsRead(id);
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
  };

  const handleDeleteNotification = async (id: number) => {
    await deleteNotification(id);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'alert':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'warning':
        return <BadgeAlert className="h-4 w-4 text-amber-500" />;
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'info':
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getNotificationTimeAgo = (createdAt: string) => {
    const date = new Date(createdAt);
    try {
      return format(date, 'MMM d, h:mm a');
    } catch (error) {
      return 'Unknown time';
    }
  };

  return (
    <div className="flex items-center gap-4">
      {/* Only show in development */}
      {process.env.NODE_ENV === 'development' && <CreateTestNotificationButton />}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="relative">
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center rounded-full p-0 text-xs"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[350px]">
          <DropdownMenuLabel className="flex justify-between items-center">
            <span>Notifications</span>
            {notifications.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 text-xs"
                onClick={handleMarkAllAsRead}
              >
                <Check className="mr-1 h-3 w-3" />
                Mark all read
              </Button>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No notifications
            </div>
          ) : (
            <ScrollArea className="h-[300px]">
              <DropdownMenuGroup>
                {notifications.map((notification) => (
                  <NotificationItem 
                    key={notification.id} 
                    notification={notification} 
                    onMarkAsRead={handleMarkAsRead}
                    onDelete={handleDeleteNotification}
                    getIcon={getNotificationIcon}
                    getTimeAgo={getNotificationTimeAgo}
                  />
                ))}
              </DropdownMenuGroup>
            </ScrollArea>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

interface NotificationItemProps {
  notification: AgentNotification;
  onMarkAsRead: (id: number) => void;
  onDelete: (id: number) => void;
  getIcon: (type: string) => React.ReactNode;
  getTimeAgo: (createdAt: string) => string;
}

function NotificationItem({ 
  notification, 
  onMarkAsRead, 
  onDelete,
  getIcon,
  getTimeAgo
}: NotificationItemProps) {
  const isUnread = !notification.readAt;
  
  return (
    <DropdownMenuItem 
      className={`flex flex-col items-start w-full p-3 gap-1 cursor-default ${isUnread ? 'bg-muted' : ''}`}
    >
      <div className="flex justify-between w-full">
        <div className="flex items-center gap-2">
          {getIcon(notification.type)}
          <span className="font-medium text-sm">{notification.title}</span>
        </div>
        <div className="flex items-center gap-1">
          {isUnread && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 w-6 p-0"
              onClick={() => onMarkAsRead(notification.id)}
            >
              <Check className="h-3 w-3" />
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 w-6 p-0 text-muted-foreground"
            onClick={() => onDelete(notification.id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{notification.message}</p>
      <div className="flex justify-between w-full items-center mt-1">
        <span className="text-xs text-muted-foreground">{getTimeAgo(notification.createdAt)}</span>
        <Badge variant={getPriorityVariant(notification.priority)} className="h-5 text-[10px]">
          {notification.priority}
        </Badge>
      </div>
    </DropdownMenuItem>
  );
}

function getPriorityVariant(priority: string): "default" | "destructive" | "outline" | "secondary" {
  switch (priority) {
    case 'high':
      return "destructive";
    case 'medium':
      return "secondary";
    case 'low':
    default:
      return "outline";
  }
}