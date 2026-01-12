-- Credits 系统重构迁移
-- 运行时间: 2026-01-12
--
-- 变更说明：
-- 1. 新增 daily_credits, daily_credits_date, signup_credits 字段
-- 2. 废弃 total_quota, used_quota 字段（先保留数据，迁移后可删除）
-- 3. 每日奖励改为当天有效，次日清零
-- 4. 消费按优先级扣除：daily > subscription > signup > purchased

-- ============================================
-- 1. 添加新字段
-- ============================================

-- 每日奖励余额
ALTER TABLE user_quotas 
ADD COLUMN IF NOT EXISTS daily_credits INT DEFAULT 0;

-- 每日奖励日期（用于判断是否过期）
ALTER TABLE user_quotas 
ADD COLUMN IF NOT EXISTS daily_credits_date DATE;

-- 注册赠送余额（从 total_quota 中分离出来）
ALTER TABLE user_quotas 
ADD COLUMN IF NOT EXISTS signup_credits INT DEFAULT 10;

-- ============================================
-- 2. 数据迁移
-- ============================================

-- 计算并迁移旧数据
-- 策略：
--   - signup_credits = 10（固定）
--   - 把 total_quota 中超过 10 的部分（历史每日奖励累积）转为 purchased_credits（补偿老用户）
--   - used_quota 需要从各个 credits 中扣除

DO $$
DECLARE
  rec RECORD;
  excess_free INT;
  total_available INT;
  to_deduct INT;
  remaining INT;
BEGIN
  FOR rec IN SELECT * FROM user_quotas LOOP
    -- 计算历史累积的免费 credits（超过注册赠送 10 的部分）
    excess_free := GREATEST(0, COALESCE(rec.total_quota, 10) - 10);
    
    -- 把多余的免费 credits 转为 purchased_credits（补偿老用户）
    -- 只有当 purchased_credits 还没有这部分值时才添加
    IF excess_free > 0 AND (rec.purchased_credits IS NULL OR rec.purchased_credits = 0) THEN
      UPDATE user_quotas 
      SET purchased_credits = COALESCE(purchased_credits, 0) + excess_free
      WHERE user_id = rec.user_id;
    END IF;
    
    -- 设置 signup_credits = 10
    UPDATE user_quotas 
    SET signup_credits = 10
    WHERE user_id = rec.user_id;
    
    -- 处理 used_quota：从新的 credits 体系中扣除
    -- 按照消费优先级的相反顺序扣除（从 purchased 开始）
    IF COALESCE(rec.used_quota, 0) > 0 THEN
      -- 重新读取更新后的数据
      SELECT * INTO rec FROM user_quotas WHERE user_id = rec.user_id;
      
      total_available := COALESCE(rec.subscription_credits, 0) + 
                         COALESCE(rec.signup_credits, 10) + 
                         COALESCE(rec.purchased_credits, 0);
      
      to_deduct := LEAST(rec.used_quota, total_available);
      remaining := to_deduct;
      
      -- 从 purchased 开始扣（因为这是最后消费的，说明前面的已用完）
      IF remaining > 0 AND COALESCE(rec.purchased_credits, 0) > 0 THEN
        UPDATE user_quotas 
        SET purchased_credits = GREATEST(0, purchased_credits - remaining)
        WHERE user_id = rec.user_id;
        remaining := GREATEST(0, remaining - COALESCE(rec.purchased_credits, 0));
      END IF;
      
      -- 再扣 signup
      IF remaining > 0 AND COALESCE(rec.signup_credits, 10) > 0 THEN
        UPDATE user_quotas 
        SET signup_credits = GREATEST(0, signup_credits - remaining)
        WHERE user_id = rec.user_id;
        remaining := GREATEST(0, remaining - COALESCE(rec.signup_credits, 10));
      END IF;
      
      -- 最后扣 subscription
      IF remaining > 0 AND COALESCE(rec.subscription_credits, 0) > 0 THEN
        UPDATE user_quotas 
        SET subscription_credits = GREATEST(0, subscription_credits - remaining)
        WHERE user_id = rec.user_id;
      END IF;
    END IF;
  END LOOP;
END $$;

-- ============================================
-- 3. 添加注释
-- ============================================

COMMENT ON COLUMN user_quotas.daily_credits IS '每日登录奖励余额，当天有效，次日清零';
COMMENT ON COLUMN user_quotas.daily_credits_date IS '每日奖励的日期，用于判断是否过期';
COMMENT ON COLUMN user_quotas.signup_credits IS '注册赠送余额，永久有效';
COMMENT ON COLUMN user_quotas.subscription_credits IS '订阅赠送余额，每月重置';
COMMENT ON COLUMN user_quotas.purchased_credits IS '充值购买余额，永久有效';

-- ============================================
-- 4. 标记旧字段为废弃（暂不删除，保留数据以防回滚）
-- ============================================

COMMENT ON COLUMN user_quotas.total_quota IS '[DEPRECATED] 旧的免费额度字段，已迁移到 signup_credits + purchased_credits';
COMMENT ON COLUMN user_quotas.used_quota IS '[DEPRECATED] 旧的已用额度字段，已分散到各 credits 字段';

-- ============================================
-- 5. 后续清理（手动执行，确认无误后）
-- ============================================

-- 确认迁移成功后，可以执行以下命令删除旧字段：
-- ALTER TABLE user_quotas DROP COLUMN IF EXISTS total_quota;
-- ALTER TABLE user_quotas DROP COLUMN IF EXISTS used_quota;
