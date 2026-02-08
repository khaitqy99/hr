/**
 * Ngày lễ Việt Nam - Có hưởng lương theo Bộ luật Lao động 2019 (Điều 112)
 * - Từ 2026: thêm Ngày Văn hóa Việt Nam (24/11) - 12 ngày/năm
 * - Trước 2026: 11 ngày/năm
 */

export interface VietnamHolidaySeed {
  name: string;
  /** YYYY-MM-DD format */
  date: string;
  type: 'NATIONAL';
  isRecurring: boolean;
  description?: string;
}

/** Ngày lễ cố định dương lịch - lặp lại hàng năm */
const FIXED_RECURRING_HOLIDAYS: VietnamHolidaySeed[] = [
  {
    name: 'Tết Dương lịch',
    date: '2000-01-01', // Dùng năm mẫu, isRecurring=true nên chỉ so sánh tháng/ngày
    type: 'NATIONAL',
    isRecurring: true,
    description: 'Ngày nghỉ có hưởng lương theo Bộ luật Lao động',
  },
  {
    name: 'Giải phóng miền Nam, thống nhất đất nước',
    date: '2000-04-30',
    type: 'NATIONAL',
    isRecurring: true,
    description: 'Ngày nghỉ có hưởng lương theo Bộ luật Lao động',
  },
  {
    name: 'Quốc tế Lao động',
    date: '2000-05-01',
    type: 'NATIONAL',
    isRecurring: true,
    description: 'Ngày nghỉ có hưởng lương theo Bộ luật Lao động',
  },
  {
    name: 'Quốc khánh (ngày 1)',
    date: '2000-09-02',
    type: 'NATIONAL',
    isRecurring: true,
    description: 'Ngày nghỉ có hưởng lương theo Bộ luật Lao động',
  },
  {
    name: 'Quốc khánh (ngày 2)',
    date: '2000-09-03',
    type: 'NATIONAL',
    isRecurring: true,
    description: 'Ngày nghỉ có hưởng lương theo Bộ luật Lao động',
  },
  {
    name: 'Ngày Văn hóa Việt Nam',
    date: '2000-11-24',
    type: 'NATIONAL',
    isRecurring: true,
    description: 'Ngày nghỉ có hưởng lương từ 2026 (Nghị quyết 80-NQ/TW)',
  },
];

/** Tết Nguyên Đán - 5 ngày, âm lịch (ngày dương lịch thay đổi mỗi năm) */
const TET_DATES: { year: number; dates: string[] }[] = [
  { year: 2025, dates: ['2025-01-28', '2025-01-29', '2025-01-30', '2025-01-31', '2025-02-01'] },
  { year: 2026, dates: ['2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20'] },
  { year: 2027, dates: ['2027-02-06', '2027-02-07', '2027-02-08', '2027-02-09', '2027-02-10'] },
  { year: 2028, dates: ['2028-01-26', '2028-01-27', '2028-01-28', '2028-01-29', '2028-01-30'] },
  { year: 2029, dates: ['2029-02-13', '2029-02-14', '2029-02-15', '2029-02-16', '2029-02-17'] },
];

/** Giỗ Tổ Hùng Vương - 10/3 âm lịch (ngày dương lịch thay đổi mỗi năm) */
const GIO_TO_HUNG_VUONG_DATES: { year: number; date: string }[] = [
  { year: 2025, date: '2025-04-07' },
  { year: 2026, date: '2026-04-26' },
  { year: 2027, date: '2027-04-18' },
  { year: 2028, date: '2028-04-07' },
  { year: 2029, date: '2029-03-27' },
];

export interface HolidaySeedInput {
  name: string;
  date: number;
  type: 'NATIONAL' | 'COMPANY' | 'REGIONAL';
  isRecurring: boolean;
  description?: string;
}

/**
 * Trả về danh sách tất cả ngày lễ Việt Nam để seed/import
 */
export function getVietnamHolidaysSeed(): HolidaySeedInput[] {
  const result: HolidaySeedInput[] = [];
  const now = Date.now();

  // 1. Ngày lễ cố định dương lịch (recurring)
  for (const h of FIXED_RECURRING_HOLIDAYS) {
    const date = new Date(h.date + 'T00:00:00');
    result.push({
      name: h.name,
      date: date.getTime(),
      type: h.type,
      isRecurring: h.isRecurring,
      description: h.description,
    });
  }

  // 2. Tết Nguyên Đán - 5 ngày mỗi năm
  for (const tet of TET_DATES) {
    const dayNames = ['Mùng 1', 'Mùng 2', 'Mùng 3', 'Mùng 4', 'Mùng 5'];
    tet.dates.forEach((d, i) => {
      const date = new Date(d + 'T00:00:00');
      result.push({
        name: `Tết Nguyên Đán ${tet.year} (${dayNames[i]})`,
        date: date.getTime(),
        type: 'NATIONAL',
        isRecurring: false,
        description: 'Ngày nghỉ có hưởng lương theo Bộ luật Lao động',
      });
    });
  }

  // 3. Giỗ Tổ Hùng Vương
  for (const gio of GIO_TO_HUNG_VUONG_DATES) {
    const date = new Date(gio.date + 'T00:00:00');
    result.push({
      name: `Giỗ Tổ Hùng Vương (${gio.year})`,
      date: date.getTime(),
      type: 'NATIONAL',
      isRecurring: false,
      description: '10/3 âm lịch - Ngày nghỉ có hưởng lương theo Bộ luật Lao động',
    });
  }

  return result;
}
