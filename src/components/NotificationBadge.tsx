interface NotificationBadgeProps {
  count: number;
  onClick?: (e: React.MouseEvent) => void;
}

export function NotificationBadge({ count, onClick }: NotificationBadgeProps) {
  if (count <= 0) return null;
  return (
    <span
      onClick={onClick}
      className="ml-auto text-xs bg-red-500 text-white rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center font-semibold cursor-pointer"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
