# Stripe 支付接入方案

## 📋 目录
1. [概述](#概述)
2. [Stripe 控制台配置](#stripe-控制台配置)
3. [数据库设计](#数据库设计)
4. [API 设计](#api-设计)
5. [前端实现](#前端实现)
6. [Webhook 处理](#webhook-处理)
7. [实施步骤](#实施步骤)
8. [测试清单](#测试清单)

---

## 概述

### 业务模型
| 类型 | 说明 | Stripe 产品类型 |
|------|------|----------------|
| **订阅** | 月付/年付，每月重置 credits | Subscription |
| **充值包** | 一次性购买，永久有效 | One-time Payment |

### 定价方案
```
订阅套餐（每月重置）:
├── Basic:  $29.99/月 ($22.49/月年付) → 120 credits
├── Pro:    $59.99/月 ($44.99/月年付) → 300 credits
└── Ultra:  $149.99/月 ($112.49/月年付) → 1000 credits

充值包（永久有效）:
├── 100 credits  → $25
├── 500 credits  → $120
└── 1000 credits → $160
```

### 技术架构
```
┌─────────────────────────────────────────────────────────────────┐
│                        用户浏览器                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │  定价页面    │───▶│ Stripe Checkout│───▶│  成功页面   │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ (Webhook)
┌─────────────────────────────────────────────────────────────────┐
│                        Next.js API                               │
│  /api/stripe/                                                    │
│  ├── create-checkout    → 创建 Checkout Session                 │
│  ├── webhook            → 处理支付成功事件                        │
│  ├── portal             → 客户管理门户（取消/更换订阅）            │
│  └── subscription       → 查询订阅状态                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Supabase                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │ subscriptions │    │   payments   │    │ user_quotas  │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Stripe 控制台配置

### Step 1: 创建产品和价格

登录 [Stripe Dashboard](https://dashboard.stripe.com) → Products

#### 订阅产品

| 产品名 | 月付价格 ID | 年付价格 ID | Credits |
|--------|------------|------------|---------|
| Basic Plan | `price_basic_monthly` | `price_basic_yearly` | 120 |
| Pro Plan | `price_pro_monthly` | `price_pro_yearly` | 300 |
| Ultra Plan | `price_ultra_monthly` | `price_ultra_yearly` | 1000 |

**创建步骤**:
1. Products → Add product
2. Name: "Brand Camera Basic Plan"
3. Pricing:
   - Add price → $29.99 → Recurring → Monthly
   - Add price → $269.88 ($22.49×12) → Recurring → Yearly
4. Metadata: `credits: 120`

#### 充值包产品

| 产品名 | 价格 ID | Credits |
|--------|--------|---------|
| 100 Credits Pack | `price_credits_100` | 100 |
| 500 Credits Pack | `price_credits_500` | 500 |
| 1000 Credits Pack | `price_credits_1000` | 1000 |

**创建步骤**:
1. Products → Add product
2. Name: "100 Credits Pack"
3. Pricing: $25.00 → One time
4. Metadata: `credits: 100`

### Step 2: 配置 Webhook

1. Developers → Webhooks → Add endpoint
2. Endpoint URL: `https://your-domain.com/api/stripe/webhook`
3. 选择事件:
   - `checkout.session.completed` ✅
   - `customer.subscription.created` ✅
   - `customer.subscription.updated` ✅
   - `customer.subscription.deleted` ✅
   - `invoice.paid` ✅
   - `invoice.payment_failed` ✅
4. 保存 Webhook Secret (`whsec_...`)

### Step 3: 获取 API Keys

1. Developers → API keys
2. 复制:
   - Publishable key: `pk_test_...` / `pk_live_...`
   - Secret key: `sk_test_...` / `sk_live_...`

---

## 数据库设计

### 新增表

```sql
-- 1. 订阅记录表
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Stripe 信息
  stripe_customer_id TEXT,           -- cus_xxx
  stripe_subscription_id TEXT,       -- sub_xxx
  stripe_price_id TEXT,              -- price_xxx
  
  -- 订阅状态
  status TEXT NOT NULL DEFAULT 'inactive',  -- active/canceled/past_due/inactive
  plan_name TEXT,                    -- basic/pro/ultra
  credits_per_period INT,            -- 每期 credits 数量
  
  -- 时间
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_stripe_subscription ON subscriptions(stripe_subscription_id);

-- 2. 支付记录表
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Stripe 信息
  stripe_payment_intent_id TEXT,     -- pi_xxx
  stripe_checkout_session_id TEXT,   -- cs_xxx
  stripe_invoice_id TEXT,            -- in_xxx (订阅账单)
  
  -- 支付信息
  amount INT NOT NULL,               -- 金额（分）
  currency TEXT DEFAULT 'usd',
  status TEXT NOT NULL,              -- succeeded/pending/failed
  
  -- 商品信息
  payment_type TEXT NOT NULL,        -- subscription/one_time
  plan_name TEXT,                    -- basic/pro/ultra (订阅)
  credits_purchased INT,             -- 购买的 credits
  
  -- 元数据
  metadata JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_stripe_session ON payments(stripe_checkout_session_id);

-- 3. 扩展 user_quotas 表
ALTER TABLE user_quotas 
ADD COLUMN IF NOT EXISTS subscription_credits INT DEFAULT 0,      -- 订阅赠送的 credits（每月重置）
ADD COLUMN IF NOT EXISTS purchased_credits INT DEFAULT 0,         -- 充值购买的 credits（永久）
ADD COLUMN IF NOT EXISTS credits_reset_at TIMESTAMPTZ;            -- 订阅 credits 重置时间
```

### Credits 计算逻辑

```typescript
// 总可用 credits = 订阅 credits + 购买 credits - 已使用
// 优先消耗订阅 credits（会过期），再消耗购买 credits
availableCredits = subscription_credits + purchased_credits - used_quota
```

---

## API 设计

### 1. 创建 Checkout Session

```typescript
// POST /api/stripe/create-checkout
// Body: { priceId: string, mode: 'subscription' | 'payment' }
// Response: { url: string }
```

### 2. Webhook 处理

```typescript
// POST /api/stripe/webhook
// 处理 Stripe 事件，更新数据库
```

### 3. 客户门户

```typescript
// POST /api/stripe/portal
// Response: { url: string }
// 用户可以管理订阅（取消、更换套餐）
```

### 4. 查询订阅状态

```typescript
// GET /api/stripe/subscription
// Response: { 
//   hasActiveSubscription: boolean,
//   plan: string,
//   status: string,
//   currentPeriodEnd: string,
//   cancelAtPeriodEnd: boolean
// }
```

---

## 前端实现

### 1. 安装依赖

```bash
npm install @stripe/stripe-js stripe
```

### 2. 环境变量

```bash
# .env.local
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# 价格 ID（从 Stripe Dashboard 复制）
NEXT_PUBLIC_STRIPE_PRICE_BASIC_MONTHLY=price_xxx
NEXT_PUBLIC_STRIPE_PRICE_BASIC_YEARLY=price_xxx
NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY=price_xxx
NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY=price_xxx
NEXT_PUBLIC_STRIPE_PRICE_ULTRA_MONTHLY=price_xxx
NEXT_PUBLIC_STRIPE_PRICE_ULTRA_YEARLY=price_xxx
NEXT_PUBLIC_STRIPE_PRICE_CREDITS_100=price_xxx
NEXT_PUBLIC_STRIPE_PRICE_CREDITS_500=price_xxx
NEXT_PUBLIC_STRIPE_PRICE_CREDITS_1000=price_xxx
```

### 3. 定价页面按钮

```tsx
// 点击订阅按钮
const handleSubscribe = async (priceId: string) => {
  const res = await fetch('/api/stripe/create-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      priceId, 
      mode: 'subscription',
      successUrl: `${window.location.origin}/payment/success`,
      cancelUrl: `${window.location.origin}/pricing`,
    }),
  })
  const { url } = await res.json()
  window.location.href = url  // 跳转到 Stripe Checkout
}

// 点击充值按钮
const handleTopUp = async (priceId: string) => {
  const res = await fetch('/api/stripe/create-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      priceId, 
      mode: 'payment',
      successUrl: `${window.location.origin}/payment/success`,
      cancelUrl: `${window.location.origin}/pricing`,
    }),
  })
  const { url } = await res.json()
  window.location.href = url
}
```

### 4. 支付成功页面

```
/payment/success?session_id=xxx
```
- 显示支付成功信息
- 引导用户返回应用
- 后台已通过 Webhook 更新 credits

---

## Webhook 处理

### 核心逻辑

```typescript
// /api/stripe/webhook/route.ts

switch (event.type) {
  case 'checkout.session.completed':
    // 1. 获取用户信息
    // 2. 创建/更新 subscriptions 或 payments 记录
    // 3. 更新 user_quotas credits
    break;
    
  case 'invoice.paid':
    // 订阅续费成功
    // 1. 重置 subscription_credits
    // 2. 更新 credits_reset_at
    break;
    
  case 'customer.subscription.updated':
    // 订阅状态变更（升级/降级/取消）
    // 1. 更新 subscriptions 表状态
    break;
    
  case 'customer.subscription.deleted':
    // 订阅已取消
    // 1. 标记订阅为 inactive
    // 2. 清零 subscription_credits
    break;
}
```

---

## 实施步骤

### Phase 1: 基础设施 (Day 1)

- [ ] **1.1** Stripe Dashboard 创建产品和价格
- [ ] **1.2** 配置 Webhook endpoint
- [ ] **1.3** 获取 API keys，配置环境变量
- [ ] **1.4** 运行数据库迁移（新表）

### Phase 2: 后端 API (Day 2)

- [ ] **2.1** 创建 `/api/stripe/create-checkout`
- [ ] **2.2** 创建 `/api/stripe/webhook`
- [ ] **2.3** 创建 `/api/stripe/portal`
- [ ] **2.4** 创建 `/api/stripe/subscription`
- [ ] **2.5** 更新 `/api/quota` 支持新的 credits 逻辑

### Phase 3: 前端页面 (Day 3)

- [ ] **3.1** 更新 Landing Page 定价区域（添加购买按钮）
- [ ] **3.2** 创建 `/pricing` 独立定价页面
- [ ] **3.3** 创建 `/payment/success` 支付成功页面
- [ ] **3.4** 创建用户设置页面（查看订阅、管理账单）

### Phase 4: 测试 (Day 4)

- [ ] **4.1** 使用 Stripe 测试卡号测试订阅流程
- [ ] **4.2** 测试充值包购买流程
- [ ] **4.3** 测试 Webhook 事件处理
- [ ] **4.4** 测试订阅取消/续费
- [ ] **4.5** 测试 credits 消耗和重置

### Phase 5: 上线 (Day 5)

- [ ] **5.1** 切换到 Stripe Live 环境
- [ ] **5.2** 更新生产环境变量
- [ ] **5.3** 配置生产 Webhook endpoint
- [ ] **5.4** 监控首批真实订单

---

## 测试清单

### Stripe 测试卡号

| 场景 | 卡号 |
|------|------|
| 成功支付 | 4242 4242 4242 4242 |
| 需要验证 | 4000 0025 0000 3155 |
| 支付失败 | 4000 0000 0000 9995 |

### 测试场景

1. **新用户订阅**
   - [ ] 选择 Basic 月付 → 支付成功 → 获得 120 credits
   - [ ] 检查 subscriptions 表记录
   - [ ] 检查 user_quotas.subscription_credits

2. **订阅升级**
   - [ ] Basic → Pro → credits 变为 300
   
3. **订阅取消**
   - [ ] 取消订阅 → 当前周期结束后失效
   - [ ] subscription_credits 归零

4. **充值包购买**
   - [ ] 购买 100 credits → 永久生效
   - [ ] 检查 user_quotas.purchased_credits

5. **Credits 消耗**
   - [ ] 优先消耗 subscription_credits
   - [ ] subscription_credits 用完后消耗 purchased_credits

---

## 文件结构预览

```
src/
├── app/
│   ├── api/
│   │   └── stripe/
│   │       ├── create-checkout/route.ts
│   │       ├── webhook/route.ts
│   │       ├── portal/route.ts
│   │       └── subscription/route.ts
│   ├── pricing/
│   │   └── page.tsx
│   └── payment/
│       └── success/
│           └── page.tsx
├── lib/
│   └── stripe.ts              # Stripe 客户端配置
└── components/
    └── pricing/
        ├── PricingCard.tsx
        └── TopUpCard.tsx

supabase/
└── migrations/
    └── 011_stripe_payments.sql
```

---

## 常见问题

### Q: Webhook 收不到事件？
1. 检查 endpoint URL 是否正确
2. 本地开发使用 `stripe listen --forward-to localhost:3000/api/stripe/webhook`
3. 检查 Webhook Secret 是否配置正确

### Q: 如何处理退款？
监听 `charge.refunded` 事件，扣除对应 credits

### Q: 用户更换邮箱怎么办？
Stripe Customer 和 Supabase User 通过 `stripe_customer_id` 关联，与邮箱无关

---

**准备好开始了吗？** 先完成 Phase 1 的 Stripe Dashboard 配置！
