import React, { useState, useEffect } from 'react';

const UpdateNotification: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    // Listen for service worker updates
    if ('serviceWorker' in navigator) {
      let refreshing = false;

      // Check for updates
      const checkForUpdates = async () => {
        try {
          const registration = await navigator.serviceWorker.getRegistration();
          if (registration) {
            // Check for updates every 5 minutes
            setInterval(async () => {
              await registration.update();
            }, 5 * 60 * 1000);

            // Listen for controller change (new SW activated)
            navigator.serviceWorker.addEventListener('controllerchange', () => {
              if (!refreshing) {
                refreshing = true;
                setUpdateAvailable(true);
              }
            });

            // Listen for waiting service worker
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // New service worker is waiting
                    setUpdateAvailable(true);
                  }
                });
              }
            });
          }
        } catch (error) {
          console.error('Error checking for updates:', error);
        }
      };

      checkForUpdates();
    }
  }, []);

  const handleUpdate = () => {
    setIsUpdating(true);
    window.location.reload();
  };

  const handleDismiss = () => {
    setUpdateAvailable(false);
  };

  if (!updateAvailable) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 p-4 bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg animate-slide-down">
      <div className="max-w-md mx-auto flex items-center justify-between gap-4">
        <div className="flex-1">
          <p className="font-semibold text-sm mb-1">✨ Đã có bản cập nhật</p>
          <p className="text-xs text-green-100">
            Tải lại để sử dụng phiên bản mới nhất
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleUpdate}
            disabled={isUpdating}
            className="px-4 py-2 bg-white text-green-600 rounded-lg font-semibold text-sm hover:bg-green-50 transition-colors active:scale-95 disabled:opacity-50"
          >
            {isUpdating ? 'Đang tải...' : 'Tải lại'}
          </button>
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

export default UpdateNotification;
