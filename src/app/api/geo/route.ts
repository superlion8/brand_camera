import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const geo = request.geo
  const country = geo?.country || 'unknown'
  
  return NextResponse.json({
    country,
    isChina: country === 'CN'
  })
}

