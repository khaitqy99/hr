import React, { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    setIsStandalone(standalone);

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(iOS);

    // Listen for beforeinstallprompt event (Android/Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Show prompt after 3 seconds if not dismissed before
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      if (!dismissed) {
        setTimeout(() => {
          setShowPrompt(true);
        }, 3000);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if user dismissed before
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (!dismissed && !standalone && !iOS) {
      // Show iOS instructions if on iOS
      if (iOS) {
        setTimeout(() => {
          setShowPrompt(true);
        }, 3000);
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
      }
      
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  // Don't show if already installed or dismissed
  if (isStandalone || !showPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-2xl animate-slide-up">
      <div className="max-w-md mx-auto flex items-center justify-between gap-4">
        <div className="flex-1">
          {isIOS ? (
            <div>
              <p className="font-semibold text-sm mb-1">Cài đặt Y99 HR</p>
              <p className="text-xs text-blue-100">
                Chạm <span className="font-bold">Share</span> → <span className="font-bold">Add to Home Screen</span>
              </p>
            </div>
          ) : (
            <div>
              <p className="font-semibold text-sm mb-1">Cài đặt ứng dụng</p>
              <p className="text-xs text-blue-100">
                Cài đặt để truy cập nhanh hơn và sử dụng offline
              </p>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {!isIOS && deferredPrompt && (
            <button
              onClick={handleInstallClick}
              className="px-4 py-2 bg-white text-blue-600 rounded-lg font-semibold text-sm hover:bg-blue-50 transition-colors active:scale-95"
            >
              Cài đặt
            </button>
          )}
          <button
            onClick={handleDismiss}
            className="px-3 py-2 text-white/80 hover:text-white transition-colors"
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};

export default InstallPrompt;
