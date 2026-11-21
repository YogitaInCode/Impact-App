import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Button, Modal } from './ui/primitives';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <Button variant="outline" size="sm" onClick={install}>
        <Download className="w-3.5 h-3.5" />
        {!compact && 'Install App'}
      </Button>
    );
  }

  if (isIOS) {
    return (
      <>
        <Button variant="outline" size="sm" onClick={() => setShowIOSGuide(true)}>
          <Download className="w-3.5 h-3.5" />
          {!compact && 'Install App'}
        </Button>
        <Modal
          open={showIOSGuide}
          onClose={() => setShowIOSGuide(false)}
          title="Install IMPACT CAMPUS on iOS"
          subtitle="Add to your Home Screen for offline timetable and attendance access."
          maxWidth="max-w-sm"
        >
          <ol className="space-y-2 text-sm text-[#4B3F42] dark:text-[#D8CCD0] list-decimal pl-5">
            <li>Tap the Share icon in the Safari toolbar.</li>
            <li>Scroll down and tap Add to Home Screen.</li>
            <li>Tap Add to launch ImpactCampus in standalone mode.</li>
          </ol>
          <div className="mt-5 flex justify-end">
            <Button variant="secondary" size="sm" onClick={() => setShowIOSGuide(false)}>
              Close
            </Button>
          </div>
        </Modal>
      </>
    );
  }

  return null;
};
