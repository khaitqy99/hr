/**
 * Khóa khung app đúng chiều cao màn hình thật trên iOS PWA.
 *
 * Nhân viên đã cài app vẫn nhận được bản CSS/JS này qua service worker —
 * không cần xóa Home Screen. Meta status-bar thì iOS khóa lúc cài, nên
 * phần layout phải tự bù cho cả chế độ black-translucent (bản cũ) lẫn default (bản mới).
 */
const applyViewport = () => {
  if (window.scrollY !== 0 || window.scrollX !== 0) {
    window.scrollTo(0, 0);
  }

  // Lấy chiều cao lớn nhất đang có để không còn dải trống ở đáy
  const vv = window.visualViewport;
  const height = Math.max(
    window.innerHeight || 0,
    document.documentElement.clientHeight || 0,
    vv ? Math.round(vv.height + (vv.offsetTop || 0)) : 0
  );

  if (height <= 0) return;

  const px = `${height}px`;
  document.documentElement.style.setProperty('--app-height', px);
  document.documentElement.style.height = px;
  document.body.style.height = px;

  const root = document.getElementById('root');
  if (root) root.style.height = px;
};

export const setupViewportLock = (): void => {
  applyViewport();

  requestAnimationFrame(() => {
    applyViewport();
    requestAnimationFrame(applyViewport);
  });

  // iOS còn chỉnh layout vài nhịp sau khi mở app từ Home Screen
  [50, 150, 400, 1000, 2000].forEach(delay => {
    window.setTimeout(applyViewport, delay);
  });

  window.addEventListener('resize', applyViewport);
  window.addEventListener('orientationchange', applyViewport);
  window.addEventListener('pageshow', applyViewport);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') applyViewport();
  });
  window.visualViewport?.addEventListener('resize', applyViewport);
  window.visualViewport?.addEventListener('scroll', applyViewport);
};
