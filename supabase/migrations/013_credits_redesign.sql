-- Credits 系统重构迁移
-- 运行时间: 2026-01-12
--
-- 变更说明：
-- 1. 新增 daily_credits, daily_credits_date, signup_credits, admin_give_credits 字段
-- 2. 把现有剩余额度 (total_quota - used_quota) 转入 admin_give_credits
-- 3. signup_credits 设为 0（已包含在 admin_give_credits 中），新用户注册时才给 10

-- ============================================
-- 1. 添加新字段
-- ============================================

-- 每日奖励余额
ALTER TABLE user_quotas 
ADD COLUMN IF NOT EXISTS daily_credits INT DEFAULT 0;

-- 每日奖励日期（用于判断是否过期）
ALTER TABLE user_quotas 
ADD COLUMN IF NOT EXISTS daily_credits_date DATE;

-- 注册赠送余额（新用户才有，老用户的已包含在 admin_give_credits）
ALTER TABLE user_quotas 
ADD COLUMN IF NOT EXISTS signup_credits INT DEFAULT 0;

-- 管理员赠送余额（永久有效）
ALTER TABLE user_quotas 
ADD COLUMN IF NOT EXISTS admin_give_credits INT DEFAULT 0;

-- ============================================
-- 2. 数据迁移：把现有剩余额度转入 admin_give_credits
-- ============================================

-- 简单直接：剩余额度 = total_quota - used_quota，写入 admin_give_credits
UPDATE user_quotas 
SET 
  admin_give_credits = GREATEST(0, COALESCE(total_quota, 0) - COALESCE(used_quota, 0)),
  signup_credits = 0;  -- 老用户的注册赠送已包含在 admin_give_credits 中

-- ============================================
-- 3. 添加注释
-- ============================================

COMMENT ON COLUMN user_quotas.daily_credits IS '每日登录奖励余额，当天有效，次日清零';
COMMENT ON COLUMN user_quotas.daily_credits_date IS '每日奖励的日期，用于判断是否过期';
COMMENT ON COLUMN user_quotas.signup_credits IS '注册赠送余额，永久有效（新用户 10，老用户 0 因已迁移到 admin_give_credits）';
COMMENT ON COLUMN user_quotas.admin_give_credits IS '管理员赠送/系统补偿余额，永久有效';
COMMENT ON COLUMN user_quotas.subscription_credits IS '订阅赠送余额，每月重置';
COMMENT ON COLUMN user_quotas.purchased_credits IS '充值购买余额，永久有效';

-- ============================================
-- 4. 标记旧字段为废弃
-- ============================================

COMMENT ON COLUMN user_quotas.total_quota IS '[DEPRECATED] 已迁移到 admin_give_credits';
COMMENT ON COLUMN user_quotas.used_quota IS '[DEPRECATED] 不再使用，各 credits 字段独立记录余额';

-- ============================================
-- 5. 清理旧字段（确认迁移成功后手动执行）
-- ============================================

-- 确认新系统正常运行后，执行以下命令删除旧字段：
-- ALTER TABLE user_quotas DROP COLUMN IF EXISTS total_quota;
-- ALTER TABLE user_quotas DROP COLUMN IF EXISTS used_quota;
-- ALTER TABLE user_quotas DROP COLUMN IF EXISTS used_count;
