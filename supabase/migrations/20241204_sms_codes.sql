-- =====================================================
-- 短信验证码表
-- =====================================================

-- 创建验证码表（phone 唯一，新验证码更新而不是创建多条）
CREATE TABLE IF NOT EXISTS sms_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) NOT NULL UNIQUE,  -- 手机号，唯一约束
  code VARCHAR(6) NOT NULL,           -- 6位验证码
  expires_at TIMESTAMPTZ NOT NULL,    -- 过期时间
  attempts INTEGER DEFAULT 0,         -- 验证尝试次数（防暴力破解）
  verified BOOLEAN DEFAULT FALSE,     -- 是否已验证
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_sms_codes_phone ON sms_codes(phone);
CREATE INDEX IF NOT EXISTS idx_sms_codes_expires_at ON sms_codes(expires_at);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_sms_codes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sms_codes_updated_at
  BEFORE UPDATE ON sms_codes
  FOR EACH ROW
  EXECUTE FUNCTION update_sms_codes_updated_at();

-- 定期清理过期验证码的函数（可选，用于定时任务）
CREATE OR REPLACE FUNCTION cleanup_expired_sms_codes()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM sms_codes WHERE expires_at < NOW() - INTERVAL '1 hour';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 添加注释
COMMENT ON TABLE sms_codes IS '短信验证码表，用于手机号登录';
COMMENT ON COLUMN sms_codes.phone IS '手机号（唯一）';
COMMENT ON COLUMN sms_codes.code IS '6位数字验证码';
COMMENT ON COLUMN sms_codes.expires_at IS '验证码过期时间';
COMMENT ON COLUMN sms_codes.attempts IS '验证尝试次数，超过5次锁定';
COMMENT ON COLUMN sms_codes.verified IS '是否已成功验证';

-- 注意：此表不启用 RLS，因为需要服务端直接访问
-- 所有操作都通过 API 进行，使用 service_role key

