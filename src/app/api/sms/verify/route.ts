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

    // 查询验证码记录
    const { data: smsCode, error: queryError } = await supabase
      .from('sms_codes')
      .select('*')
      .eq('phone', phone)
      .single()

    if (queryError || !smsCode) {
      console.error('[SMS] Query error:', queryError)
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
    const expiresAt = new Date(smsCode.expires_at)
    if (new Date() > expiresAt) {
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

    // 使用手机号作为虚拟邮箱
    const virtualEmail = `sms_${phone}@brandcam.app`
    const virtualPassword = `sms_${phone}_${process.env.SMS_SECRET_SALT || 'brandcam'}`

    let userId: string
    let isNewUser = false

    // 尝试通过 listUsers 查找用户（按邮箱过滤）
    // Supabase Admin API 没有 getUserByEmail，需要 listUsers 然后过滤
    let existingUser: { id: string; email?: string } | null = null
    
    try {
      const { data: listData } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000, // 获取足够多的用户来查找
      })
      
      if (listData?.users) {
        existingUser = listData.users.find(u => u.email === virtualEmail) || null
      }
    } catch (e) {
      console.log('[SMS] listUsers error:', e)
    }

    if (existingUser) {
      // 用户已存在
      userId = existingUser.id
      console.log(`[SMS] Existing user found: ${phone}, id: ${userId}`)
    } else {
      // 创建新用户
      isNewUser = true
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: virtualEmail,
        password: virtualPassword,
        email_confirm: true,
        user_metadata: {
          phone,
          login_type: 'sms',
        },
      })

      if (createError || !newUser?.user) {
        console.error('[SMS] Create user error:', createError)
        return NextResponse.json(
          { success: false, error: '创建用户失败，请稍后重试' },
          { status: 500 }
        )
      }

      userId = newUser.user.id
      console.log(`[SMS] New user created: ${phone}, id: ${userId}`)
    }

    // 生成 Magic Link 用于自动登录
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: virtualEmail,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://brandcam.app'}/auth/callback`,
      },
    })

    if (linkError || !linkData?.properties?.action_link) {
      console.error('[SMS] Generate magic link error:', linkError)
      
      // 如果 magic link 失败，返回需要前端处理的信息
      return NextResponse.json({
        success: true,
        message: isNewUser ? '注册成功' : '验证成功',
        needsManualLogin: true,
        email: virtualEmail,
        password: virtualPassword,
        user: {
          id: userId,
          phone,
          email: virtualEmail,
        },
      })
    }

    // 从 action_link 中提取 token
    const actionLink = linkData.properties.action_link
    const url = new URL(actionLink)
    const token = url.searchParams.get('token')
    const type = url.searchParams.get('type')

    console.log(`[SMS] Magic link generated for: ${phone}`)

    return NextResponse.json({
      success: true,
      message: isNewUser ? '注册成功' : '登录成功',
      // 返回验证信息给前端
      verifyToken: token,
      verifyType: type || 'magiclink',
      email: virtualEmail,
      actionLink: actionLink, // 完整链接（备用）
      user: {
        id: userId,
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
