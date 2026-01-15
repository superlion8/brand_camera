'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLanguageStore } from '@/stores/languageStore'

interface FAQItem {
  question: {
    en: string
    zh: string
    ko: string
  }
  answer: {
    en: string
    zh: string
    ko: string
  }
}

const faqs: FAQItem[] = [
  {
    question: {
      en: 'What is BrandCam?',
      zh: '什么是 BrandCam？',
      ko: 'BrandCam이란 무엇인가요?',
    },
    answer: {
      en: 'BrandCam is an AI-powered product photography platform that helps e-commerce brands create professional model photos, lifestyle shots, and product images in seconds. No photographers, studios, or expensive equipment needed.',
      zh: 'BrandCam 是一个 AI 驱动的产品摄影平台，帮助电商品牌在几秒钟内创建专业的模特照片、场景图和产品图片。无需摄影师、工作室或昂贵的设备。',
      ko: 'BrandCam은 AI 기반 제품 사진 플랫폼으로, 이커머스 브랜드가 몇 초 만에 전문적인 모델 사진, 라이프스타일 샷, 제품 이미지를 만들 수 있도록 도와줍니다. 사진작가, 스튜디오, 고가의 장비가 필요 없습니다.',
    },
  },
  {
    question: {
      en: 'How does AI model photography work?',
      zh: 'AI 模特摄影是如何工作的？',
      ko: 'AI 모델 사진은 어떻게 작동하나요?',
    },
    answer: {
      en: 'Simply upload your product photo, select a model style or use our AI to match the perfect model, and our AI generates professional model photos wearing or holding your product. The entire process takes just seconds.',
      zh: '只需上传您的产品照片，选择模特风格或使用我们的 AI 匹配完美的模特，我们的 AI 就会生成穿着或展示您产品的专业模特照片。整个过程只需几秒钟。',
      ko: '제품 사진을 업로드하고, 모델 스타일을 선택하거나 AI가 완벽한 모델을 매칭하면, AI가 제품을 착용하거나 들고 있는 전문 모델 사진을 생성합니다. 전체 과정은 몇 초밖에 걸리지 않습니다.',
    },
  },
  {
    question: {
      en: 'What types of products work best?',
      zh: '哪些类型的产品效果最好？',
      ko: '어떤 종류의 제품이 가장 잘 작동하나요?',
    },
    answer: {
      en: 'BrandCam works great with fashion items (clothing, accessories, jewelry), beauty products, electronics, home goods, and more. Any product that benefits from lifestyle or model photography can be enhanced with our AI.',
      zh: 'BrandCam 非常适合时尚单品（服装、配饰、珠宝）、美妆产品、电子产品、家居用品等。任何需要场景图或模特图的产品都可以通过我们的 AI 得到提升。',
      ko: 'BrandCam은 패션 아이템(의류, 액세서리, 주얼리), 뷰티 제품, 전자제품, 홈 용품 등에 매우 적합합니다. 라이프스타일이나 모델 사진이 필요한 모든 제품을 AI로 향상시킬 수 있습니다.',
    },
  },
  {
    question: {
      en: 'How much does it cost?',
      zh: '价格是多少？',
      ko: '비용은 얼마인가요?',
    },
    answer: {
      en: 'We offer flexible credit-based pricing. New users get free credits to try the platform. Paid plans start from $9.99/month with more credits for higher volume needs. Check our pricing page for details.',
      zh: '我们提供灵活的积分制定价。新用户可以获得免费积分试用平台。付费计划从 $9.99/月起，更高需求可以选择更多积分的套餐。详情请查看我们的定价页面。',
      ko: '유연한 크레딧 기반 가격을 제공합니다. 신규 사용자는 플랫폼을 사용해 볼 수 있는 무료 크레딧을 받습니다. 유료 플랜은 월 $9.99부터 시작하며, 더 많은 사용량이 필요한 경우 더 많은 크레딧을 제공합니다. 자세한 내용은 가격 페이지를 확인하세요.',
    },
  },
  {
    question: {
      en: 'Can I use the images commercially?',
      zh: '我可以将图片用于商业用途吗？',
      ko: '이미지를 상업적으로 사용할 수 있나요?',
    },
    answer: {
      en: 'Yes! All images generated with BrandCam are yours to use commercially. Use them on your website, social media, marketplaces like Amazon or Shopify, advertising, and more.',
      zh: '当然可以！使用 BrandCam 生成的所有图片都可以用于商业用途。您可以在网站、社交媒体、亚马逊或 Shopify 等平台、广告等任何地方使用。',
      ko: '네! BrandCam으로 생성된 모든 이미지는 상업적으로 사용할 수 있습니다. 웹사이트, 소셜 미디어, Amazon이나 Shopify 같은 마켓플레이스, 광고 등에서 자유롭게 사용하세요.',
    },
  },
  {
    question: {
      en: 'How long does it take to generate an image?',
      zh: '生成一张图片需要多长时间？',
      ko: '이미지 생성에 얼마나 걸리나요?',
    },
    answer: {
      en: 'Most images are generated in 10-30 seconds. Complex requests like videos or multiple variations may take slightly longer. You can generate multiple images simultaneously.',
      zh: '大多数图片在 10-30 秒内生成。视频或多个变体等复杂请求可能需要稍长时间。您可以同时生成多张图片。',
      ko: '대부분의 이미지는 10-30초 내에 생성됩니다. 비디오나 여러 변형 같은 복잡한 요청은 조금 더 오래 걸릴 수 있습니다. 여러 이미지를 동시에 생성할 수 있습니다.',
    },
  },
  {
    question: {
      en: 'Do you offer refunds?',
      zh: '你们提供退款吗？',
      ko: '환불을 제공하나요?',
    },
    answer: {
      en: 'We offer a satisfaction guarantee. If you\'re not happy with the results, contact our support team and we\'ll work with you to make it right or provide a refund for unused credits.',
      zh: '我们提供满意保证。如果您对结果不满意，请联系我们的支持团队，我们会与您一起解决问题或为未使用的积分提供退款。',
      ko: '만족 보장을 제공합니다. 결과에 만족하지 않으시면 지원팀에 연락해 주세요. 문제를 해결하거나 미사용 크레딧에 대해 환불해 드리겠습니다.',
    },
  },
  {
    question: {
      en: 'Is my data secure?',
      zh: '我的数据安全吗？',
      ko: '내 데이터는 안전한가요?',
    },
    answer: {
      en: 'Yes, we take data security seriously. Your uploaded images and generated content are stored securely and never shared with third parties. You can delete your data at any time.',
      zh: '是的，我们非常重视数据安全。您上传的图片和生成的内容都安全存储，绝不会与第三方共享。您可以随时删除您的数据。',
      ko: '네, 데이터 보안을 매우 중요하게 생각합니다. 업로드한 이미지와 생성된 콘텐츠는 안전하게 저장되며 제3자와 공유되지 않습니다. 언제든지 데이터를 삭제할 수 있습니다.',
    },
  },
]

