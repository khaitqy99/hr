import React, { useState, useEffect, useRef } from 'react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  threshold?: number;
  disabled?: boolean;
}

const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  children,
  threshold = 80,
  disabled = false,
}) => {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const touchStartX = useRef<number | null>(null);
  const isPullingRef = useRef(false);
  const pullDistanceRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (disabled || isRefreshing) return;

    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Only trigger if at the top of the scroll
      if (container.scrollTop === 0) {
        touchStartY.current = e.touches[0].clientY;
        touchStartX.current = e.touches[0].clientX;
        isPullingRef.current = false;
        pullDistanceRef.current = 0;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (touchStartY.current === null) return;
      if (container.scrollTop > 0) {
        touchStartY.current = null;
        return;
      }

      const currentY = e.touches[0].clientY;
      const distance = currentY - touchStartY.current;
      const horizontalDistance = touchStartX.current === null
        ? 0
        : Math.abs(e.touches[0].clientX - touchStartX.current);

      // Không chặn click vì rung tay nhẹ; chỉ nhận một thao tác kéo dọc rõ ràng.
      const pullSlop = 10;
      if (distance > pullSlop && distance > horizontalDistance) {
        e.preventDefault();
        const nextDistance = Math.min(distance, threshold * 1.5);
        isPullingRef.current = true;
        pullDistanceRef.current = nextDistance;
        setIsPulling(true);
        setPullDistance(nextDistance);
      } else if (distance <= 0 || horizontalDistance > distance) {
        // Vuốt lên/ngang - reset và cho phép scroll hoặc swipe tab bình thường.
        touchStartY.current = null;
        touchStartX.current = null;
        isPullingRef.current = false;
        pullDistanceRef.current = 0;
        setIsPulling(false);
        setPullDistance(0);
      }
    };

    const handleTouchEnd = async () => {
      if (touchStartY.current === null || !isPullingRef.current) {
        touchStartY.current = null;
        touchStartX.current = null;
        return;
      }

      if (pullDistanceRef.current >= threshold) {
        setIsRefreshing(true);
        try {
          await onRefresh();
        } catch (error) {
          console.error('Refresh failed:', error);
        } finally {
          setIsRefreshing(false);
        }
      }

      setIsPulling(false);
      setPullDistance(0);
      touchStartY.current = null;
      touchStartX.current = null;
      isPullingRef.current = false;
      pullDistanceRef.current = 0;
    };

    const handleTouchCancel = () => {
      touchStartY.current = null;
      touchStartX.current = null;
      isPullingRef.current = false;
      pullDistanceRef.current = 0;
      setIsPulling(false);
      setPullDistance(0);
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    container.addEventListener('touchcancel', handleTouchCancel);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [disabled, isRefreshing, threshold, onRefresh]);

  const pullProgress = Math.min(pullDistance / threshold, 1);
  const shouldShowSpinner = pullProgress > 0.5;

  return (
    <div ref={containerRef} className="relative h-full overflow-auto no-scrollbar">
      {/* Pull to refresh indicator */}
      {isPulling && (
        <div
          className="absolute top-0 left-0 right-0 flex items-center justify-center transition-transform duration-200"
          style={{
            transform: `translateY(${Math.min(pullDistance, threshold * 1.2)}px)`,
            height: `${threshold}px`,
          }}
        >
          <div
            className={`transition-opacity duration-200 ${
              shouldShowSpinner ? 'opacity-100' : 'opacity-50'
            }`}
            style={{
              transform: `rotate(${pullProgress * 360}deg)`,
            }}
          >
            {shouldShowSpinner ? (
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
            )}
          </div>
        </div>
      )}

      {/* Refreshing indicator */}
      {isRefreshing && (
        <div className="absolute top-0 left-0 right-0 flex items-center justify-center py-4 bg-blue-50">
          <div className="w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="ml-2 text-sm text-blue-600 font-medium">Đang tải...</span>
        </div>
      )}

      {/* Content - dùng transform: none khi idle để tránh blur do GPU compositing */}
      <div
        style={{
          transform: isPulling ? `translateY(${Math.min(pullDistance, threshold * 1.2)}px)` : undefined,
          transition: isPulling ? 'none' : 'transform 0.3s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default PullToRefresh;
