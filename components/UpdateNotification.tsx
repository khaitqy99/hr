import React, { useState, useEffect, useRef } from 'react';

/** Thời gian (ms) chờ trước khi tự động reload khi có bản cập nhật */
const AUTO_RELOAD_DELAY_MS = 2000;

const UpdateNotification: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState<'update' | 'reloading'>('update');
  const autoReloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let refreshing = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const applyUpdate = () => {
      if (refreshing) return;
      refreshing = true;
      setIsUpdating(true);
      setMessage('reloading');
      window.location.reload();
    };

    const onUpdateReady = () => {
      if (refreshing) return;
      setUpdateAvailable(true);
      autoReloadTimerRef.current = setTimeout(applyUpdate, AUTO_RELOAD_DELAY_MS);
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        navigator.serviceWorker.getRegistration().then((r) => r?.update());
      }
    };

    const setup = async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) return;

        await registration.update();

        document.addEventListener('visibilitychange', onVisible);
        intervalId = setInterval(() => registration.update(), 5 * 60 * 1000);

        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (!refreshing) onUpdateReady();
        });

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              onUpdateReady();
            }
          });
        });
      } catch (error) {
        console.error('Error checking for updates:', error);
      }
    };

    setup();

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      if (intervalId) clearInterval(intervalId);
      if (autoReloadTimerRef.current) {
        clearTimeout(autoReloadTimerRef.current);
        autoReloadTimerRef.current = null;
      }
    };
  }, []);

  const handleUpdateNow = () => {
    if (autoReloadTimerRef.current) {
      clearTimeout(autoReloadTimerRef.current);
      autoReloadTimerRef.current = null;
    }
    setIsUpdating(true);
    setMessage('reloading');
    window.location.reload();
  };

  const handleDismiss = () => {
    if (autoReloadTimerRef.current) {
      clearTimeout(autoReloadTimerRef.current);
      autoReloadTimerRef.current = null;
    }
    setUpdateAvailable(false);
  };

  if (!updateAvailable) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] p-4 bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg animate-slide-down">
      <div className="max-w-md mx-auto flex items-center justify-between gap-4">
        <div className="flex-1">
          <p className="font-semibold text-sm mb-1">
            {message === 'reloading' ? 'Đang áp dụng bản cập nhật...' : '✨ Đã có bản cập nhật'}
          </p>
          <p className="text-xs text-green-100">
            {message === 'reloading'
              ? 'Trang sẽ tải lại trong giây lát'
              : 'Tự động tải lại sau vài giây hoặc nhấn "Tải lại ngay"'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleUpdateNow}
            disabled={isUpdating}
            className="px-4 py-2 bg-white text-green-600 rounded-lg font-semibold text-sm hover:bg-green-50 transition-colors active:scale-95 disabled:opacity-50"
          >
            {isUpdating ? 'Đang tải...' : 'Tải lại ngay'}
          </button>
          {!isUpdating && (
            <button
              onClick={handleDismiss}
              className="px-3 py-2 text-white/80 hover:text-white transition-colors"
              aria-label="Đóng"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpdateNotification;
