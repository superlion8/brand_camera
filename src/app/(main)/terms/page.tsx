'use client'

import { useLanguageStore } from '@/stores/languageStore'

export default function TermsPage() {
  const language = useLanguageStore((state) => state.language)

  const content = {
    en: {
      title: 'Terms of Service',
      lastUpdated: 'Last updated: January 2025',
      sections: [
        {
          title: '1. Acceptance of Terms',
          content: `By accessing or using BrandCam ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our service.

These terms apply to all users, including visitors, registered users, and paying subscribers.`
        },
        {
          title: '2. Description of Service',
          content: `BrandCam is an AI-powered product photography platform that enables users to:
• Generate professional model photos with AI
• Create lifestyle and scene images
• Edit and enhance product photos
• Access various AI photography tools

The service is provided "as is" and we reserve the right to modify or discontinue features at any time.`
        },
        {
          title: '3. User Accounts',
          content: `To use certain features, you must create an account. You agree to:
• Provide accurate and complete information
• Maintain the security of your password
• Notify us immediately of any unauthorized access
• Be responsible for all activities under your account

We reserve the right to suspend or terminate accounts that violate these terms.`
        },
        {
          title: '4. Credits and Payment',
          content: `BrandCam operates on a credit-based system:
• Credits are used to generate images
• Unused daily credits expire at midnight
• Subscription credits remain valid during your subscription period
• Purchased credits do not expire
• Refunds are available for unused purchased credits only

Payments are processed securely through Stripe. By making a purchase, you agree to Stripe's terms of service.`
        },
        {
          title: '5. Content Ownership',
          content: `Your Content:
• You retain ownership of images you upload
• You grant us a license to process your images for service delivery
• Generated images are owned by you for commercial and personal use

Our Content:
• BrandCam's software, design, and branding remain our property
• You may not copy, modify, or distribute our proprietary content`
        },
        {
          title: '6. Acceptable Use',
          content: `You agree NOT to use BrandCam to:
• Generate illegal, harmful, or offensive content
• Create deepfakes or non-consensual intimate imagery
• Infringe on others' intellectual property rights
• Spam, harass, or deceive others
• Attempt to hack or disrupt our service
• Resell or redistribute our service without permission

We reserve the right to remove content and terminate accounts that violate these guidelines.`
        },
        {
          title: '7. AI-Generated Content',
          content: `You acknowledge that:
• AI-generated images may not always meet expectations
• Results depend on input quality and prompt clarity
• We do not guarantee specific outcomes
• You are responsible for reviewing generated content before use
• Some generated content may require editing`
        },
        {
          title: '8. Limitation of Liability',
          content: `To the maximum extent permitted by law:
• BrandCam is provided "as is" without warranties
• We are not liable for indirect, incidental, or consequential damages
• Our liability is limited to the amount you paid for the service
• We are not responsible for third-party services or content`
        },
        {
          title: '9. Indemnification',
          content: `You agree to indemnify and hold BrandCam harmless from any claims, damages, or expenses arising from:
• Your use of the service
• Your violation of these terms
• Your violation of any third-party rights`
        },
        {
          title: '10. Changes to Terms',
          content: `We may update these terms from time to time. Continued use of the service after changes constitutes acceptance of the new terms. We will notify users of significant changes via email or website notice.`
        },
        {
          title: '11. Governing Law',
          content: `These terms are governed by the laws of the jurisdiction in which BrandCam operates. Any disputes shall be resolved through binding arbitration or in the courts of that jurisdiction.`
        },
        {
          title: '12. Contact',
          content: `For questions about these terms, please contact us at:
Email: support@honoululuai.com`
        },
      ]
    },
    zh: {
      title: '服务条款',
      lastUpdated: '最后更新：2025年1月',
      sections: [
        {
          title: '1. 条款接受',
          content: `访问或使用 BrandCam（"本服务"）即表示您同意受这些服务条款的约束。如果您不同意这些条款，请勿使用我们的服务。

这些条款适用于所有用户，包括访客、注册用户和付费订阅者。`
        },
        {
          title: '2. 服务描述',
          content: `BrandCam 是一个 AI 驱动的产品摄影平台，使用户能够：
• 使用 AI 生成专业模特照片
• 创建生活场景图片
• 编辑和增强产品照片
• 访问各种 AI 摄影工具

服务按"现状"提供，我们保留随时修改或终止功能的权利。`
        },
        {
          title: '3. 用户账户',
          content: `要使用某些功能，您必须创建账户。您同意：
• 提供准确完整的信息
• 维护密码的安全性
• 发现任何未经授权的访问立即通知我们
• 对您账户下的所有活动负责

我们保留暂停或终止违反这些条款的账户的权利。`
        },
        {
          title: '4. 积分和付款',
          content: `BrandCam 采用积分制系统：
• 积分用于生成图片
• 未使用的每日积分在午夜过期
• 订阅积分在订阅期间保持有效
• 购买的积分不会过期
• 仅对未使用的购买积分提供退款

支付通过 Stripe 安全处理。进行购买即表示您同意 Stripe 的服务条款。`
        },
        {
          title: '5. 内容所有权',
          content: `您的内容：
• 您保留上传图片的所有权
• 您授予我们处理您图片以提供服务的许可
• 生成的图片归您所有，可用于商业和个人用途

我们的内容：
• BrandCam 的软件、设计和品牌仍然是我们的财产
• 您不得复制、修改或分发我们的专有内容`
        },
        {
          title: '6. 可接受的使用',
          content: `您同意不使用 BrandCam 来：
• 生成非法、有害或冒犯性内容
• 创建深度伪造或未经同意的私密图像
• 侵犯他人的知识产权
• 发送垃圾邮件、骚扰或欺骗他人
• 试图黑客攻击或破坏我们的服务
• 未经许可转售或再分发我们的服务

我们保留删除内容和终止违反这些准则的账户的权利。`
        },
        {
          title: '7. AI 生成的内容',
          content: `您承认：
• AI 生成的图片可能并不总是符合预期
• 结果取决于输入质量和提示的清晰度
• 我们不保证特定结果
• 您有责任在使用前审查生成的内容
• 某些生成的内容可能需要编辑`
        },
        {
          title: '8. 责任限制',
          content: `在法律允许的最大范围内：
• BrandCam 按"现状"提供，不提供任何保证
• 我们不对间接、附带或后果性损害负责
• 我们的责任限于您为服务支付的金额
• 我们不对第三方服务或内容负责`
        },
        {
          title: '9. 赔偿',
          content: `您同意赔偿并使 BrandCam 免受因以下原因引起的任何索赔、损害或费用：
• 您对服务的使用
• 您违反这些条款
• 您违反任何第三方权利`
        },
        {
          title: '10. 条款变更',
          content: `我们可能会不时更新这些条款。在变更后继续使用服务即表示接受新条款。我们将通过电子邮件或网站通知向用户通知重大变更。`
        },
        {
          title: '11. 适用法律',
          content: `这些条款受 BrandCam 运营所在司法管辖区的法律管辖。任何争议应通过具有约束力的仲裁或在该司法管辖区的法院解决。`
        },
        {
          title: '12. 联系方式',
          content: `如有关于这些条款的问题，请通过以下方式联系我们：
电子邮件：support@honoululuai.com`
        },
      ]
    },
    ko: {
      title: '서비스 이용약관',
      lastUpdated: '최종 업데이트: 2025년 1월',
      sections: [
        {
          title: '1. 약관 동의',
          content: `BrandCam("서비스")에 접속하거나 사용함으로써 귀하는 이 서비스 이용약관에 동의하게 됩니다. 이 약관에 동의하지 않으시면 서비스를 사용하지 마세요.

이 약관은 방문자, 등록 사용자, 유료 구독자를 포함한 모든 사용자에게 적용됩니다.`
        },
        {
          title: '2. 서비스 설명',
          content: `BrandCam은 사용자가 다음을 할 수 있는 AI 기반 제품 사진 플랫폼입니다:
• AI로 전문 모델 사진 생성
• 라이프스타일 및 장면 이미지 제작
• 제품 사진 편집 및 향상
• 다양한 AI 사진 도구 접근

서비스는 "있는 그대로" 제공되며, 언제든지 기능을 수정하거나 중단할 권리를 보유합니다.`
        },
        {
          title: '3. 사용자 계정',
          content: `특정 기능을 사용하려면 계정을 만들어야 합니다. 귀하는 다음에 동의합니다:
• 정확하고 완전한 정보 제공
• 비밀번호 보안 유지
• 무단 접근 발견 시 즉시 통보
• 계정의 모든 활동에 대한 책임

당사는 이 약관을 위반하는 계정을 일시 중지하거나 종료할 권리를 보유합니다.`
        },
        {
          title: '4. 크레딧 및 결제',
          content: `BrandCam은 크레딧 기반 시스템으로 운영됩니다:
• 크레딧은 이미지 생성에 사용됩니다
• 미사용 일일 크레딧은 자정에 만료됩니다
• 구독 크레딧은 구독 기간 동안 유효합니다
• 구매한 크레딧은 만료되지 않습니다
• 환불은 미사용 구매 크레딧에 대해서만 가능합니다

결제는 Stripe를 통해 안전하게 처리됩니다. 구매 시 Stripe의 서비스 약관에 동의하게 됩니다.`
        },
        {
          title: '5. 콘텐츠 소유권',
          content: `귀하의 콘텐츠:
• 업로드한 이미지의 소유권은 귀하에게 있습니다
• 서비스 제공을 위해 이미지를 처리할 수 있는 라이선스를 당사에 부여합니다
• 생성된 이미지는 상업적 및 개인적 용도로 귀하의 소유입니다

당사의 콘텐츠:
• BrandCam의 소프트웨어, 디자인, 브랜딩은 당사의 재산입니다
• 당사의 독점 콘텐츠를 복사, 수정 또는 배포할 수 없습니다`
        },
        {
          title: '6. 허용되는 사용',
          content: `귀하는 BrandCam을 다음 용도로 사용하지 않을 것에 동의합니다:
• 불법적, 유해하거나 불쾌한 콘텐츠 생성
• 딥페이크 또는 동의 없는 친밀한 이미지 제작
• 타인의 지적재산권 침해
• 스팸, 괴롭힘 또는 타인 기만
• 서비스 해킹 또는 방해 시도
• 허가 없이 서비스 재판매 또는 재배포

당사는 이 지침을 위반하는 콘텐츠를 삭제하고 계정을 종료할 권리를 보유합니다.`
        },
        {
          title: '7. AI 생성 콘텐츠',
          content: `귀하는 다음을 인정합니다:
• AI 생성 이미지가 항상 기대에 부합하지 않을 수 있습니다
• 결과는 입력 품질과 프롬프트 명확성에 따라 달라집니다
• 특정 결과를 보장하지 않습니다
• 사용 전 생성된 콘텐츠를 검토할 책임은 귀하에게 있습니다
• 일부 생성된 콘텐츠는 편집이 필요할 수 있습니다`
        },
        {
          title: '8. 책임 제한',
          content: `법이 허용하는 최대 범위 내에서:
• BrandCam은 보증 없이 "있는 그대로" 제공됩니다
• 간접적, 부수적 또는 결과적 손해에 대해 책임지지 않습니다
• 당사의 책임은 서비스에 대해 지불한 금액으로 제한됩니다
• 제3자 서비스나 콘텐츠에 대해 책임지지 않습니다`
        },
        {
          title: '9. 면책',
          content: `귀하는 다음으로 인해 발생하는 모든 청구, 손해 또는 비용으로부터 BrandCam을 면책하고 보호할 것에 동의합니다:
• 서비스 사용
• 이 약관 위반
• 제3자 권리 위반`
        },
        {
          title: '10. 약관 변경',
          content: `당사는 수시로 이 약관을 업데이트할 수 있습니다. 변경 후 서비스를 계속 사용하면 새 약관에 동의한 것으로 간주됩니다. 중요한 변경 사항은 이메일 또는 웹사이트 공지를 통해 사용자에게 알립니다.`
        },
        {
          title: '11. 준거법',
          content: `이 약관은 BrandCam이 운영되는 관할권의 법률에 따릅니다. 모든 분쟁은 구속력 있는 중재 또는 해당 관할권의 법원에서 해결됩니다.`
        },
        {
          title: '12. 연락처',
          content: `이 약관에 대한 질문이 있으시면 연락해 주세요:
이메일: support@honoululuai.com`
        },
      ]
    },
  }

  const t = content[language]

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white">
      <div className="max-w-3xl mx-auto px-6 py-16 md:py-24">
        <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 mb-2">
          {t.title}
        </h1>
        <p className="text-zinc-500 mb-12">{t.lastUpdated}</p>

        <div className="space-y-8">
          {t.sections.map((section, index) => (
            <section key={index}>
              <h2 className="text-xl font-semibold text-zinc-900 mb-3">
                {section.title}
              </h2>
              <p className="text-zinc-600 leading-relaxed whitespace-pre-line">
                {section.content}
              </p>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
