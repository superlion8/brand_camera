-- ============================================
-- models_analysis 表升级到 V2 - 完整模特标签数据
-- ============================================

-- 删除已存在的表（如果有）
DROP TABLE IF EXISTS models_analysis CASCADE;

-- 创建新的 models_analysis 表（V2）
CREATE TABLE models_analysis (
  id SERIAL PRIMARY KEY,
  
  -- 基础信息
  schema_version VARCHAR(10) DEFAULT 'v1.0',
  model_id VARCHAR(100) NOT NULL UNIQUE,
  model_gender VARCHAR(20),
  model_ethnicity VARCHAR(50),
  model_age_group VARCHAR(50),
  
  -- 品牌匹配
  model_primary_brand VARCHAR(100),
  model_all_brand JSONB DEFAULT '[]',
  brand_fit_reason TEXT,
  brand_confidence DECIMAL(3,2),
  
  -- 风格匹配
  model_style_primary VARCHAR(100),
  model_style_all JSONB DEFAULT '[]',
  style_fit_reason TEXT,
  style_confidence DECIMAL(3,2),
  
  -- 身体特征
  height_range VARCHAR(50),
  body_shape VARCHAR(50),
  shoulder_type VARCHAR(50),
  leg_ratio VARCHAR(50),
  fit_preference VARCHAR(50),
  
  -- 外貌特征
  hair_length VARCHAR(50),
  hair_color VARCHAR(50),
  makeup_intensity VARCHAR(50),
  facial_hair VARCHAR(50),
  
  -- 气质特征
  expression_intensity VARCHAR(50),
  pose_energy VARCHAR(50),
  
  -- 适用场景
  best_use_cases JSONB DEFAULT '[]',
  outfit_sweet_spots JSONB DEFAULT '[]',
  
  -- 详细描述
  model_desc TEXT,
  
  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_models_analysis_model_id ON models_analysis(model_id);
CREATE INDEX idx_models_analysis_gender ON models_analysis(model_gender);
CREATE INDEX idx_models_analysis_ethnicity ON models_analysis(model_ethnicity);
CREATE INDEX idx_models_analysis_primary_brand ON models_analysis(model_primary_brand);
CREATE INDEX idx_models_analysis_style_primary ON models_analysis(model_style_primary);
CREATE INDEX idx_models_analysis_height ON models_analysis(height_range);
CREATE INDEX idx_models_analysis_body_shape ON models_analysis(body_shape);

-- GIN 索引用于 JSONB 数组搜索
CREATE INDEX idx_models_analysis_all_brand ON models_analysis USING GIN (model_all_brand);
CREATE INDEX idx_models_analysis_style_all ON models_analysis USING GIN (model_style_all);
CREATE INDEX idx_models_analysis_use_cases ON models_analysis USING GIN (best_use_cases);

-- 添加注释
COMMENT ON TABLE models_analysis IS '模特分析数据表 V2 - 完整标签数据';
COMMENT ON COLUMN models_analysis.model_id IS '模特ID，如 ARKET_model1, nobrand_model105';
COMMENT ON COLUMN models_analysis.model_gender IS '性别：male/female';
COMMENT ON COLUMN models_analysis.model_ethnicity IS '种族：White/Black/Asian等';
COMMENT ON COLUMN models_analysis.model_age_group IS '年龄段：YoungAdult/Adult等';
COMMENT ON COLUMN models_analysis.model_primary_brand IS '主要匹配品牌';
COMMENT ON COLUMN models_analysis.model_all_brand IS '所有匹配品牌数组';
COMMENT ON COLUMN models_analysis.brand_confidence IS '品牌匹配置信度 0-1';
COMMENT ON COLUMN models_analysis.model_style_primary IS '主要风格';
COMMENT ON COLUMN models_analysis.model_style_all IS '所有适合风格数组';
COMMENT ON COLUMN models_analysis.style_confidence IS '风格匹配置信度 0-1';
COMMENT ON COLUMN models_analysis.height_range IS '身高范围：Tall/Average/Short';
COMMENT ON COLUMN models_analysis.body_shape IS '体型：Slim/Athletic/Average等';
COMMENT ON COLUMN models_analysis.best_use_cases IS '最佳使用场景数组';
COMMENT ON COLUMN models_analysis.outfit_sweet_spots IS '最适合服装类型数组';
COMMENT ON COLUMN models_analysis.model_desc IS '详细描述';

-- 启用 RLS
ALTER TABLE models_analysis ENABLE ROW LEVEL SECURITY;

-- 允许所有人读取（公开数据）
CREATE POLICY "models_analysis_read_all" ON models_analysis
  FOR SELECT
  USING (true);

