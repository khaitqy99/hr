import React, { useEffect, useRef } from 'react';

interface ViewOnlyGuardProps {
  active: boolean;
  children: React.ReactNode;
}

const VIEW_LABEL = /^(xem(\s|$)|chi tiết|đóng|close|hủy|huỷ|cancel|trước|sau|previous|prev|next|tuần này|this week|hôm nay|today|tải lại|làm mới|reload|lọc|filter)/i;

function controlLabel(el: Element): string {
  return `${el.getAttribute('title') || ''} ${el.getAttribute('aria-label') || ''} ${el.textContent || ''}`
    .replace(/[←→‹›«»]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isAllowedViewControl(el: Element): boolean {
  if (el.getAttribute('data-readonly-allow') === 'true') return true;
  const tag = el.tagName;
  if (tag === 'INPUT') {
    const type = ((el as HTMLInputElement).type || 'text').toLowerCase();
    if (['checkbox', 'radio', 'file', 'number', 'color', 'range', 'password', 'email', 'tel', 'hidden'].includes(type)) return false;
    if (['date', 'month', 'week', 'time', 'datetime-local', 'text', 'search'].includes(type)) {
      return el.closest('form') == null;
    }
    return false;
  }
  if (tag === 'TEXTAREA') return false;
  if (tag === 'SELECT') return el.closest('form') == null;
  if (tag === 'BUTTON' || tag === 'A' || el.getAttribute('role') === 'switch') {
    if (el.getAttribute('aria-pressed') != null || el.getAttribute('role') === 'switch') return false;
    const label = controlLabel(el);
    return Boolean(label) && VIEW_LABEL.test(label);
  }
  return false;
}

function lockControl(el: HTMLElement) {
  if (el.dataset.readonlyLocked === '1') return;
  if ('disabled' in el) {
    el.dataset.readonlyWasDisabled = (el as HTMLButtonElement).disabled ? '1' : '0';
    (el as HTMLButtonElement).disabled = true;
  }
  el.dataset.readonlyLocked = '1';
  el.setAttribute('aria-disabled', 'true');
}

function unlockControl(el: HTMLElement) {
  if (el.dataset.readonlyLocked !== '1') return;
  if ('disabled' in el) {
    (el as HTMLButtonElement).disabled = el.dataset.readonlyWasDisabled === '1';
  }
  delete el.dataset.readonlyLocked;
  delete el.dataset.readonlyWasDisabled;
  el.removeAttribute('aria-disabled');
}

const ViewOnlyGuard: React.FC<ViewOnlyGuardProps> = ({ active, children }) => {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!active || !root) return;

    const apply = () => {
      root.querySelectorAll<HTMLElement>('button, input, textarea, select, a, [role="switch"]').forEach((el) => {
        if (el.closest('[data-readonly-banner]')) return;
        if (isAllowedViewControl(el)) unlockControl(el);
        else lockControl(el);
      });
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(root, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      root.querySelectorAll<HTMLElement>('[data-readonly-locked="1"]').forEach(unlockControl);
    };
  }, [active]);

  const blockWrite = (event: React.SyntheticEvent) => {
    if (!active) return;
    const target = event.target as HTMLElement | null;
    const control = target?.closest('button, input, textarea, select, a, label, [role="switch"]');
    if (!control || control.closest('[data-readonly-banner]')) return;
    const field = control.tagName === 'LABEL'
      ? control.querySelector('input, textarea, select') || control
      : control;
    if (isAllowedViewControl(field)) return;
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div
      ref={rootRef}
      onClickCapture={blockWrite}
      onChangeCapture={blockWrite}
      onInputCapture={blockWrite}
      onSubmitCapture={blockWrite}
      onKeyDownCapture={blockWrite}
    >
      {active && (
        <p data-readonly-banner="true" className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Bạn chỉ được xem mục này. Không thể bật, tắt, sửa hoặc xóa.
        </p>
      )}
      {children}
    </div>
  );
};

export default ViewOnlyGuard;
