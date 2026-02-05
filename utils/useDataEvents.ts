import { useEffect, useRef } from 'react';
import { dataEvents, DataEventType } from '../services/events';

/**
 * Hook để listen data events và tự động reload khi dữ liệu thay đổi
 * 
 * @param eventTypes - Các loại events cần listen
 * @param onEvent - Callback được gọi khi event xảy ra
 * @param enabled - Có enable listening hay không (default: true)
 * 
 * @example
 * ```tsx
 * useDataEvents(
 *   ['users:created', 'users:updated', 'users:deleted'],
 *   () => {
 *     loadUsers();
 *   }
 * );
 * ```
 */
export const useDataEvents = (
  eventTypes: DataEventType[],
  onEvent: (eventType: DataEventType, data?: any) => void | Promise<void>,
  enabled: boolean = true
) => {
  const onEventRef = useRef(onEvent);
  const enabledRef = useRef(enabled);

  // Update refs khi props thay đổi
  useEffect(() => {
    onEventRef.current = onEvent;
    enabledRef.current = enabled;
  }, [onEvent, enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Tạo handlers cho mỗi event type
    const handlers = eventTypes.map(eventType => {
      const handler = async (data?: any) => {
        if (enabledRef.current) {
          await onEventRef.current(eventType, data);
        }
      };
      dataEvents.on(eventType, handler);
      return { eventType, handler };
    });

    // Cleanup: unsubscribe khi component unmount hoặc dependencies thay đổi
    return () => {
      handlers.forEach(({ eventType, handler }) => {
        dataEvents.off(eventType, handler);
      });
    };
  }, [eventTypes.join(','), enabled]); // Dùng join để so sánh array
};

/**
 * Hook đơn giản để reload khi có bất kỳ thay đổi nào về một loại dữ liệu
 * 
 * @param dataType - Loại dữ liệu ('users', 'attendance', 'shifts', 'payroll', 'departments', 'holidays', 'config', 'notifications')
 * @param reloadFn - Function để reload dữ liệu
 * @param enabled - Có enable listening hay không (default: true)
 * 
 * @example
 * ```tsx
 * useDataReload('users', loadUsers);
 * useDataReload('attendance', loadAttendance);
 * ```
 */
export const useDataReload = (
  dataType: 'users' | 'attendance' | 'shifts' | 'payroll' | 'departments' | 'holidays' | 'config' | 'notifications',
  reloadFn: () => void | Promise<void>,
  enabled: boolean = true
) => {
  const eventTypes: DataEventType[] = (() => {
    switch (dataType) {
      case 'users':
        return ['users:created', 'users:updated', 'users:deleted'];
      case 'attendance':
        return ['attendance:created', 'attendance:updated', 'attendance:deleted'];
      case 'shifts':
        return ['shifts:created', 'shifts:updated', 'shifts:deleted'];
      case 'payroll':
        return ['payroll:created', 'payroll:updated', 'payroll:deleted'];
      case 'departments':
        return ['departments:created', 'departments:updated', 'departments:deleted'];
      case 'holidays':
        return ['holidays:created', 'holidays:updated', 'holidays:deleted'];
      case 'config':
        return ['config:updated'];
      case 'notifications':
        return ['notifications:created', 'notifications:updated'];
      default:
        return [];
    }
  })();

  useDataEvents(eventTypes, reloadFn, enabled);
};
