import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  onFinish: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const [fadeOut, setFadeOut] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const duration = 1000;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const p = Math.min(100, (elapsed / duration) * 100);
      setProgress(p);
      if (p < 100) requestAnimationFrame(tick);
    };
    const id = requestAnimationFrame(tick);

    const minTime = setTimeout(() => {
      setFadeOut(true);
      setTimeout(() => onFinish(), 350);
    }, duration);

    return () => {
      clearTimeout(minTime);
      cancelAnimationFrame(id);
    };
  }, [onFinish]);

  return (
    <>
      <style>{`
        @keyframes splash-logo-in {
          from { opacity: 0; transform: scale(0.85); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes splash-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes splash-text-in {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes splash-glow {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }
        .splash-logo-in { animation: splash-logo-in 0.5s ease-out forwards; }
        .splash-float { animation: splash-float 3s ease-in-out infinite; }
        .splash-text-in { animation: splash-text-in 0.5s ease-out 0.2s forwards; opacity: 0; }
        .splash-glow { animation: splash-glow 2.5s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .splash-logo-in, .splash-float, .splash-text-in, .splash-glow { animation: none; }
          .splash-text-in { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div
        className={`fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden transition-opacity duration-350 ${
          fadeOut ? 'opacity-0' : 'opacity-100'
        }`}
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        }}
      >
        {/* Background: gradient + subtle mesh */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 120% 80% at 50% 0%, rgba(14, 116, 144, 0.35) 0%, transparent 50%),
              radial-gradient(ellipse 80% 60% at 80% 80%, rgba(6, 78, 59, 0.25) 0%, transparent 45%),
              radial-gradient(ellipse 70% 50% at 20% 100%, rgba(30, 64, 175, 0.2) 0%, transparent 45%),
              linear-gradient(180deg, #0f172a 0%, #0c4a6e 35%, #075985 65%, #0c4a6e 100%)
            `,
          }}
        />
        {/* Soft grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)
            `,
            backgroundSize: '32px 32px',
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center flex-1 w-full max-w-sm px-6">
          {/* Logo container with glow */}
          <div className="relative mb-8">
            <div
              className="splash-glow absolute inset-0 rounded-3xl blur-2xl bg-sky-400/30"
              style={{ transform: 'scale(1.4)' }}
              aria-hidden
            />
            <div className="relative splash-logo-in splash-float flex items-center justify-center w-28 h-28 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl">
              <img
                src="/logo.png"
                alt="Y99 HR"
                className="h-16 w-16 object-contain pointer-events-none select-none"
                draggable={false}
              />
            </div>
          </div>

          {/* App name & tagline */}
          <div className="splash-text-in text-center">
            <h1 className="text-4xl font-extrabold text-white tracking-tight drop-shadow-sm">
              Y99 HR
            </h1>
            <p className="mt-2 text-sky-200/90 text-sm font-medium tracking-wide">
              Hệ thống quản lý nhân sự 4.0
            </p>
          </div>

          {/* Progress bar at bottom */}
          <div className="absolute bottom-0 left-0 right-0 px-6 pb-6" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
            <div className="h-1 w-full max-w-48 mx-auto rounded-full bg-white/15 overflow-hidden">
              <div
                className="h-full rounded-full bg-white/90 transition-all duration-75 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SplashScreen;
