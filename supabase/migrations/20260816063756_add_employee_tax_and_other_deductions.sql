-- Per-employee PIT and other deductions; store breakdown on payroll for payslip display

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS personal_income_tax NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS other_deductions NUMERIC(15, 2);

COMMENT ON COLUMN public.users.personal_income_tax IS 'Khấu trừ thuế TNCN cố định hàng tháng (VNĐ) theo từng nhân viên';
COMMENT ON COLUMN public.users.other_deductions IS 'Các khoản khấu trừ khác cố định hàng tháng (VNĐ) theo từng nhân viên';

ALTER TABLE public.payroll_records
  ADD COLUMN IF NOT EXISTS social_insurance_deduction NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS personal_income_tax NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS other_deductions NUMERIC(15, 2);

COMMENT ON COLUMN public.payroll_records.social_insurance_deduction IS 'Phần khấu trừ BHXH trong kỳ';
COMMENT ON COLUMN public.payroll_records.personal_income_tax IS 'Phần khấu trừ thuế TNCN trong kỳ';
COMMENT ON COLUMN public.payroll_records.other_deductions IS 'Phần khấu trừ khác trong kỳ';
