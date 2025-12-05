import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// 最大验证尝试次数
const MAX_ATTEMPTS = 5

// 验证手机号格式
function isValidPhone(phone: string): boolean {
  return /^1[3-9]\d{9}$/.test(phone)
}

// 验证码格式
function isValidCode(code: string): boolean {
  return /^\d{6}$/.test(code)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone, code } = body

    // 验证参数
    if (!phone || !isValidPhone(phone)) {
      return NextResponse.json(
        { success: false, error: '请输入正确的手机号' },
        { status: 400 }
      )
    }

    if (!code || !isValidCode(code)) {
      return NextResponse.json(
        { success: false, error: '请输入6位验证码' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // ========== 第一步：验证短信验证码（快速） ==========
    const { data: smsCode, error: queryError } = await supabase
      .from('sms_codes')
      .select('*')
      .eq('phone', phone)
      .single()

    if (queryError || !smsCode) {
      return NextResponse.json(
        { success: false, error: '请先获取验证码' },
        { status: 400 }
      )
    }

    // 检查是否已验证
    if (smsCode.verified) {
      return NextResponse.json(
        { success: false, error: '验证码已使用，请重新获取' },
        { status: 400 }
      )
    }

    // 检查尝试次数
    if (smsCode.attempts >= MAX_ATTEMPTS) {
      return NextResponse.json(
        { success: false, error: '验证次数过多，请重新获取验证码' },
        { status: 429 }
      )
    }

    // 检查是否过期
    if (new Date() > new Date(smsCode.expires_at)) {
      return NextResponse.json(
        { success: false, error: '验证码已过期，请重新获取' },
        { status: 400 }
      )
    }

    // 增加尝试次数
    await supabase
      .from('sms_codes')
      .update({ attempts: smsCode.attempts + 1 })
      .eq('phone', phone)

    // 验证码是否匹配
    if (smsCode.code !== code) {
      const remainingAttempts = MAX_ATTEMPTS - smsCode.attempts - 1
      return NextResponse.json(
        { 
          success: false, 
          error: remainingAttempts > 0 
            ? `验证码错误，还剩${remainingAttempts}次机会` 
            : '验证码错误，请重新获取'
        },
        { status: 400 }
      )
    }

    // 验证成功，标记为已使用
    await supabase
      .from('sms_codes')
      .update({ verified: true })
      .eq('phone', phone)

    console.log(`[SMS] Code verified for: ${phone}`)

    // ========== 第二步：创建或获取用户 ==========
    const virtualEmail = `sms_${phone}@brandcam.app`
    const virtualPassword = `sms_${phone}_${process.env.SMS_SECRET_SALT || 'brandcam'}`

    // 尝试创建用户（如果已存在会失败）
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: virtualEmail,
      password: virtualPassword,
      email_confirm: true,
      user_metadata: {
        phone,
        login_type: 'sms',
      },
    })

    let userId: string
    let isNewUser = false

    if (createError) {
      // 用户已存在，更新密码确保一致
      if (createError.message?.includes('already been registered') || 
          createError.message?.includes('already exists')) {
        console.log(`[SMS] User exists, updating password: ${phone}`)
        
        // 通过邮箱查找用户 ID（从 users 视图）
        const { data: userData } = await supabase
          .from('users_view')
          .select('id')
          .eq('email', virtualEmail)
          .single()
        
        if (userData?.id) {
          userId = userData.id
          // 更新密码
          await supabase.auth.admin.updateUserById(userId, {
            password: virtualPassword,
          })
        } else {
          // 备用：直接返回登录凭证让前端处理
          console.log(`[SMS] Cannot find user, returning credentials`)
          return NextResponse.json({
            success: true,
            message: '验证成功',
            email: virtualEmail,
            password: virtualPassword,
          })
        }
      } else {
        console.error('[SMS] Create user error:', createError)
        return NextResponse.json(
          { success: false, error: '创建用户失败，请稍后重试' },
          { status: 500 }
        )
      }
    } else {
      // 新用户创建成功
      isNewUser = true
      userId = newUser.user!.id
      console.log(`[SMS] New user created: ${phone}, id: ${userId}`)
    }

    // ========== 第三步：返回登录凭证 ==========
    // 直接返回 email 和 password，让前端用 signInWithPassword 登录
    // 这是最简单可靠的方式
    return NextResponse.json({
      success: true,
      message: isNewUser ? '注册成功' : '登录成功',
      email: virtualEmail,
      password: virtualPassword,
      user: {
        id: userId!,
        phone,
        email: virtualEmail,
      },
    })

  } catch (error: any) {
    console.error('[SMS] Verify error:', error)
    return NextResponse.json(
      { success: false, error: '登录失败，请稍后重试' },
      { status: 500 }
    )
  }
}
