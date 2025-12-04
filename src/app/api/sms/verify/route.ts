import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'

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

    // 使用手机号作为虚拟邮箱登录/注册
    const virtualEmail = `${phone}@sms.brandcam.local`
    const virtualPassword = `sms_${phone}_${process.env.SMS_SECRET_SALT || 'brandcam'}`

    // 尝试登录
    const userSupabase = await createClient()
    const { data: signInData, error: signInError } = await userSupabase.auth.signInWithPassword({
      email: virtualEmail,
      password: virtualPassword,
    })

    if (signInData?.user) {
      // 用户已存在，登录成功
      console.log(`[SMS] User logged in: ${phone}`)
      return NextResponse.json({
        success: true,
        message: '登录成功',
        user: {
          id: signInData.user.id,
          phone,
          email: signInData.user.email,
        },
      })
    }

    // 用户不存在，创建新用户
    const { data: signUpData, error: signUpError } = await userSupabase.auth.signUp({
      email: virtualEmail,
      password: virtualPassword,
      options: {
        data: {
          phone,
          login_type: 'sms',
        },
      },
    })

    if (signUpError) {
      // 如果是"用户已存在"错误，可能是密码不对，尝试用 admin API
      if (signUpError.message?.includes('already registered')) {
        // 使用 service role 重置密码并登录
        const { data: userData } = await supabase
          .from('users_view')
          .select('id')
          .eq('email', virtualEmail)
          .single()

        if (userData) {
          // 用户存在但密码可能变了，使用 admin API 更新
          const { error: updateError } = await supabase.auth.admin.updateUserById(
            userData.id,
            { password: virtualPassword }
          )

          if (!updateError) {
            // 重新尝试登录
            const { data: retryData } = await userSupabase.auth.signInWithPassword({
              email: virtualEmail,
              password: virtualPassword,
            })

            if (retryData?.user) {
              console.log(`[SMS] User logged in (retry): ${phone}`)
              return NextResponse.json({
                success: true,
                message: '登录成功',
                user: {
                  id: retryData.user.id,
                  phone,
                  email: retryData.user.email,
                },
              })
            }
          }
        }
      }

      console.error('[SMS] Sign up error:', signUpError)
      return NextResponse.json(
        { success: false, error: '登录失败，请稍后重试' },
        { status: 500 }
      )
    }

    if (!signUpData?.user) {
      return NextResponse.json(
        { success: false, error: '创建用户失败' },
        { status: 500 }
      )
    }

    console.log(`[SMS] New user created: ${phone}`)

    return NextResponse.json({
      success: true,
      message: '注册成功',
      user: {
        id: signUpData.user.id,
        phone,
        email: signUpData.user.email,
      },
    })

  } catch (error: any) {
    console.error('[SMS] Verify error:', error)
    return NextResponse.json(
      { success: false, error: '验证失败，请稍后重试' },
      { status: 500 }
    )
  }
}