function FAQAccordion({ item, isOpen, onClick, language }: { 
  item: FAQItem
  isOpen: boolean
  onClick: () => void
  language: 'en' | 'zh' | 'ko'
}) {
  return (
    <div className="border-b border-zinc-200">
      <button
        onClick={onClick}
        className="w-full py-5 flex items-center justify-between text-left hover:text-orange-600 transition-colors"
      >
        <span className="font-medium text-zinc-900 pr-4">{item.question[language]}</span>
        <ChevronDown 
          className={`w-5 h-5 text-zinc-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="pb-5 text-zinc-600 leading-relaxed">
              {item.answer[language]}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)
  const language = useLanguageStore((state) => state.language)

  const titles = {
    en: 'Frequently Asked Questions',
    zh: '常见问题',
    ko: '자주 묻는 질문',
  }

  const subtitles = {
    en: 'Everything you need to know about BrandCam',
    zh: '关于 BrandCam 您需要了解的一切',
    ko: 'BrandCam에 대해 알아야 할 모든 것',
  }

  const contactTitles = {
    en: 'Still have questions?',
    zh: '还有其他问题？',
    ko: '아직 궁금한 점이 있으신가요?',
  }

  const contactTexts = {
    en: 'Contact our support team at support@brandcam.agency',
    zh: '请联系我们的支持团队：support@brandcam.agency',
    ko: '지원팀에 문의하세요: support@brandcam.agency',
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50/50 to-white">
      <div className="max-w-3xl mx-auto px-6 py-16 md:py-24">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 mb-4">
            {titles[language]}
          </h1>
          <p className="text-zinc-500 text-lg">
            {subtitles[language]}
          </p>
        </div>

        {/* FAQ List */}
        <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 px-6 md:px-8">
          {faqs.map((faq, index) => (
            <FAQAccordion
              key={index}
              item={faq}
              isOpen={openIndex === index}
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
              language={language}
            />
          ))}
        </div>

        {/* Contact CTA */}
        <div className="mt-12 text-center">
          <h2 className="text-xl font-semibold text-zinc-900 mb-2">
            {contactTitles[language]}
          </h2>
          <p className="text-zinc-500">
            {contactTexts[language]}
          </p>
        </div>
      </div>
    </div>
  )
}
