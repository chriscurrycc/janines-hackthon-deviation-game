// Client-safe entry: types + word/round logic. No server-only deps (no Anthropic SDK).
// The AI guesser lives at "@deviation/shared/server" so it never reaches the browser bundle.
export * from './types'
export * from './words'
export * from './rounds'
