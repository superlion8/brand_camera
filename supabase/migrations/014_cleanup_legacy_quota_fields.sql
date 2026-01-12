-- 清理 user_quotas 表中的冗余字段
-- 运行时间: 2026-01-12
--
-- 背景：
-- 013_credits_redesign.sql 将旧的额度系统迁移到新的 credits 系统
-- 旧字段已不再使用，需要清理以保持表结构整洁
--
-- 删除的字段：
-- - total_quota: 已迁移到 admin_give_credits
-- - used_quota: 不再使用，各 credits 字段独立记录余额
-- - used_count: 不再使用
-- - last_daily_reward_at: 已被 daily_credits_date 替代
-- - credits_reset_at: 不再需要（订阅重置逻辑改为 webhook 处理）

-- ============================================
-- 1. 删除废弃字段
-- ============================================

-- 旧额度系统字段
ALTER TABLE user_quotas DROP COLUMN IF EXISTS total_quota;
ALTER TABLE user_quotas DROP COLUMN IF EXISTS used_quota;
ALTER TABLE user_quotas DROP COLUMN IF EXISTS used_count;

-- 旧的每日奖励追踪字段（已被 daily_credits_date 替代）
ALTER TABLE user_quotas DROP COLUMN IF EXISTS last_daily_reward_at;

-- 订阅 credits 重置时间（不再需要，由 webhook 直接重置 subscription_credits）
ALTER TABLE user_quotas DROP COLUMN IF EXISTS credits_reset_at;

-- ============================================
-- 2. 更新注释
-- ============================================

COMMENT ON TABLE user_quotas IS 'User credits balance - 用户额度余额表';
COMMENT ON COLUMN user_quotas.daily_credits IS '每日登录奖励余额，当天有效，次日清零';
COMMENT ON COLUMN user_quotas.daily_credits_date IS '每日奖励的日期，用于判断是否过期';
COMMENT ON COLUMN user_quotas.subscription_credits IS '订阅赠送余额，每月重置';
COMMENT ON COLUMN user_quotas.signup_credits IS '注册赠送余额，永久有效';
COMMENT ON COLUMN user_quotas.admin_give_credits IS '管理员赠送/系统补偿余额，永久有效';
COMMENT ON COLUMN user_quotas.purchased_credits IS '充值购买余额，永久有效';
COMMENT ON COLUMN user_quotas.stripe_customer_id IS 'Stripe 客户 ID';
