import { ImageResponse } from 'next/og'

// Image metadata
export const alt = 'Brand Camera - AI Product Photography'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

// Image generation
export default async function OGImage() {
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
          {/* Logo placeholder */}
          <div
            style={{
              width: 80,
              height: 80,
              background: 'linear-gradient(135deg, #f97316 0%, #f59e0b 100%)',
              borderRadius: 20,
              marginBottom: 30,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 25px 50px -12px rgba(249, 115, 22, 0.25)',
            }}
          >
            <span style={{ color: 'white', fontSize: 40, fontWeight: 'bold' }}>B</span>
          </div>

          {/* Title */}
          <h1
            style={{
              fontSize: 64,
              fontWeight: 800,
              color: '#18181b',
              margin: 0,
              textAlign: 'center',
              lineHeight: 1.1,
            }}
          >
            Brand Camera
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontSize: 28,
              color: '#71717a',
              margin: '20px 0 0 0',
              textAlign: 'center',
            }}
          >
            AI-Powered Product Photography
          </p>

          {/* Features */}
          <div
            style={{
              display: 'flex',
              gap: 40,
              marginTop: 40,
            }}
          >
            {['Model Photos', 'Lifestyle Shots', 'Brand Style'].map((feature) => (
              <div
                key={feature}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 20px',
                  background: 'white',
                  borderRadius: 100,
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    background: '#22c55e',
                    borderRadius: '50%',
                  }}
                />
                <span style={{ fontSize: 18, color: '#3f3f46' }}>{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
