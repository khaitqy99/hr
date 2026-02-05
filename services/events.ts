/**
 * Event System for Cross-Component Data Updates
 * 
 * Giải quyết vấn đề:
 * 1. Cross-tab Updates: Khi thay đổi dữ liệu ở một tab, các tab khác tự động cập nhật
 * 2. Event System: Hệ thống event để notify các component khi dữ liệu thay đổi
 * 3. Cache Invalidation: Hỗ trợ invalidate cache cho tất cả các loại dữ liệu
 */

export type DataEventType = 
  | 'users:created'
  | 'users:updated'
  | 'users:deleted'
  | 'attendance:created'
  | 'attendance:updated'
  | 'attendance:deleted'
  | 'shifts:created'
  | 'shifts:updated'
  | 'shifts:deleted'
  | 'payroll:created'
  | 'payroll:updated'
  | 'payroll:deleted'
  | 'departments:created'
  | 'departments:updated'
  | 'departments:deleted'
  | 'holidays:created'
  | 'holidays:updated'
  | 'holidays:deleted'
  | 'config:updated'
  | 'notifications:created'
  | 'notifications:updated';

type EventHandler = (data?: any) => void | Promise<void>;

class EventEmitter {
  private handlers: Map<DataEventType, Set<EventHandler>> = new Map();

  /**
   * Đăng ký listener cho một event type
   */
  on(eventType: DataEventType, handler: EventHandler): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);

    // Trả về function để unsubscribe
    return () => {
      this.handlers.get(eventType)?.delete(handler);
    };
  }

  /**
   * Hủy đăng ký listener
   */
  off(eventType: DataEventType, handler: EventHandler): void {
    this.handlers.get(eventType)?.delete(handler);
  }

  /**
   * Emit event đến tất cả listeners
   */
  async emit(eventType: DataEventType, data?: any): Promise<void> {
    const handlers = this.handlers.get(eventType);
    if (!handlers || handlers.size === 0) {
      return;
    }

    // Gọi tất cả handlers (có thể async)
    const promises = Array.from(handlers).map(handler => {
      try {
        return Promise.resolve(handler(data));
      } catch (error) {
        console.error(`Error in event handler for ${eventType}:`, error);
        return Promise.resolve();
      }
    });

    await Promise.all(promises);
  }

  /**
   * Xóa tất cả listeners
   */
  clear(): void {
    this.handlers.clear();
  }
}

// Singleton instance
export const dataEvents = new EventEmitter();

/**
 * Helper functions để emit events cho các loại dữ liệu phổ biến
 */
export const emitUserEvent = async (action: 'created' | 'updated' | 'deleted', userId?: string) => {
  await dataEvents.emit(`users:${action}`, { userId });
};

export const emitAttendanceEvent = async (action: 'created' | 'updated' | 'deleted', recordId?: string) => {
  await dataEvents.emit(`attendance:${action}`, { recordId });
};

export const emitShiftEvent = async (action: 'created' | 'updated' | 'deleted', shiftId?: string) => {
  await dataEvents.emit(`shifts:${action}`, { shiftId });
};

export const emitPayrollEvent = async (action: 'created' | 'updated' | 'deleted', payrollId?: string) => {
  await dataEvents.emit(`payroll:${action}`, { payrollId });
};

export const emitDepartmentEvent = async (action: 'created' | 'updated' | 'deleted', departmentId?: string) => {
  await dataEvents.emit(`departments:${action}`, { departmentId });
};

export const emitHolidayEvent = async (action: 'created' | 'updated' | 'deleted', holidayId?: string) => {
  await dataEvents.emit(`holidays:${action}`, { holidayId });
};

export const emitConfigEvent = async () => {
  await dataEvents.emit('config:updated');
};

export const emitNotificationEvent = async (action: 'created' | 'updated', notificationId?: string) => {
  await dataEvents.emit(`notifications:${action}`, { notificationId });
};
