-- 添加管理员赠送总额度字段
-- 运行时间: 2026-01-15
--
-- 变更说明：
-- 1. 新增 admin_give_total 字段，记录管理员总共赠送的额度
-- 2. admin_give_credits 仍然记录剩余额度
-- 3. 初始化：admin_give_total = admin_give_credits（假设之前没有消费过赠送额度）

-- ============================================
-- 1. 添加新字段
-- ============================================

-- 管理员赠送总额度
ALTER TABLE user_quotas 
ADD COLUMN IF NOT EXISTS admin_give_total INT DEFAULT 0;

-- ============================================
-- 2. 数据迁移：把现有 admin_give_credits 复制到 admin_give_total
-- ============================================

UPDATE user_quotas 
SET admin_give_total = COALESCE(admin_give_credits, 0)
WHERE admin_give_total = 0 OR admin_give_total IS NULL;

-- ============================================
-- 3. 添加注释
-- ============================================

COMMENT ON COLUMN user_quotas.admin_give_total IS '管理员赠送总额度（累计），用于展示历史赠送总量';
