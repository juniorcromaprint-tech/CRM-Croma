// src/components/NotificationBadge.tsx
import { useNotifications } from '@/hooks/useNotifications';

export function NotificationBadge() {
  const { unreadCount } = useNotifications();
  if (unreadCount === 0) return null;

  return (
    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
      {unreadCount > 9 ? '9+' : unreadCount}
    </span>
  );
}
