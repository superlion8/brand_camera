-- 添加 used_credits 字段到 user_quotas 表
-- 用于记录用户累计消费的 credits，避免每次从 generations 表计算
-- 运行时间: 2026-01-14

-- 1. 添加 used_credits 字段
ALTER TABLE user_quotas 
ADD COLUMN IF NOT EXISTS used_credits INT DEFAULT 0;

COMMENT ON COLUMN user_quotas.used_credits IS '累计已消费的 credits 数量';

-- 2. 从 generations 表统计历史数据并初始化 used_credits
-- 只统计 status = 'completed' 的记录
WITH usage_stats AS (
  SELECT 
    user_id, 
    SUM(COALESCE(array_length(output_image_urls, 1), 0)) as total_used
  FROM generations 
  WHERE status = 'completed' 
    AND output_image_urls IS NOT NULL
  GROUP BY user_id
)
UPDATE user_quotas q
SET used_credits = COALESCE(u.total_used, 0)
FROM usage_stats u
WHERE q.user_id = u.user_id;

-- 3. 确保所有用户都有 used_credits 值（没有生成记录的用户设为 0）
UPDATE user_quotas 
SET used_credits = 0 
WHERE used_credits IS NULL;
