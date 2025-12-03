import { NextResponse } from 'next/server'

// This will be set at build time
const BUILD_ID = process.env.NEXT_BUILD_ID || Date.now().toString()

export async function GET() {
  return NextResponse.json({ 
    version: BUILD_ID,
    timestamp: new Date().toISOString()
  })
}

