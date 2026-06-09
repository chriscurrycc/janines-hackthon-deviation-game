import { categories, pickRound, type AIGuess, type Round } from '@deviation/shared'

export { categories, pickRound }

/** Ask the AI opponent to guess the drawing. Falls back to a mock if the API errors. */
export async function askAI(image: string, round: Round): Promise<AIGuess> {
  try {
    const res = await fetch('/api/guess', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ image, options: round.options, category: round.category.label }),
    })
    if (!res.ok) throw new Error(`api ${res.status}`)
    return (await res.json()) as AIGuess
  } catch (e) {
    return { guess: round.options[0], confidence: 55, reasoning: '(本地兜底)', mock: true, error: String(e) }
  }
}
