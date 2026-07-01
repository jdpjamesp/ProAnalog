import OpenAI from 'openai'
import type { ProviderConfig } from '../shared/types'

function googleNativeBase(baseUrl: string): string | null {
  const m = baseUrl.match(/^(https:\/\/generativelanguage\.googleapis\.com\/v[^/]+)/)
  return m ? m[1] : null
}

// Parses the retryDelay from a Google RetryInfo detail block, e.g. "54s" → 54000.
// Returns null if no RetryInfo is present (hard quota, not a transient rate limit).
function parseGoogleRetryDelayMs(details: Array<Record<string, unknown>>): number | null {
  for (const d of details) {
    if (typeof d['@type'] === 'string' && d['@type'].includes('RetryInfo')) {
      const m = String(d.retryDelay ?? '').match(/^(\d+)s$/)
      if (m) return parseInt(m[1], 10) * 1000
    }
  }
  return null
}

const GOOGLE_RETRY_MAX = 5

async function googleBatchEmbed(
  url: string,
  body: object,
  attempt = 0
): Promise<{ embeddings: { values: number[] }[] }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()

    if (res.status === 429) {
      let details: Array<Record<string, unknown>> = []
      try { details = (JSON.parse(text)?.error?.details ?? []) as Array<Record<string, unknown>> } catch { /* ignore */ }

      const delayMs = parseGoogleRetryDelayMs(details)

      if (delayMs !== null && attempt < GOOGLE_RETRY_MAX) {
        // Transient rate limit — wait the requested delay then retry
        await new Promise(r => setTimeout(r, delayMs + 1000))
        return googleBatchEmbed(url, body, attempt + 1)
      }

      if (delayMs === null) {
        // No retryDelay = hard daily quota exhausted, not worth retrying
        throw new Error(
          'Google API daily quota exceeded. Try again tomorrow or switch to a different embedding provider in Settings.'
        )
      }

      throw new Error(`Google API rate limit: still throttled after ${GOOGLE_RETRY_MAX} retries.`)
    }

    throw new Error(`Google embedding error: ${text}`)
  }

  return res.json() as Promise<{ embeddings: { values: number[] }[] }>
}

/**
 * Embed one or more strings using the configured provider.
 * Uses the Google native batchEmbedContents API when the base URL is a
 * generativelanguage.googleapis.com endpoint, because text-embedding-004 is
 * not available on the OpenAI-compatible /embeddings route.
 */
export async function embedTexts(
  config: ProviderConfig,
  inputs: string[]
): Promise<number[][]> {
  const model = config.embedding_model!
  const nativeBase = config.base_url ? googleNativeBase(config.base_url) : null

  if (nativeBase) {
    const url = `${nativeBase}/models/${model}:batchEmbedContents?key=${config.api_key}`
    const data = await googleBatchEmbed(url, {
      requests: inputs.map(text => ({
        model: `models/${model}`,
        content: { parts: [{ text }] },
      })),
    })
    return data.embeddings.map(e => e.values)
  }

  const client = new OpenAI({
    apiKey: config.api_key || 'no-key',
    baseURL: config.base_url || undefined,
    timeout: (config.timeout_seconds ?? 120) * 1000,
  })
  const result = await client.embeddings.create({ model, input: inputs })
  return result.data.map(d => d.embedding)
}
