// PWA Utilities - Native-like features

/**
 * Badge API - Hiển thị badge trên app icon
 */
export const setAppBadge = async (count: number): Promise<void> => {
  if ('setAppBadge' in navigator) {
    try {
      if (count > 0) {
        await (navigator as any).setAppBadge(count);
      } else {
        await (navigator as any).clearAppBadge();
      }
    } catch (error) {
      console.warn('Badge API not supported:', error);
    }
  }
};

/**
 * Share API - Chia sẻ nội dung
 */
export const shareContent = async (data: {
  title?: string;
  text?: string;
  url?: string;
  files?: File[];
}): Promise<boolean> => {
  if ('share' in navigator) {
    try {
      // Check if sharing files is supported
      if (data.files && 'canShare' in navigator && (navigator as any).canShare({ files: data.files })) {
        await (navigator as any).share({
          title: data.title,
          text: data.text,
          url: data.url,
          files: data.files,
        });
      } else {
        await navigator.share({
          title: data.title,
          text: data.text,
          url: data.url,
        });
      }
      return true;
    } catch (error: any) {
      // User cancelled or share failed
      if (error.name !== 'AbortError') {
        console.error('Share failed:', error);
      }
      return false;
    }
  }
  return false;
};

/**
 * Haptic Feedback - Rung động
 */
export const vibrate = (pattern: number | number[] = 50): void => {
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch (error) {
      console.warn('Vibration not supported:', error);
    }
  }
};

/**
 * Haptic feedback patterns
 */
export const HapticPatterns = {
  light: 10,
  medium: 25,
  heavy: 50,
  success: [50, 50, 50],
  error: [100, 50, 100],
  warning: [50, 100, 50],
};

/**
 * Fullscreen API
 */
export const requestFullscreen = async (): Promise<boolean> => {
  const element = document.documentElement;
  try {
    if (element.requestFullscreen) {
      await element.requestFullscreen();
    } else if ((element as any).webkitRequestFullscreen) {
      await (element as any).webkitRequestFullscreen();
    } else if ((element as any).msRequestFullscreen) {
      await (element as any).msRequestFullscreen();
    }
    return true;
  } catch (error) {
    console.warn('Fullscreen not supported:', error);
    return false;
  }
};

export const exitFullscreen = async (): Promise<boolean> => {
  try {
    if (document.exitFullscreen) {
      await document.exitFullscreen();
    } else if ((document as any).webkitExitFullscreen) {
      await (document as any).webkitExitFullscreen();
    } else if ((document as any).msExitFullscreen) {
      await (document as any).msExitFullscreen();
    }
    return true;
  } catch (error) {
    console.warn('Exit fullscreen failed:', error);
    return false;
  }
};

export const isFullscreen = (): boolean => {
  return !!(
    document.fullscreenElement ||
    (document as any).webkitFullscreenElement ||
    (document as any).msFullscreenElement
  );
};

/**
 * Check if app is installed (standalone mode)
 */
export const isInstalled = (): boolean => {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  );
};

/**
 * Check if app is running on iOS
 */
export const isIOS = (): boolean => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
};

/**
 * Check if app is running on Android
 */
export const isAndroid = (): boolean => {
  return /Android/.test(navigator.userAgent);
};

/**
 * Get device info
 */
export const getDeviceInfo = () => {
  return {
    isInstalled: isInstalled(),
    isIOS: isIOS(),
    isAndroid: isAndroid(),
    isStandalone: window.matchMedia('(display-mode: standalone)').matches,
    userAgent: navigator.userAgent,
  };
};

/**
 * Background Sync - Đăng ký background sync
 */
export const registerBackgroundSync = async (tag: string): Promise<boolean> => {
  if ('serviceWorker' in navigator && 'sync' in (ServiceWorkerRegistration.prototype as any)) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await (registration as any).sync.register(tag);
      return true;
    } catch (error) {
      console.warn('Background sync not supported:', error);
      return false;
    }
  }
  return false;
};

/**
 * Wake Lock API - Giữ màn hình sáng
 */
export const requestWakeLock = async (): Promise<WakeLockSentinel | null> => {
  if ('wakeLock' in navigator) {
    try {
      return await (navigator as any).wakeLock.request('screen');
    } catch (error) {
      console.warn('Wake Lock not supported:', error);
      return null;
    }
  }
  return null;
};
