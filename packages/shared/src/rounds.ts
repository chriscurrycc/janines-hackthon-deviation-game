import type { Category, Round } from './types'

/** Pick a target word + decoys from a category, returning shuffled options. */
export function pickRound(category: Category, optionCount = 4): Round {
  const pool = [...category.words]
  const target = pool.splice(Math.floor(Math.random() * pool.length), 1)[0]
  const options = [target]
  while (options.length < optionCount && pool.length) {
    options.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0])
  }
  return { category, target, options: shuffle(options) }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
