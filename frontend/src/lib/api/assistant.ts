import { useMutation } from '@tanstack/react-query'
import { api } from './client'

export type AssistantSource = { id: string; title: string; path: string }

/** POST /api/assistant/messages → { answer, sources[], safety_note? } (51:561). */
export type AssistantAnswer = {
  answer: string
  sources: AssistantSource[]
  safety_note: string | null
  matched: boolean
  /** false while the guide answers from article text only (decision #77). */
  generated: boolean
  suggestions: string[]
}

export const ASSISTANT_MAX_CHARS = 500

export function useAskAssistant() {
  return useMutation({
    mutationFn: async (message: string) =>
      (await api.post<{ data: AssistantAnswer }>('/api/assistant/messages', { message })).data.data,
  })
}
