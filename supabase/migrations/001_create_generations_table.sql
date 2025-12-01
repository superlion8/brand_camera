-- 创建生成任务记录表
CREATE TABLE IF NOT EXISTS generations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- 任务信息
  task_type VARCHAR(50) NOT NULL DEFAULT 'camera', -- 'camera' | 'edit'
  status VARCHAR(20) NOT NULL DEFAULT 'completed', -- 'pending' | 'processing' | 'completed' | 'failed'
  
  -- 生成统计
  product_images_count INTEGER DEFAULT 0,
  model_images_count INTEGER DEFAULT 0,
  total_images_count INTEGER DEFAULT 0,
  
  -- 输入参数 (JSONB 格式存储)
  input_params JSONB DEFAULT '{}',
  -- input_params 结构示例:
  -- {
  --   "product_image_url": "https://...",  -- 或 base64 数据引用
  --   "model_style": "japanese",
  --   "model_gender": "female",
  --   "model_image_url": "https://...",
  --   "background_image_url": "https://...",
  --   "vibe_image_url": "https://...",
  --   "custom_prompt": "..."
  -- }
  
  -- 输出结果 (JSONB 格式存储)
  output_images JSONB DEFAULT '[]',
  -- output_images 结构示例:
  -- [
  --   { "type": "product", "url": "https://...", "index": 0 },
  --   { "type": "product", "url": "https://...", "index": 1 },
  --   { "type": "model", "url": "https://...", "index": 2 },
  --   { "type": "model", "url": "https://...", "index": 3 }
  -- ]
  
  -- 错误信息（如果失败）
  error_message TEXT,
  
  -- 性能指标
  duration_ms INTEGER, -- 生成耗时（毫秒）
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引以优化查询
CREATE INDEX idx_generations_user_id ON generations(user_id);
CREATE INDEX idx_generations_created_at ON generations(created_at DESC);
CREATE INDEX idx_generations_task_type ON generations(task_type);
CREATE INDEX idx_generations_status ON generations(status);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_generations_updated_at
  BEFORE UPDATE ON generations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 启用 Row Level Security (RLS)
ALTER TABLE generations ENABLE ROW LEVEL SECURITY;

-- 用户只能查看和操作自己的记录
CREATE POLICY "Users can view own generations"
  ON generations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own generations"
  ON generations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own generations"
  ON generations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own generations"
  ON generations FOR DELETE
  USING (auth.uid() = user_id);

-- 创建用户统计视图
CREATE OR REPLACE VIEW user_generation_stats AS
SELECT 
  user_id,
  COUNT(*) as total_generations,
  SUM(total_images_count) as total_images,
  SUM(product_images_count) as total_product_images,
  SUM(model_images_count) as total_model_images,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_generations,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_generations,
  AVG(duration_ms) as avg_duration_ms,
  MAX(created_at) as last_generation_at
FROM generations
GROUP BY user_id;

-- 注释说明
COMMENT ON TABLE generations IS '用户生成任务记录表';
COMMENT ON COLUMN generations.user_id IS '用户ID，关联 auth.users';
COMMENT ON COLUMN generations.task_type IS '任务类型：camera(拍摄生成) 或 edit(编辑)';
COMMENT ON COLUMN generations.status IS '任务状态：pending/processing/completed/failed';
COMMENT ON COLUMN generations.input_params IS '输入参数，包含商品图、模特风格、背景等';
COMMENT ON COLUMN generations.output_images IS '生成的图片数组';
COMMENT ON COLUMN generations.duration_ms IS '生成耗时（毫秒）';

