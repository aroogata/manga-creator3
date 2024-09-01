import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { prompt, size } = await request.json()
  const apiKey = process.env.FAL_AI_API_KEY

  if (!apiKey) {
    return NextResponse.json({ error: 'API key not found' }, { status: 500 })
  }

  const response = await fetch('https://fal.run/fal-ai/fast-lightning-sdxl', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Key ${apiKey}`,
    },
    body: JSON.stringify({
      prompt: prompt,
      image_size: size,
    }),
  })

  const data = await response.json()
  return NextResponse.json(data)
}