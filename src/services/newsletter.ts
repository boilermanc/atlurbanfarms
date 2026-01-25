import { supabase } from '../lib/supabase'

type NewsletterStatus = 'active' | 'unsubscribed' | 'bounced'

interface NewsletterPreferencePayload {
  email: string
  firstName?: string | null
  lastName?: string | null
  customerId?: string | null
  source?: string
  status?: NewsletterStatus
  tags?: string[]
}

export interface NewsletterResponse {
  success: boolean
  subscriber?: Record<string, any>
  message?: string
}

const DEFAULT_ERROR = 'Unable to update newsletter preferences right now. Please try again.'

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export async function submitNewsletterPreference(payload: NewsletterPreferencePayload) {
  if (!payload.email) {
    throw new Error('Email is required')
  }

  const body = {
    email: normalizeEmail(payload.email),
    first_name: payload.firstName?.trim() || null,
    last_name: payload.lastName?.trim() || null,
    customer_id: payload.customerId || null,
    source: payload.source || null,
    status: payload.status || 'active',
    tags: payload.tags || undefined,
  }

  const { data, error } = await supabase.functions.invoke<NewsletterResponse>('newsletter-subscribe', {
    body,
  })

  if (error) {
    throw new Error(error.message || DEFAULT_ERROR)
  }

  if (data?.success) {
    return data
  }

  throw new Error(data?.message || DEFAULT_ERROR)
}
