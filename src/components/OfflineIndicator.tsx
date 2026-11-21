import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="fixed bottom-18 lg:bottom-4 right-4 z-50 flex items-center gap-2 rounded-2xl border border-[#D4AF37]/60 bg-[#F7F3EE]/95 px-3.5 py-2 text-xs font-medium text-[#5A242B] shadow-lg backdrop-blur-md dark:bg-[#26191B]/95 dark:border-[#D4AF37]/45 dark:text-[#D4AF37]">
      <WifiOff className="w-3.5 h-3.5 shrink-0 text-[#8A6D0B] dark:text-[#D4AF37]" />
      <span>Offline Mode — Displaying cached timetable &amp; academic records.</span>
    </div>
  );
};
