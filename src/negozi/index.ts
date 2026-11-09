import { impostazioni as tomacapelli } from './tomacapelli.ts'

const NEGOZI = {
  tomacapelli,
} as const

type Slug = keyof typeof NEGOZI

declare const process: { env?: Record<string, string> } | undefined

function scegliNegozio(slugEnv?: string) {
  const slug: Slug =
    slugEnv && slugEnv in NEGOZI ? (slugEnv as Slug) : (Object.keys(NEGOZI)[0] as Slug)
  return NEGOZI[slug]
}

function envNegozio(): string | undefined {
  const viteEnv = (import.meta as unknown as { env?: Record<string, string> }).env
  if (viteEnv?.VITE_NEGOZIO) return viteEnv.VITE_NEGOZIO
  if (typeof process !== 'undefined' && process.env) {
    return process.env.VITE_NEGOZIO
  }
  return undefined
}

export const impostazioni = scegliNegozio(envNegozio())
