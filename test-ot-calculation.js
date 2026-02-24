// Script test công thức tính OT
// Công thức: (LCB / 27 / 8) × 1.5 × số giờ OT

function calculateOT(baseSalary, otHours, standardWorkDays = 27, workHoursPerDay = 8, overtimeRate = 1.5) {
  const hourlyRate = baseSalary / standardWorkDays / workHoursPerDay;
  const otHourlyRate = hourlyRate * overtimeRate;
  const otPay = otHourlyRate * otHours;
  
  console.log('=== Tính toán OT ===');
  console.log('Lương cơ bản:', baseSalary.toLocaleString('vi-VN'), 'đ');
  console.log('Số giờ OT:', otHours, 'giờ');
  console.log('');
  console.log('Bước 1: Lương 1 giờ =', baseSalary, '/', standardWorkDays, '/', workHoursPerDay);
  console.log('       =', hourlyRate.toFixed(2), 'đ/giờ');
  console.log('');
  console.log('Bước 2: Lương 1 giờ OT = Lương 1 giờ × Hệ số OT');
  console.log('       =', hourlyRate.toFixed(2), '×', overtimeRate);
  console.log('       =', otHourlyRate.toFixed(2), 'đ/giờ OT');
  console.log('');
  console.log('Bước 3: Tiền OT = Lương 1 giờ OT × Số giờ');
  console.log('       =', otHourlyRate.toFixed(2), '×', otHours);
  console.log('       =', otPay.toFixed(2), 'đ');
  console.log('       =', Math.round(otPay).toLocaleString('vi-VN'), 'đ (làm tròn)');
  console.log('===================');
  
  return Math.round(otPay);
}

// Test case từ ảnh
console.log('\n📊 TEST CASE TỪ ẢNH:');
console.log('Lương cơ bản: 7.200.000 đ');
console.log('OT: 3.5 giờ');
console.log('Kết quả mong đợi: 175.000 đ');
console.log('Kết quả hệ thống hiện tại: 155.556 đ');
console.log('');

const result = calculateOT(7200000, 3.5);

console.log('\n✅ KẾT QUẢ:');
if (result === 175000) {
  console.log('✓ ĐÚNG! Công thức tính chính xác:', result.toLocaleString('vi-VN'), 'đ');
} else {
  console.log('✗ SAI! Kết quả:', result.toLocaleString('vi-VN'), 'đ');
  console.log('   Mong đợi: 175.000 đ');
  console.log('   Chênh lệch:', (result - 175000).toLocaleString('vi-VN'), 'đ');
}

// Test thêm các case khác
console.log('\n\n📊 TEST CASES KHÁC:');
console.log('\n--- Case 1: 10 triệu, 5 giờ OT ---');
calculateOT(10000000, 5);

console.log('\n--- Case 2: 5 triệu, 2 giờ OT ---');
calculateOT(5000000, 2);

console.log('\n--- Case 3: 15 triệu, 10 giờ OT ---');
calculateOT(15000000, 10);
