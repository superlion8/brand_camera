-- Add daily reward tracking to user_quotas
-- 用于追踪用户每日登录奖励领取时间

ALTER TABLE user_quotas 
ADD COLUMN IF NOT EXISTS last_daily_reward_at TIMESTAMPTZ;

-- Add comment
COMMENT ON COLUMN user_quotas.last_daily_reward_at IS '上次领取每日登录奖励的时间';
