import Anthropic from '@anthropic-ai/sdk'
import type { AIGuess } from './types'

// The AI opponent. Sends the drawing to a Claude vision model and asks it to pick one of
// the multiple-choice options. Structured outputs guarantee valid JSON and constrain the
// guess to the given options. Falls back to a mock so the game always runs end to end.
// Default is Haiku 4.5 (cheapest, vision-capable — good for this simple classify task);
// override with ANTHROPIC_MODEL (e.g. claude-sonnet-4-6 for the stronger "medium" tier).
const DEFAULT_MODEL = 'claude-haiku-4-5'

function mock(options: string[], reasoning: string, error?: string): AIGuess {
  return {
    guess: options[0] ?? '???',
    confidence: 60,
    reasoning,
    mock: true,
    ...(error ? { error } : {}),
  }
}

export async function callGuesser(image: string, options: string[], category: string): Promise<AIGuess> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return mock(options, '(mock：未配置 ANTHROPIC_API_KEY)')

  const match = /^data:(image\/\w+);base64,(.+)$/.exec(image || '')
  if (!match) return mock(options, '(兜底)', 'image must be a base64 data URL')
  const [, mediaType, b64] = match

  const client = new Anthropic({ apiKey, baseURL: process.env.ANTHROPIC_BASE_URL })
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL
  const optList = options.map((o, i) => `${i + 1}. ${o}`).join('\n')
  const prompt = `这是一幅手绘涂鸦，类别是「${category}」。请从下面的选项里猜它画的是哪一个词：\n${optList}\n\n只能从选项里选一个，并给出 0-100 的信心值和 10 字内的中文理由。`

  try {
    const resp = await client.messages.create({
      model,
      max_tokens: 512,
      thinking: { type: 'disabled' }, // simple classify — keep it fast and cheap
      // Structured outputs: guaranteed-valid JSON, and `guess` is constrained to the options.
      output_config: {
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: {
              guess: { type: 'string', enum: options },
              confidence: { type: 'integer' },
              reasoning: { type: 'string' },
            },
            required: ['guess', 'confidence', 'reasoning'],
            additionalProperties: false,
          },
        },
      },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType as 'image/png', data: b64 } },
            { type: 'text', text: prompt },
          ],
        },
      ],
    })
    const textBlock = resp.content.find((b) => b.type === 'text')
    const parsed = JSON.parse(textBlock && 'text' in textBlock ? textBlock.text : '{}')
    return {
      guess: String(parsed.guess ?? options[0] ?? '???'),
      confidence: Math.max(0, Math.min(100, Number(parsed.confidence) || 50)),
      reasoning: String(parsed.reasoning ?? ''),
      mock: false,
    }
  } catch (e) {
    return mock(options, '(调用失败兜底)', String(e))
  }
}
