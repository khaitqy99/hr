/**
 * iOS PWA (standalone) hay giữ lại một offset scroll ở cấp document khi mở app từ
 * Home Screen. Offset đó làm splash, thanh nav và layout bị đẩy lên, hở chân cho
 * tới khi người dùng chạm kéo. Hàm này đưa document về đúng vị trí 0.
 */
const resetScroll = () => {
  if (window.scrollY !== 0 || window.scrollX !== 0) {
    window.scrollTo(0, 0);
  }
};

export const setupViewportLock = (): void => {
  resetScroll();

  // iOS còn chỉnh lại layout vài nhịp sau khi app khởi động
  requestAnimationFrame(() => {
    resetScroll();
    requestAnimationFrame(resetScroll);
  });
  [120, 400, 1000].forEach(delay => window.setTimeout(resetScroll, delay));

  window.addEventListener('resize', resetScroll);
  window.addEventListener('orientationchange', resetScroll);
  window.addEventListener('pageshow', resetScroll);
};
