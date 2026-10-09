import React from 'react';

const WRITE_ACTION = /(thêm|tạo|xóa|xoá|lưu|cập nhật|duyệt|từ chối|nhập|gửi|xuất|import|delete|save|approve|reject|tính lương|ghi đè|áp dụng)/i;

interface ViewOnlyGuardProps {
  active: boolean;
  children: React.ReactNode;
}

const ViewOnlyGuard: React.FC<ViewOnlyGuardProps> = ({ active, children }) => {
  if (!active) return <>{children}</>;

  const blockWrite = (event: React.SyntheticEvent) => {
    const target = event.target as HTMLElement | null;
    const control = target?.closest('button, input[type="submit"], a');
    if (!control) return;
    if (control.getAttribute('data-readonly-allow') === 'true') return;
    const label = `${control.getAttribute('title') || ''} ${control.getAttribute('aria-label') || ''} ${control.textContent || ''}`;
    if (!WRITE_ACTION.test(label) && (control as HTMLInputElement).type !== 'submit') return;
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div onClickCapture={blockWrite} onSubmitCapture={blockWrite}>
      <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Bạn chỉ được xem mục này. Các thao tác thêm, sửa, xóa và xuất dữ liệu đã bị khóa.
      </p>
      {children}
    </div>
  );
};

export default ViewOnlyGuard;
