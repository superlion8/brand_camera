'use client'

import Link from 'next/link'
import { ArrowRight, Zap, Globe, Shield, Heart } from 'lucide-react'
import { useLanguageStore } from '@/stores/languageStore'

export default function AboutPage() {
  const language = useLanguageStore((state) => state.language)

  const content = {
    en: {
      title: 'About Brand Camera',
      subtitle: 'Transforming product photography with AI',
      mission: 'Our Mission',
      missionText: 'We believe every brand deserves stunning product photography, regardless of budget or resources. Brand Camera uses cutting-edge AI to democratize professional photography, making it accessible to businesses of all sizes.',
      story: 'Our Story',
      storyText: 'Founded in 2024, Brand Camera started with a simple observation: small e-commerce brands struggle to compete with larger players when it comes to product imagery. Professional photoshoots are expensive, time-consuming, and often out of reach. We set out to change that.',
      values: 'Our Values',
      valuesList: [
        { icon: Zap, title: 'Innovation', text: 'We push the boundaries of what AI can do for visual content creation.' },
        { icon: Globe, title: 'Accessibility', text: 'Professional photography tools should be available to everyone.' },
        { icon: Shield, title: 'Quality', text: 'We never compromise on the quality of generated images.' },
        { icon: Heart, title: 'Customer Focus', text: 'Your success is our success. We listen and continuously improve.' },
      ],
      cta: 'Start Creating',
    },
    zh: {
      title: '关于 Brand Camera',
      subtitle: '用 AI 革新产品摄影',
      mission: '我们的使命',
      missionText: '我们相信每个品牌都值得拥有出色的产品摄影，无论预算或资源如何。Brand Camera 使用尖端 AI 技术让专业摄影平民化，让各种规模的企业都能使用。',
      story: '我们的故事',
      storyText: 'Brand Camera 成立于 2024 年，起源于一个简单的观察：小型电商品牌在产品图片方面很难与大型企业竞争。专业拍摄昂贵、耗时，往往难以企及。我们决心改变这一现状。',
      values: '我们的价值观',
      valuesList: [
        { icon: Zap, title: '创新', text: '我们不断突破 AI 在视觉内容创作方面的极限。' },
        { icon: Globe, title: '普惠', text: '专业摄影工具应该人人可用。' },
        { icon: Shield, title: '品质', text: '我们绝不在生成图片的质量上妥协。' },
        { icon: Heart, title: '客户至上', text: '您的成功就是我们的成功。我们倾听并持续改进。' },
      ],
      cta: '开始创作',
    },
    ko: {
      title: 'Brand Camera 소개',
      subtitle: 'AI로 제품 사진을 혁신합니다',
      mission: '우리의 미션',
      missionText: '우리는 예산이나 자원에 관계없이 모든 브랜드가 멋진 제품 사진을 가질 자격이 있다고 믿습니다. Brand Camera는 최첨단 AI를 사용하여 전문 사진을 대중화하고 모든 규모의 비즈니스가 이용할 수 있도록 합니다.',
      story: '우리의 이야기',
      storyText: '2024년에 설립된 Brand Camera는 간단한 관찰에서 시작되었습니다: 소규모 이커머스 브랜드는 제품 이미지에서 대기업과 경쟁하기 어렵습니다. 전문 촬영은 비용이 많이 들고 시간이 오래 걸리며 종종 접근하기 어렵습니다. 우리는 이를 바꾸기로 했습니다.',
      values: '우리의 가치',
      valuesList: [
        { icon: Zap, title: '혁신', text: 'AI가 비주얼 콘텐츠 제작에서 할 수 있는 일의 한계를 넓힙니다.' },
        { icon: Globe, title: '접근성', text: '전문 사진 도구는 모든 사람이 이용할 수 있어야 합니다.' },
        { icon: Shield, title: '품질', text: '생성된 이미지의 품질에 타협하지 않습니다.' },
        { icon: Heart, title: '고객 중심', text: '고객의 성공이 우리의 성공입니다. 경청하고 지속적으로 개선합니다.' },
      ],
      cta: '시작하기',
    },
  }

  const t = content[language]

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50/50 to-white">
      <div className="max-w-4xl mx-auto px-6 py-16 md:py-24">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-zinc-900 mb-4">
            {t.title}
          </h1>
          <p className="text-xl text-zinc-500">
            {t.subtitle}
          </p>
        </div>

        {/* Mission */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-zinc-900 mb-4">{t.mission}</h2>
          <p className="text-lg text-zinc-600 leading-relaxed">
            {t.missionText}
          </p>
        </section>

        {/* Story */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-zinc-900 mb-4">{t.story}</h2>
          <p className="text-lg text-zinc-600 leading-relaxed">
            {t.storyText}
          </p>
        </section>

        {/* Values */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-zinc-900 mb-8">{t.values}</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {t.valuesList.map((value, index) => (
              <div 
                key={index}
                className="p-6 bg-white rounded-2xl border border-zinc-100 shadow-sm"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center text-orange-500 mb-4">
                  <value.icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold text-zinc-900 mb-2">{value.title}</h3>
                <p className="text-zinc-600">{value.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className="text-center">
          <Link
            href="/app"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-full shadow-xl shadow-orange-500/25 hover:shadow-2xl hover:shadow-orange-500/30 hover:-translate-y-0.5 transition-all"
          >
            {t.cta}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}
