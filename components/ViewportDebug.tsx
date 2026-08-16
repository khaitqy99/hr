import React, { useEffect, useState } from 'react';

/**
 * Bảng chẩn đoán kích thước viewport, chỉ bật khi URL có ?vpdebug=1.
 * Dùng để đối chiếu số liệu thật trên iPhone (Safari vs PWA standalone).
 */
const readSafeAreaInsets = () => {
  const probe = document.createElement('div');
  probe.style.cssText = [
    'position:fixed',
    'visibility:hidden',
    'pointer-events:none',
    'padding-top:env(safe-area-inset-top)',
    'padding-right:env(safe-area-inset-right)',
    'padding-bottom:env(safe-area-inset-bottom)',
    'padding-left:env(safe-area-inset-left)',
  ].join(';');
  document.body.appendChild(probe);
  const style = getComputedStyle(probe);
  const insets = {
    top: style.paddingTop,
    right: style.paddingRight,
    bottom: style.paddingBottom,
    left: style.paddingLeft,
  };
  probe.remove();
  return insets;
};

const collect = () => {
  const insets = readSafeAreaInsets();
  const bodyRect = document.body.getBoundingClientRect();
  const rootRect = document.getElementById('root')?.getBoundingClientRect();

  return {
    standalone:
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches,
    innerHeight: window.innerHeight,
    clientHeight: document.documentElement.clientHeight,
    screenHeight: window.screen.height,
    visualHeight: Math.round(window.visualViewport?.height ?? 0),
    visualOffsetTop: Math.round(window.visualViewport?.offsetTop ?? 0),
    scrollY: Math.round(window.scrollY),
    bodyHeight: Math.round(bodyRect.height),
    bodyBottom: Math.round(bodyRect.bottom),
    rootHeight: Math.round(rootRect?.height ?? 0),
    rootBottom: Math.round(rootRect?.bottom ?? 0),
    insetTop: insets.top,
    insetBottom: insets.bottom,
    dpr: window.devicePixelRatio,
  };
};

const ViewportDebug: React.FC = () => {
  const [info, setInfo] = useState(collect);

  useEffect(() => {
    const update = () => setInfo(collect());
    const timers = [200, 800, 2000].map(delay => window.setTimeout(update, delay));

    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    window.visualViewport?.addEventListener('resize', update);

    return () => {
      timers.forEach(window.clearTimeout);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, []);

  return (
    <div
      className="fixed left-2 top-2 z-[9999] rounded-lg bg-black/85 px-3 py-2 font-mono text-[10px] leading-4 text-lime-300"
      style={{ pointerEvents: 'none' }}
    >
      {Object.entries(info).map(([key, value]) => (
        <div key={key}>
          {key}: {String(value)}
        </div>
      ))}
    </div>
  );
};

export default ViewportDebug;
