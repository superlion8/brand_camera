-- Stripe 支付相关表
-- 运行时间: 2026-01-09

-- 1. 订阅记录表
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Stripe 信息
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,
  
  -- 订阅状态
  status TEXT NOT NULL DEFAULT 'inactive',  -- active/canceled/past_due/incomplete/inactive
  plan_name TEXT,                            -- basic/pro/ultra
  credits_per_period INT DEFAULT 0,          -- 每期 credits 数量
  
  -- 时间
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscription" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- 2. 支付记录表
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Stripe 信息
  stripe_payment_intent_id TEXT,
  stripe_checkout_session_id TEXT UNIQUE,
  stripe_invoice_id TEXT,
  stripe_customer_id TEXT,
  
  -- 支付信息
  amount INT NOT NULL,                       -- 金额（分）
  currency TEXT DEFAULT 'usd',
  status TEXT NOT NULL,                      -- succeeded/pending/failed
  
  -- 商品信息
  payment_type TEXT NOT NULL,                -- subscription/one_time
  plan_name TEXT,                            -- basic/pro/ultra (订阅)
  price_id TEXT,                             -- Stripe Price ID
  credits_purchased INT DEFAULT 0,           -- 购买的 credits
  
  -- 元数据
  metadata JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_session ON payments(stripe_checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);

-- RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own payments" ON payments
  FOR SELECT USING (auth.uid() = user_id);

-- 3. 扩展 user_quotas 表
-- 添加订阅 credits 和购买 credits 分开计算
DO $$ 
BEGIN
  -- subscription_credits: 订阅每月重置的 credits
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_quotas' AND column_name = 'subscription_credits'
  ) THEN
    ALTER TABLE user_quotas ADD COLUMN subscription_credits INT DEFAULT 0;
  END IF;
  
  -- purchased_credits: 充值购买的永久 credits
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_quotas' AND column_name = 'purchased_credits'
  ) THEN
    ALTER TABLE user_quotas ADD COLUMN purchased_credits INT DEFAULT 0;
  END IF;
  
  -- credits_reset_at: 订阅 credits 上次重置时间
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_quotas' AND column_name = 'credits_reset_at'
  ) THEN
    ALTER TABLE user_quotas ADD COLUMN credits_reset_at TIMESTAMPTZ;
  END IF;
  
  -- stripe_customer_id: 关联 Stripe 客户
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_quotas' AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE user_quotas ADD COLUMN stripe_customer_id TEXT;
  END IF;
END $$;

-- 4. 触发器：自动更新 updated_at
CREATE OR REPLACE FUNCTION update_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_subscriptions_updated_at();

-- 5. 注释
COMMENT ON TABLE subscriptions IS 'Stripe 订阅记录';
COMMENT ON TABLE payments IS 'Stripe 支付记录（订阅和一次性）';
COMMENT ON COLUMN user_quotas.subscription_credits IS '订阅赠送的 credits，每月重置';
COMMENT ON COLUMN user_quotas.purchased_credits IS '充值购买的 credits，永久有效';
COMMENT ON COLUMN user_quotas.credits_reset_at IS '订阅 credits 上次重置时间';
