// Types cho Supabase Database
// File này sẽ được generate tự động từ Supabase CLI
// Tạm thời định nghĩa cơ bản để TypeScript không báo lỗi

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          name: string
          email: string
          role: string
          department: string
          avatar_url: string | null
          employee_code: string | null
          job_title: string | null
          contract_type: string | null
          start_date: number | null
          status: string | null
          gross_salary: number | null
          social_insurance_salary: number | null
          trainee_salary: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          email: string
          role: string
          department: string
          avatar_url?: string | null
          employee_code?: string | null
          job_title?: string | null
          contract_type?: string | null
          start_date?: number | null
          status?: string | null
          gross_salary?: number | null
          social_insurance_salary?: number | null
          trainee_salary?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          role?: string
          department?: string
          avatar_url?: string | null
          employee_code?: string | null
          job_title?: string | null
          contract_type?: string | null
          start_date?: number | null
          status?: string | null
          gross_salary?: number | null
          social_insurance_salary?: number | null
          trainee_salary?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      attendance_records: {
        Row: {
          id: string
          user_id: string
          timestamp: number
          type: string
          location: Json
          status: string
          synced: boolean
          notes: string | null
          photo_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          timestamp: number
          type: string
          location: Json
          status: string
          synced?: boolean
          notes?: string | null
          photo_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          timestamp?: number
          type?: string
          location?: Json
          status?: string
          synced?: boolean
          notes?: string | null
          photo_url?: string | null
          created_at?: string
        }
      }
      leave_requests: {
        Row: {
          id: string
          user_id: string
          start_date: number
          end_date: number
          type: string
          reason: string
          status: string
          created_at: number
        }
        Insert: {
          id?: string
          user_id: string
          start_date: number
          end_date: number
          type: string
          reason: string
          status?: string
          created_at?: number
        }
        Update: {
          id?: string
          user_id?: string
          start_date?: number
          end_date?: number
          type?: string
          reason?: string
          status?: string
          created_at?: number
        }
      }
      shift_registrations: {
        Row: {
          id: string
          user_id: string
          date: number
          shift: string
          start_time: string | null
          end_time: string | null
          off_type: string | null
          status: string
          created_at: number
        }
        Insert: {
          id?: string
          user_id: string
          date: number
          shift: string
          start_time?: string | null
          end_time?: string | null
          off_type?: string | null
          status?: string
          created_at?: number
        }
        Update: {
          id?: string
          user_id?: string
          date?: number
          shift?: string
          start_time?: string | null
          end_time?: string | null
          off_type?: string | null
          status?: string
          created_at?: number
        }
      }
      payroll_records: {
        Row: {
          id: string
          user_id: string
          month: string
          base_salary: number
          standard_work_days: number
          actual_work_days: number
          ot_hours: number
          ot_pay: number
          allowance: number
          bonus: number
          deductions: number
          net_salary: number
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          month: string
          base_salary: number
          standard_work_days: number
          actual_work_days: number
          ot_hours: number
          ot_pay: number
          allowance?: number
          bonus?: number
          deductions: number
          net_salary: number
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          month?: string
          base_salary?: number
          standard_work_days?: number
          actual_work_days?: number
          ot_hours?: number
          ot_pay?: number
          allowance?: number
          bonus?: number
          deductions?: number
          net_salary?: number
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          title: string
          message: string
          read: boolean
          timestamp: number
          type: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          message: string
          read?: boolean
          timestamp?: number
          type?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          message?: string
          read?: boolean
          timestamp?: number
          type?: string
          created_at?: string
        }
      }
      departments: {
        Row: {
          id: string
          name: string
          code: string | null
          description: string | null
          manager_id: string | null
          created_at: number
          is_active: boolean
        }
        Insert: {
          id?: string
          name: string
          code?: string | null
          description?: string | null
          manager_id?: string | null
          created_at?: number
          is_active?: boolean
        }
        Update: {
          id?: string
          name?: string
          code?: string | null
          description?: string | null
          manager_id?: string | null
          created_at?: number
          is_active?: boolean
        }
      }
      holidays: {
        Row: {
          id: string
          name: string
          date: number
          type: string
          is_recurring: boolean
          description: string | null
          created_at: number
        }
        Insert: {
          id?: string
          name: string
          date: number
          type: string
          is_recurring?: boolean
          description?: string | null
          created_at?: number
        }
        Update: {
          id?: string
          name?: string
          date?: number
          type?: string
          is_recurring?: boolean
          description?: string | null
          created_at?: number
        }
      }
      system_configs: {
        Row: {
          id: string
          key: string
          value: string
          description: string | null
          category: string
          updated_at: number
          updated_by: string | null
        }
        Insert: {
          id?: string
          key: string
          value: string
          description?: string | null
          category: string
          updated_at?: number
          updated_by?: string | null
        }
        Update: {
          id?: string
          key?: string
          value?: string
          description?: string | null
          category?: string
          updated_at?: number
          updated_by?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
