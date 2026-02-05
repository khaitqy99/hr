/**
 * Utility functions for exporting data to CSV
 */

const escapeCSVValue = (value: any): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  // Escape commas và quotes
  const stringValue = String(value).replace(/,/g, ';').replace(/"/g, '""');
  // Wrap in quotes if contains special characters
  if (stringValue.includes(';') || stringValue.includes('\n') || stringValue.includes('"')) {
    return `"${stringValue}"`;
  }
  return stringValue;
};

/**
 * Format số theo định dạng Việt Nam (dấu chấm cho hàng nghìn)
 */
const formatNumberVN = (num: number): string => {
  return num.toLocaleString('vi-VN');
};

/**
 * Format thời gian từ timestamp sang HH:mm
 */
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

/**
 * Kiểm tra xem một ngày có phải là ngày lễ không
 */
const isHoliday = (date: Date, holidays: Array<{ date: number; isRecurring: boolean }>): boolean => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  for (const holiday of holidays) {
    const holidayDate = new Date(holiday.date);
    const holidayYear = holidayDate.getFullYear();
    const holidayMonth = holidayDate.getMonth();
    const holidayDay = holidayDate.getDate();

    if (holiday.isRecurring) {
      if (holidayMonth === month && holidayDay === day) return true;
    } else {
      if (holidayYear === year && holidayMonth === month && holidayDay === day) return true;
    }
  }
  return false;
};

export const exportToCSV = (data: any[], filename: string) => {
  if (data.length === 0) {
    alert('Không có dữ liệu để xuất');
    return;
  }

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(header => escapeCSVValue(row[header])).join(','))
  ].join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Xuất nhiều bảng vào một file CSV
 * @param sections Mảng các section, mỗi section có title và data
 */
export const exportMultipleTablesToCSV = (
  sections: Array<{ title: string; data: any[] }>,
  filename: string
) => {
  if (sections.length === 0 || sections.every(s => s.data.length === 0)) {
    alert('Không có dữ liệu để xuất');
    return;
  }

  const csvSections: string[] = [];

  sections.forEach((section, index) => {
    if (section.data.length === 0) return;

    // Thêm tiêu đề section
    csvSections.push(`"=== ${section.title} ==="`);
    
    // Thêm header
    const headers = Object.keys(section.data[0]);
    csvSections.push(headers.join(','));

    // Thêm dữ liệu
    section.data.forEach(row => {
      const rowData = headers.map(header => escapeCSVValue(row[header])).join(',');
      csvSections.push(rowData);
    });

    // Thêm dòng trống giữa các section (trừ section cuối)
    if (index < sections.length - 1) {
      csvSections.push('');
    }
  });

  const csvContent = csvSections.join('\n');
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
