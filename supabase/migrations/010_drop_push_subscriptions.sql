-- Xóa bảng và function liên quan đến push notifications (đã gỡ tính năng khỏi dự án)
DROP TABLE IF EXISTS push_subscriptions CASCADE;
DROP FUNCTION IF EXISTS update_push_subscriptions_updated_at();
