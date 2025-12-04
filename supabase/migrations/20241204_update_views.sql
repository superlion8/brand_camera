-- =====================================================
-- 更新用户视图和统计视图
-- =====================================================

-- 1. 更新 users_view，添加注册国家
DROP VIEW IF EXISTS public.users_view;
CREATE OR REPLACE VIEW public.users_view AS
SELECT 
  id,
  email,
  raw_user_meta_data->>'full_name' as full_name,
  raw_user_meta_data->>'avatar_url' as avatar_url,
  raw_user_meta_data->>'country' as country,  -- 从 metadata 获取国家
  raw_app_meta_data->>'provider' as auth_provider,  -- 登录方式
  created_at,
  last_sign_in_at
FROM auth.users;

-- 给视图设置权限
GRANT SELECT ON public.users_view TO authenticated;
GRANT SELECT ON public.users_view TO service_role;

-- 2. 更新 user_generation_stats 视图，确保有 user_email
DROP VIEW IF EXISTS user_generation_stats;
CREATE OR REPLACE VIEW user_generation_stats AS
SELECT 
  g.user_id,
  COALESCE(g.user_email, u.email) as user_email,  -- 优先用 generations 表的，fallback 到 users
  u.raw_user_meta_data->>'country' as country,  -- 添加国家
  COUNT(*) as total_generations,
  SUM(COALESCE(g.total_images_count, 0)) as total_images,
  SUM(COALESCE(g.product_images_count, 0)) as total_product_images,
  SUM(COALESCE(g.model_images_count, 0)) as total_model_images,
  SUM(COALESCE(g.simple_mode_count, 0)) as total_simple_mode,
  SUM(COALESCE(g.extended_mode_count, 0)) as total_extended_mode,
  COUNT(CASE WHEN g.task_type = 'model_studio' THEN 1 END) as model_studio_count,
  COUNT(CASE WHEN g.task_type = 'product_studio' THEN 1 END) as product_studio_count,
  COUNT(CASE WHEN g.task_type = 'edit' THEN 1 END) as edit_count,
  COUNT(CASE WHEN g.status = 'completed' THEN 1 END) as successful_generations,
  COUNT(CASE WHEN g.status = 'failed' THEN 1 END) as failed_generations,
  AVG(g.duration_ms) as avg_duration_ms,
  MAX(g.created_at) as last_generation_at
FROM generations g
LEFT JOIN auth.users u ON g.user_id = u.id
GROUP BY g.user_id, g.user_email, u.email, u.raw_user_meta_data->>'country';

-- 给视图设置权限
GRANT SELECT ON user_generation_stats TO authenticated;
GRANT SELECT ON user_generation_stats TO service_role;

-- 3. 添加注释
COMMENT ON VIEW public.users_view IS '用户信息视图，包含注册国家';
COMMENT ON VIEW user_generation_stats IS '用户生成统计视图，包含 email 和国家';

