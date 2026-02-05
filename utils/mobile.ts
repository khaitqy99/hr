// Mobile Optimization Utilities

/**
 * Network-aware utilities
 */
export const getNetworkInfo = () => {
  if ('connection' in navigator) {
    const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (conn) {
      return {
        effectiveType: conn.effectiveType, // '2g', '3g', '4g', 'slow-2g'
        downlink: conn.downlink, // Mbps
        rtt: conn.rtt, // ms
        saveData: conn.saveData, // boolean
      };
    }
  }
  return null;
};

export const isSlowNetwork = (): boolean => {
  const networkInfo = getNetworkInfo();
  if (!networkInfo) return false;
  
  // Consider slow if 2g, slow-2g, or save-data mode
  return (
    networkInfo.effectiveType === '2g' ||
    networkInfo.effectiveType === 'slow-2g' ||
    networkInfo.saveData === true ||
    (networkInfo.downlink && networkInfo.downlink < 1.5) // Less than 1.5 Mbps
  );
};

/**
 * Debounce function
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Throttle function
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

/**
 * Check if device is mobile
 */
export const isMobileDevice = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
};

/**
 * Get viewport height accounting for mobile browser UI
 */
export const getViewportHeight = (): number => {
  // Use visual viewport if available (better for mobile)
  if (window.visualViewport) {
    return window.visualViewport.height;
  }
  return window.innerHeight;
};

/**
 * Handle keyboard visibility on mobile
 */
export const setupKeyboardHandling = (
  onKeyboardShow?: () => void,
  onKeyboardHide?: () => void
) => {
  if (!isMobileDevice()) return;

  let initialViewportHeight = getViewportHeight();
  const threshold = 150; // Consider keyboard shown if height reduced by >150px

  const handleResize = () => {
    const currentHeight = getViewportHeight();
    const heightDiff = initialViewportHeight - currentHeight;

    if (heightDiff > threshold) {
      // Keyboard likely shown
      onKeyboardShow?.();
    } else {
      // Keyboard likely hidden
      onKeyboardHide?.();
      initialViewportHeight = currentHeight; // Update baseline
    }
  };

  // Use visual viewport API if available (more accurate)
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', handleResize);
    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
    };
  } else {
    // Fallback to window resize
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }
};

/**
 * Scroll element into view considering keyboard
 */
export const scrollIntoViewMobile = (element: HTMLElement, offset: number = 100) => {
  if (!isMobileDevice()) {
    element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }

  // On mobile, account for keyboard and safe areas
  const rect = element.getBoundingClientRect();
  const viewportHeight = getViewportHeight();
  const elementBottom = rect.bottom;
  const elementTop = rect.top;

  // Check if element is hidden by keyboard
  if (elementBottom > viewportHeight - offset) {
    // Scroll element to visible area above keyboard
    const scrollAmount = elementBottom - viewportHeight + offset;
    window.scrollBy({
      top: scrollAmount,
      behavior: 'smooth',
    });
  } else if (elementTop < offset) {
    // Element is too high, scroll it down a bit
    window.scrollBy({
      top: elementTop - offset,
      behavior: 'smooth',
    });
  }
};

/**
 * Prevent zoom on double tap (iOS Safari)
 */
export const preventDoubleTapZoom = (element: HTMLElement) => {
  let lastTouchEnd = 0;
  
  element.addEventListener('touchend', (event) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      event.preventDefault();
    }
    lastTouchEnd = now;
  }, { passive: false });
};

/**
 * Get safe area insets
 */
export const getSafeAreaInsets = () => {
  return {
    top: parseInt(getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-top)') || '0'),
    right: parseInt(getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-right)') || '0'),
    bottom: parseInt(getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-bottom)') || '0'),
    left: parseInt(getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-right)') || '0'),
  };
};

/**
 * Check if element is in viewport
 */
export const isInViewport = (element: HTMLElement): boolean => {
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
};
