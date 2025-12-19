-- ============================================
-- pro_studio_scene_tag 表 - 专业棚拍背景标签数据
-- ============================================

-- 删除已存在的表（如果有）
DROP TABLE IF EXISTS pro_studio_scene_tag CASCADE;

-- 创建表
CREATE TABLE pro_studio_scene_tag (
  id SERIAL PRIMARY KEY,
  schema_version VARCHAR(20) DEFAULT 'bg_tag_min_v1',
  background_id VARCHAR(50) NOT NULL UNIQUE,
  space_scale VARCHAR(20),
  
  -- 颜色属性
  color_family VARCHAR(50),
  lightness_level VARCHAR(50),
  color_variation VARCHAR(50),
  
  -- 光照属性
  lighting_type VARCHAR(50),
  shadow_strength VARCHAR(50),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_pro_studio_scene_bg_id ON pro_studio_scene_tag(background_id);
CREATE INDEX idx_pro_studio_scene_space ON pro_studio_scene_tag(space_scale);
CREATE INDEX idx_pro_studio_scene_color ON pro_studio_scene_tag(color_family);
CREATE INDEX idx_pro_studio_scene_lighting ON pro_studio_scene_tag(lighting_type);

-- 添加注释
COMMENT ON TABLE pro_studio_scene_tag IS '专业棚拍背景标签数据表';
COMMENT ON COLUMN pro_studio_scene_tag.background_id IS '背景ID，如 background01';
COMMENT ON COLUMN pro_studio_scene_tag.space_scale IS '空间尺度：small/medium/large';
COMMENT ON COLUMN pro_studio_scene_tag.color_family IS '色系：warm_neutral/cool_neutral等';
COMMENT ON COLUMN pro_studio_scene_tag.lightness_level IS '明度：high_key/mid_key/low_key';
COMMENT ON COLUMN pro_studio_scene_tag.color_variation IS '色彩变化：flat/subtle_variation/strong_variation';
COMMENT ON COLUMN pro_studio_scene_tag.lighting_type IS '光照类型：soft_even/directional_soft等';
COMMENT ON COLUMN pro_studio_scene_tag.shadow_strength IS '阴影强度：none/soft/medium/hard';

-- 启用 RLS
ALTER TABLE pro_studio_scene_tag ENABLE ROW LEVEL SECURITY;

-- 允许所有人读取（公开数据）
CREATE POLICY "pro_studio_scene_tag_read_all" ON pro_studio_scene_tag
  FOR SELECT
  USING (true);

