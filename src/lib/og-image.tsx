import { ImageResponse } from 'next/og'

export const ogImageSize = {
  width: 1200,
  height: 630,
}

export const ogContentType = 'image/png'

interface OGImageConfig {
  title: string
  subtitle: string
  emoji?: string
  gradient?: string
}

export function generateOGImage({
  title,
  subtitle,
  emoji = '📸',
  gradient = 'linear-gradient(135deg, #f97316 0%, #f59e0b 100%)',
}: OGImageConfig) {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #fafafa 0%, #f4f4f5 100%)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Background decorations */}
        <div
          style={{
            position: 'absolute',
            top: -100,
            left: -100,
            width: 400,
            height: 400,
            background: 'radial-gradient(circle, rgba(251, 146, 60, 0.3) 0%, transparent 70%)',
            borderRadius: '50%',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -100,
            right: -100,
            width: 500,
            height: 500,
            background: 'radial-gradient(circle, rgba(251, 191, 36, 0.3) 0%, transparent 70%)',
            borderRadius: '50%',
          }}
        />

        {/* Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px',
          }}
        >
          {/* Icon */}
          <div
            style={{
              width: 100,
              height: 100,
              background: gradient,
              borderRadius: 24,
              marginBottom: 30,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
              fontSize: 50,
            }}
          >
            {emoji}
          </div>

          {/* Title */}
          <h1
            style={{
              fontSize: 56,
              fontWeight: 800,
              color: '#18181b',
              margin: 0,
              textAlign: 'center',
              lineHeight: 1.2,
            }}
          >
            {title}
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontSize: 26,
              color: '#71717a',
              margin: '20px 0 0 0',
              textAlign: 'center',
              maxWidth: 800,
            }}
          >
            {subtitle}
          </p>

          {/* Brand */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginTop: 40,
              padding: '12px 24px',
              background: 'white',
              borderRadius: 100,
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                background: 'linear-gradient(135deg, #f97316 0%, #f59e0b 100%)',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>B</span>
            </div>
            <span style={{ fontSize: 20, fontWeight: 600, color: '#3f3f46' }}>BrandCam</span>
          </div>
        </div>
      </div>
    ),
    { ...ogImageSize }
  )
}
