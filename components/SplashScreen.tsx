import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  onFinish: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Minimum splash screen time: 1 second
    const minTime = setTimeout(() => {
      setFadeOut(true);
      setTimeout(() => {
        onFinish();
      }, 300); // Fade out animation
    }, 1000);

    return () => clearTimeout(minTime);
  }, [onFinish]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-blue-900 via-blue-800 to-sky-900 transition-opacity duration-300 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      {/* Logo Animation */}
      <div className="mb-8 animate-float-slow">
        <img 
          src="/logo.png" 
          alt="Y99 HR Logo" 
          className="h-24 w-24 object-contain drop-shadow-2xl"
        />
      </div>

      {/* App Name */}
      <h1 className="text-4xl font-extrabold text-white mb-2 tracking-tight">
        Y99 HR
      </h1>
      <p className="text-blue-200 text-sm font-medium mb-8">
        Hệ thống quản lý nhân sự 4.0
      </p>

      {/* Loading Spinner */}
      <div className="relative">
        <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
      </div>
    </div>
  );
};

export default SplashScreen;
