-- 添加 used_quota 字段到 user_quotas 表
-- 用于直接存储已使用的额度，而不是每次都从 generations 表计算

-- 1. 添加 used_quota 字段（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_quotas' AND column_name = 'used_quota'
  ) THEN
    ALTER TABLE user_quotas ADD COLUMN used_quota INTEGER DEFAULT 0;
  END IF;
END $$;

-- 2. 根据现有 generations 数据初始化 used_quota
-- 这会计算每个用户的已用额度并更新 user_quotas 表
WITH user_usage AS (
  SELECT 
    user_id,
    COALESCE(SUM(
      CASE 
        WHEN total_images_count IS NOT NULL THEN total_images_count
        WHEN output_image_urls IS NOT NULL THEN array_length(output_image_urls, 1)
        ELSE 0
      END
    ), 0) as used_count
  FROM generations
  WHERE status IN ('pending', 'processing', 'completed')
  GROUP BY user_id
)
UPDATE user_quotas q
SET used_quota = COALESCE(u.used_count, 0)
FROM user_usage u
WHERE q.user_id = u.user_id;

-- 3. 为还没有 user_quotas 记录但有 generations 的用户创建记录
INSERT INTO user_quotas (user_id, user_email, total_quota, used_quota)
SELECT 
  g.user_id,
  g.user_email,
  30, -- DEFAULT_QUOTA
  COALESCE(SUM(
    CASE 
      WHEN g.total_images_count IS NOT NULL THEN g.total_images_count
      WHEN g.output_image_urls IS NOT NULL THEN array_length(g.output_image_urls, 1)
      ELSE 0
    END
  ), 0)
FROM generations g
WHERE g.status IN ('pending', 'processing', 'completed')
  AND NOT EXISTS (SELECT 1 FROM user_quotas uq WHERE uq.user_id = g.user_id)
GROUP BY g.user_id, g.user_email
ON CONFLICT (user_id) DO NOTHING;

-- 4. 添加注释
COMMENT ON COLUMN user_quotas.used_quota IS '已使用的额度，提交任务时直接扣除，失败时退回';

