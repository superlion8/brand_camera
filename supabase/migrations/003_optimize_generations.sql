-- =====================================================
-- 优化 generations 表结构
-- =====================================================

-- 1. 创建用户信息视图 (因为 auth.users 是 Supabase 管理的)
CREATE OR REPLACE VIEW public.users_view AS
SELECT 
  id,
  email,
  raw_user_meta_data->>'full_name' as full_name,
  raw_user_meta_data->>'avatar_url' as avatar_url,
  created_at,
  last_sign_in_at
FROM auth.users;

-- 给视图设置权限 (只有 service_role 可以查看全部，用户只能看自己)
GRANT SELECT ON public.users_view TO authenticated;

-- 2. 添加新字段到 generations 表
ALTER TABLE generations 
ADD COLUMN IF NOT EXISTS user_email TEXT,
ADD COLUMN IF NOT EXISTS input_image_url TEXT,
ADD COLUMN IF NOT EXISTS input_image2_url TEXT,
ADD COLUMN IF NOT EXISTS model_image_url TEXT,
ADD COLUMN IF NOT EXISTS background_image_url TEXT,
ADD COLUMN IF NOT EXISTS final_prompt TEXT,
ADD COLUMN IF NOT EXISTS simple_mode_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS extended_mode_count INTEGER DEFAULT 0;

-- 3. 更新 task_type 的注释说明新的类型
COMMENT ON COLUMN generations.task_type IS '任务类型：model_studio(模特影棚) / product_studio(商品影棚) / edit(修图室)';

-- 4. 创建触发器自动填充 user_email
CREATE OR REPLACE FUNCTION set_user_email()
RETURNS TRIGGER AS $$
BEGIN
  SELECT email INTO NEW.user_email
  FROM auth.users
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS set_user_email_trigger ON generations;
CREATE TRIGGER set_user_email_trigger
  BEFORE INSERT ON generations
  FOR EACH ROW
  EXECUTE FUNCTION set_user_email();

-- 5. 更新现有记录的 user_email
UPDATE generations g
SET user_email = u.email
FROM auth.users u
WHERE g.user_id = u.id AND g.user_email IS NULL;

-- 6. 创建管理员视图 (需要 service_role 权限才能看到全部数据)
CREATE OR REPLACE VIEW public.generations_admin_view AS
SELECT 
  g.id,
  g.user_id,
  g.user_email,
  g.task_type,
  g.status,
  g.input_image_url,
  g.input_image2_url,
  g.model_image_url,
  g.background_image_url,
  g.final_prompt,
  g.product_images_count,
  g.model_images_count,
  g.simple_mode_count,
  g.extended_mode_count,
  g.total_images_count,
  g.output_images,
  g.duration_ms,
  g.error_message,
  g.created_at,
  g.updated_at
FROM generations g
ORDER BY g.created_at DESC;

-- 7. 更新 user_generation_stats 视图
DROP VIEW IF EXISTS user_generation_stats;
CREATE OR REPLACE VIEW user_generation_stats AS
SELECT 
  user_id,
  user_email,
  COUNT(*) as total_generations,
  SUM(total_images_count) as total_images,
  SUM(product_images_count) as total_product_images,
  SUM(model_images_count) as total_model_images,
  SUM(simple_mode_count) as total_simple_mode,
  SUM(extended_mode_count) as total_extended_mode,
  COUNT(CASE WHEN task_type = 'model_studio' THEN 1 END) as model_studio_count,
  COUNT(CASE WHEN task_type = 'product_studio' THEN 1 END) as product_studio_count,
  COUNT(CASE WHEN task_type = 'edit' THEN 1 END) as edit_count,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_generations,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_generations,
  AVG(duration_ms) as avg_duration_ms,
  MAX(created_at) as last_generation_at
FROM generations
GROUP BY user_id, user_email;

-- 8. 注释说明新字段
COMMENT ON COLUMN generations.user_email IS '用户邮箱（自动填充）';
COMMENT ON COLUMN generations.input_image_url IS '输入商品图 URL';
COMMENT ON COLUMN generations.input_image2_url IS '第二张输入商品图 URL（可选）';
COMMENT ON COLUMN generations.model_image_url IS '参考模特图 URL';
COMMENT ON COLUMN generations.background_image_url IS '参考背景/环境图 URL';
COMMENT ON COLUMN generations.final_prompt IS '最终发送给 AI 的 prompt';
COMMENT ON COLUMN generations.simple_mode_count IS '极简模式生成数量';
COMMENT ON COLUMN generations.extended_mode_count IS '扩展模式生成数量';


