/**
 * Credits 系统核心逻辑
 * 
 * Credits 类型和优先级（消费时优先扣除即将过期的）：
 * 1. daily_credits       - 每日奖励，当天有效，次日清零
 * 2. subscription_credits - 订阅赠送，当月有效，续费时重置
 * 3. signup_credits      - 注册赠送，永久有效
 * 4. admin_give_credits  - 管理员赠送，永久有效
 * 5. purchased_credits   - 充值购买，永久有效（最后消费，保护用户付费）
 */

// 默认值
export const DEFAULT_SIGNUP_CREDITS = 10  // 新用户注册赠送
export const DAILY_REWARD_CREDITS = 5     // 每日登录奖励

// 数据库中的 user_quotas 记录类型
export interface UserQuotaRecord {
  user_id: string
  user_email?: string
  daily_credits: number
  daily_credits_date: string | null  // ISO date string: 'YYYY-MM-DD'
  subscription_credits: number
  signup_credits: number
  admin_give_credits: number
  purchased_credits: number
  stripe_customer_id?: string
  created_at?: string
  updated_at?: string
}

// Credits 详情（用于 API 响应）
export interface CreditsInfo {
  available: number           // 总可用余额
  daily: number              // 今日奖励余额（如果不是今天的则为 0）
  subscription: number       // 订阅余额
  signup: number             // 注册赠送余额
  adminGive: number          // 管理员赠送余额
  purchased: number          // 购买余额
  dailyExpired: boolean      // 每日奖励是否已过期
}

/**
 * 获取今天的日期字符串（UTC）
 */
export function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0]
}

/**
 * 检查日期是否是今天（UTC）
 */
export function isToday(dateString: string | null): boolean {
  if (!dateString) return false
  return dateString === getTodayDateString()
}

/**
 * 计算可用 credits 详情
 */
export function calculateCreditsInfo(quota: UserQuotaRecord | null): CreditsInfo {
  if (!quota) {
    return {
      available: DEFAULT_SIGNUP_CREDITS,
      daily: 0,
      subscription: 0,
      signup: DEFAULT_SIGNUP_CREDITS,
      adminGive: 0,
      purchased: 0,
      dailyExpired: true,
    }
  }

  // 每日奖励只有在当天有效
  const dailyCredits = isToday(quota.daily_credits_date) 
    ? (quota.daily_credits || 0) 
    : 0
  const dailyExpired = !isToday(quota.daily_credits_date) && (quota.daily_credits || 0) > 0

  const subscriptionCredits = quota.subscription_credits || 0
  const signupCredits = quota.signup_credits ?? DEFAULT_SIGNUP_CREDITS
  const adminGiveCredits = quota.admin_give_credits || 0
  const purchasedCredits = quota.purchased_credits || 0

  const available = dailyCredits + subscriptionCredits + signupCredits + adminGiveCredits + purchasedCredits

  return {
    available,
    daily: dailyCredits,
    subscription: subscriptionCredits,
    signup: signupCredits,
    adminGive: adminGiveCredits,
    purchased: purchasedCredits,
    dailyExpired,
  }
}

/**
 * 计算扣费后的新余额
 * 按优先级消费：daily > subscription > signup > adminGive > purchased
 * 
 * @returns 更新后的余额对象，如果余额不足返回 null
 */
export function consumeCredits(
  quota: UserQuotaRecord,
  amount: number
): Pick<UserQuotaRecord, 'daily_credits' | 'subscription_credits' | 'signup_credits' | 'admin_give_credits' | 'purchased_credits'> | null {
  const info = calculateCreditsInfo(quota)
  
  // 检查余额是否足够
  if (info.available < amount) {
    return null
  }

  let remaining = amount
  
  // 复制当前值
  let daily = info.daily
  let subscription = info.subscription
  let signup = info.signup
  let adminGive = info.adminGive
  let purchased = info.purchased

  // 1. 先扣每日奖励（当天有效）
  if (remaining > 0 && daily > 0) {
    const deduct = Math.min(remaining, daily)
    daily -= deduct
    remaining -= deduct
  }

  // 2. 再扣订阅（月底可能过期）
  if (remaining > 0 && subscription > 0) {
    const deduct = Math.min(remaining, subscription)
    subscription -= deduct
    remaining -= deduct
  }

  // 3. 再扣注册赠送
  if (remaining > 0 && signup > 0) {
    const deduct = Math.min(remaining, signup)
    signup -= deduct
    remaining -= deduct
  }

  // 4. 再扣管理员赠送
  if (remaining > 0 && adminGive > 0) {
    const deduct = Math.min(remaining, adminGive)
    adminGive -= deduct
    remaining -= deduct
  }

  // 5. 最后扣购买的（保护用户付费的 credits）
  if (remaining > 0 && purchased > 0) {
    const deduct = Math.min(remaining, purchased)
    purchased -= deduct
    remaining -= deduct
  }

  // 理论上不应该到这里还有 remaining > 0
  if (remaining > 0) {
    console.error('[Quota] Unexpected: remaining > 0 after consumption', { remaining, amount, info })
    return null
  }

  return {
    daily_credits: daily,
    subscription_credits: subscription,
    signup_credits: signup,
    admin_give_credits: adminGive,
    purchased_credits: purchased,
  }
}

/**
 * 计算退款后的新余额
 * 退款退到 admin_give_credits（系统补偿性质）
 */
export function refundCredits(
  quota: UserQuotaRecord,
  amount: number
): Pick<UserQuotaRecord, 'daily_credits' | 'subscription_credits' | 'signup_credits' | 'admin_give_credits' | 'purchased_credits'> {
  // 复制当前值
  const daily = isToday(quota.daily_credits_date) ? (quota.daily_credits || 0) : 0
  const subscription = quota.subscription_credits || 0
  const signup = quota.signup_credits ?? DEFAULT_SIGNUP_CREDITS
  let adminGive = quota.admin_give_credits || 0
  const purchased = quota.purchased_credits || 0

  // 退款退到 admin_give_credits（系统补偿）
  adminGive += amount

  return {
    daily_credits: daily,
    subscription_credits: subscription,
    signup_credits: signup,
    admin_give_credits: adminGive,
    purchased_credits: purchased,
  }
}

/**
 * 创建新用户的默认 quota 记录
 */
export function createDefaultQuota(userId: string, userEmail?: string): Omit<UserQuotaRecord, 'created_at' | 'updated_at'> {
  return {
    user_id: userId,
    user_email: userEmail,
    daily_credits: 0,
    daily_credits_date: null,
    subscription_credits: 0,
    signup_credits: DEFAULT_SIGNUP_CREDITS,
    admin_give_credits: 0,
    purchased_credits: 0,
  }
}
