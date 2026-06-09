// Server-only entry. Pulls in the Anthropic SDK; import this only from server code
// (Next.js route handlers, the realtime service) — never from client components.
export * from './guesser'
