'use client'

import { useLanguageStore } from '@/stores/languageStore'

export default function PrivacyPage() {
  const language = useLanguageStore((state) => state.language)

  const content = {
    en: {
      title: 'Privacy Policy',
      lastUpdated: 'Last updated: January 2025',
      sections: [
        {
          title: '1. Information We Collect',
          content: `We collect information you provide directly to us, including:
• Account information (email address, name)
• Payment information (processed securely through Stripe)
• Images you upload for processing
• Usage data and analytics

We automatically collect certain information when you use our service, including device information, log data, and cookies.`
        },
        {
          title: '2. How We Use Your Information',
          content: `We use the information we collect to:
• Provide, maintain, and improve our services
• Process your transactions and send related information
• Send you technical notices and support messages
• Respond to your comments and questions
• Analyze usage patterns to improve user experience

We do NOT use your uploaded images to train AI models. Your images are processed and stored securely, and you retain full ownership.`
        },
        {
          title: '3. Information Sharing',
          content: `We do not sell, trade, or rent your personal information to third parties. We may share information with:
• Service providers who assist in our operations (payment processing, hosting)
• Law enforcement when required by law
• Other parties with your consent`
        },
        {
          title: '4. Data Security',
          content: `We implement industry-standard security measures to protect your information:
• SSL/TLS encryption for all data transmission
• Secure cloud storage with access controls
• Regular security audits and updates

While we strive to protect your information, no method of transmission over the internet is 100% secure.`
        },
        {
          title: '5. Data Retention',
          content: `We retain your information for as long as your account is active or as needed to provide services. You can request deletion of your data at any time by contacting us.

Generated images are stored in your account until you delete them. We may retain anonymized usage data for analytics purposes.`
        },
        {
          title: '6. Your Rights',
          content: `You have the right to:
• Access your personal information
• Correct inaccurate data
• Delete your account and data
• Export your data
• Opt out of marketing communications

To exercise these rights, contact us at support@honoululuai.com`
        },
        {
          title: '7. Cookies',
          content: `We use cookies and similar technologies to:
• Keep you logged in
• Remember your preferences
• Analyze site traffic

You can control cookies through your browser settings.`
        },
        {
          title: '8. Changes to This Policy',
          content: `We may update this privacy policy from time to time. We will notify you of significant changes by posting a notice on our website or sending you an email.`
        },
        {
          title: '9. Contact Us',
          content: `If you have questions about this privacy policy, please contact us at:
Email: support@honoululuai.com`
        },
      ]
    },
    zh: {
      title: '隐私政策',
      lastUpdated: '最后更新：2025年1月',
      sections: [
        {
          title: '1. 我们收集的信息',
          content: `我们收集您直接提供给我们的信息，包括：
• 账户信息（电子邮件地址、姓名）
• 支付信息（通过 Stripe 安全处理）
• 您上传用于处理的图片
• 使用数据和分析信息

当您使用我们的服务时，我们会自动收集某些信息，包括设备信息、日志数据和 Cookie。`
        },
        {
          title: '2. 我们如何使用您的信息',
          content: `我们使用收集的信息来：
• 提供、维护和改进我们的服务
• 处理您的交易并发送相关信息
• 向您发送技术通知和支持消息
• 回复您的评论和问题
• 分析使用模式以改善用户体验

我们不会使用您上传的图片来训练 AI 模型。您的图片会被安全处理和存储，您保留完全所有权。`
        },
        {
          title: '3. 信息共享',
          content: `我们不会出售、交易或出租您的个人信息给第三方。我们可能会与以下方共享信息：
• 协助我们运营的服务提供商（支付处理、托管）
• 法律要求时的执法机构
• 经您同意的其他方`
        },
        {
          title: '4. 数据安全',
          content: `我们实施行业标准的安全措施来保护您的信息：
• 所有数据传输使用 SSL/TLS 加密
• 具有访问控制的安全云存储
• 定期安全审计和更新

虽然我们努力保护您的信息，但互联网上的传输方式没有 100% 安全的。`
        },
        {
          title: '5. 数据保留',
          content: `只要您的账户处于活动状态或需要提供服务，我们就会保留您的信息。您可以随时联系我们请求删除您的数据。

生成的图片存储在您的账户中，直到您删除它们。我们可能会保留匿名化的使用数据用于分析目的。`
        },
        {
          title: '6. 您的权利',
          content: `您有权：
• 访问您的个人信息
• 更正不准确的数据
• 删除您的账户和数据
• 导出您的数据
• 选择退出营销通讯

要行使这些权利，请通过 support@honoululuai.com 联系我们`
        },
        {
          title: '7. Cookie',
          content: `我们使用 Cookie 和类似技术来：
• 保持您的登录状态
• 记住您的偏好
• 分析网站流量

您可以通过浏览器设置控制 Cookie。`
        },
        {
          title: '8. 本政策的变更',
          content: `我们可能会不时更新此隐私政策。我们会通过在网站上发布通知或向您发送电子邮件来通知您重大变更。`
        },
        {
          title: '9. 联系我们',
          content: `如果您对此隐私政策有疑问，请通过以下方式联系我们：
电子邮件：support@honoululuai.com`
        },
      ]
    },
    ko: {
      title: '개인정보 처리방침',
      lastUpdated: '최종 업데이트: 2025년 1월',
      sections: [
        {
          title: '1. 수집하는 정보',
          content: `당사는 귀하가 직접 제공하는 정보를 수집합니다:
• 계정 정보 (이메일 주소, 이름)
• 결제 정보 (Stripe를 통해 안전하게 처리)
• 처리를 위해 업로드하는 이미지
• 사용 데이터 및 분석 정보

서비스 이용 시 기기 정보, 로그 데이터, 쿠키 등 특정 정보를 자동으로 수집합니다.`
        },
        {
          title: '2. 정보 사용 방법',
          content: `수집된 정보를 다음과 같이 사용합니다:
• 서비스 제공, 유지 및 개선
• 거래 처리 및 관련 정보 발송
• 기술 공지 및 지원 메시지 발송
• 문의 및 질문에 대한 응답
• 사용자 경험 개선을 위한 사용 패턴 분석

업로드된 이미지를 AI 모델 훈련에 사용하지 않습니다. 이미지는 안전하게 처리 및 저장되며, 완전한 소유권은 귀하에게 있습니다.`
        },
        {
          title: '3. 정보 공유',
          content: `당사는 개인정보를 제3자에게 판매, 거래 또는 임대하지 않습니다. 다음과 공유할 수 있습니다:
• 운영을 지원하는 서비스 제공업체 (결제 처리, 호스팅)
• 법률에 의해 요구되는 경우 법 집행 기관
• 귀하의 동의가 있는 기타 당사자`
        },
        {
          title: '4. 데이터 보안',
          content: `당사는 정보 보호를 위해 업계 표준 보안 조치를 시행합니다:
• 모든 데이터 전송에 SSL/TLS 암호화
• 접근 제어가 있는 안전한 클라우드 스토리지
• 정기적인 보안 감사 및 업데이트

정보 보호를 위해 노력하지만, 인터넷을 통한 전송 방법은 100% 안전하지 않습니다.`
        },
        {
          title: '5. 데이터 보존',
          content: `계정이 활성 상태이거나 서비스 제공에 필요한 동안 정보를 보존합니다. 언제든지 연락하여 데이터 삭제를 요청할 수 있습니다.

생성된 이미지는 삭제할 때까지 계정에 저장됩니다. 분석 목적으로 익명화된 사용 데이터를 보존할 수 있습니다.`
        },
        {
          title: '6. 귀하의 권리',
          content: `귀하는 다음과 같은 권리가 있습니다:
• 개인정보 접근
• 부정확한 데이터 수정
• 계정 및 데이터 삭제
• 데이터 내보내기
• 마케팅 통신 수신 거부

이러한 권리를 행사하려면 support@honoululuai.com으로 연락하세요`
        },
        {
          title: '7. 쿠키',
          content: `당사는 쿠키 및 유사 기술을 사용합니다:
• 로그인 상태 유지
• 환경 설정 기억
• 사이트 트래픽 분석

브라우저 설정에서 쿠키를 제어할 수 있습니다.`
        },
        {
          title: '8. 정책 변경',
          content: `당사는 수시로 이 개인정보 처리방침을 업데이트할 수 있습니다. 중요한 변경 사항은 웹사이트에 공지하거나 이메일로 알려드립니다.`
        },
        {
          title: '9. 문의하기',
          content: `이 개인정보 처리방침에 대한 질문이 있으시면 연락해 주세요:
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
