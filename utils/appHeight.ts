/**
 * iOS PWA (standalone) báo sai chiều cao viewport ở lần vẽ đầu tiên, nên khung app
 * dựng bằng svh/dvh vẫn bị hở chân cho tới khi người dùng chạm kéo.
 * Ghi chiều cao thật vào biến --app-height để layout không phụ thuộc quirk đó.
 *
 * Dùng window.innerHeight (không phải visualViewport) để bàn phím ảo mở lên
 * không làm co khung app.
 */
const applyHeight = () => {
  const height = window.innerHeight;
  if (height > 0) {
    document.documentElement.style.setProperty('--app-height', `${height}px`);
  }
};

export const setupAppHeight = (): void => {
  applyHeight();

  // iOS chỉnh lại chiều cao vài nhịp sau khi mở app từ Home Screen
  requestAnimationFrame(() => {
    applyHeight();
    requestAnimationFrame(applyHeight);
  });
  const lateTimers = [120, 400, 1000].map(delay => window.setTimeout(applyHeight, delay));

  window.addEventListener('resize', applyHeight);
  window.addEventListener('orientationchange', applyHeight);
  window.addEventListener('pageshow', applyHeight);

  window.addEventListener('unload', () => {
    lateTimers.forEach(window.clearTimeout);
  });
};
