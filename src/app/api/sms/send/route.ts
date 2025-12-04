import { NextRequest, NextResponse } from 'next/server'
import Dysmsapi20170525, * as $Dysmsapi20170525 from '@alicloud/dysmsapi20170525'
import * as $OpenApi from '@alicloud/openapi-client'
import { createServiceClient } from '@/lib/supabase/server'

// 阿里云短信配置
const ALIYUN_ACCESS_KEY_ID = process.env.ALIYUN_ACCESS_KEY_ID || ''
const ALIYUN_ACCESS_KEY_SECRET = process.env.ALIYUN_ACCESS_KEY_SECRET || ''
const ALIYUN_SMS_SIGN_NAME = process.env.ALIYUN_SMS_SIGN_NAME || '品牌相机'
const ALIYUN_SMS_TEMPLATE_CODE = process.env.ALIYUN_SMS_TEMPLATE_CODE || ''

// 验证码有效期（分钟）
const CODE_EXPIRE_MINUTES = 5
// 发送间隔（秒）- 防止频繁发送
const SEND_INTERVAL_SECONDS = 60
// 每日每手机号最大发送次数
const MAX_DAILY_SENDS = 10

// 生成6位随机验证码
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// 验证手机号格式（中国大陆）
function isValidPhone(phone: string): boolean {
  return /^1[3-9]\d{9}$/.test(phone)
}

// 创建阿里云短信客户端
function createSmsClient(): Dysmsapi20170525 {
  const config = new $OpenApi.Config({
    accessKeyId: ALIYUN_ACCESS_KEY_ID,
    accessKeySecret: ALIYUN_ACCESS_KEY_SECRET,
  })
  config.endpoint = 'dysmsapi.aliyuncs.com'
  return new Dysmsapi20170525(config)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone } = body

    // 验证手机号
    if (!phone || !isValidPhone(phone)) {
      return NextResponse.json(
        { success: false, error: '请输入正确的手机号' },
        { status: 400 }
      )
    }

    // 检查阿里云配置
    if (!ALIYUN_ACCESS_KEY_ID || !ALIYUN_ACCESS_KEY_SECRET || !ALIYUN_SMS_TEMPLATE_CODE) {
      console.error('[SMS] Missing Aliyun SMS configuration')
      return NextResponse.json(
        { success: false, error: '短信服务未配置' },
        { status: 500 }
      )
    }

    const supabase = createServiceClient()

    // 检查是否存在未过期的验证码（防止频繁发送）
    const { data: existingCode } = await supabase
      .from('sms_codes')
      .select('*')
      .eq('phone', phone)
      .single()

    if (existingCode) {
      const updatedAt = new Date(existingCode.updated_at)
      const now = new Date()
      const secondsSinceLastSend = (now.getTime() - updatedAt.getTime()) / 1000

      // 检查发送间隔
      if (secondsSinceLastSend < SEND_INTERVAL_SECONDS) {
        const waitSeconds = Math.ceil(SEND_INTERVAL_SECONDS - secondsSinceLastSend)
        return NextResponse.json(
          { success: false, error: `请${waitSeconds}秒后再试` },
          { status: 429 }
        )
      }
    }

    // 生成新验证码
    const code = generateCode()
    const expiresAt = new Date(Date.now() + CODE_EXPIRE_MINUTES * 60 * 1000)

    // 发送短信
    const client = createSmsClient()
    const sendSmsRequest = new $Dysmsapi20170525.SendSmsRequest({
      phoneNumbers: phone,
      signName: ALIYUN_SMS_SIGN_NAME,
      templateCode: ALIYUN_SMS_TEMPLATE_CODE,
      templateParam: JSON.stringify({ code }),
    })

    const response = await client.sendSms(sendSmsRequest)

    if (!response.body || response.body.code !== 'OK') {
      console.error('[SMS] Send failed:', response.body)
      return NextResponse.json(
        { success: false, error: '短信发送失败，请稍后重试' },
        { status: 500 }
      )
    }

    // 保存或更新验证码到数据库（UPSERT）
    const { error: upsertError } = await supabase
      .from('sms_codes')
      .upsert(
        {
          phone,
          code,
          expires_at: expiresAt.toISOString(),
          attempts: 0,
          verified: false,
        },
        {
          onConflict: 'phone',  // 如果 phone 存在则更新
        }
      )

    if (upsertError) {
      console.error('[SMS] Database error:', upsertError)
      // 短信已发送，即使数据库出错也返回成功
    }

    console.log(`[SMS] Code sent to ${phone.slice(0, 3)}****${phone.slice(-4)}`)

    return NextResponse.json({
      success: true,
      message: '验证码已发送',
      expiresIn: CODE_EXPIRE_MINUTES * 60, // 秒
    })

  } catch (error: any) {
    console.error('[SMS] Error:', error)
    return NextResponse.json(
      { success: false, error: '发送失败，请稍后重试' },
      { status: 500 }
    )
  }
}

