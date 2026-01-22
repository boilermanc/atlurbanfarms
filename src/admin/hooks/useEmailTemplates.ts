import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

export interface EmailTemplate {
  id: string
  template_key: string
  name: string
  description: string | null
  subject_line: string
  html_content: string
  plain_text_content: string | null
  variables_schema: VariableSchema[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface VariableSchema {
  key: string
  label: string
  example: string
}

export interface EmailTemplateVersion {
  id: string
  template_id: string
  version_number: number
  subject_line: string
  html_content: string
  plain_text_content: string | null
  created_at: string
  created_by: string | null
}

export interface BrandSetting {
  id: string
  setting_key: string
  setting_value: string | null
  setting_type: string
  updated_at: string
}

/**
 * Hook for fetching all email templates
 */
export function useEmailTemplates() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('email_templates')
        .select('*')
        .order('name')

      if (fetchError) throw fetchError

      setTemplates(data || [])
    } catch (err: any) {
      console.error('Error fetching email templates:', err)
      setError(err.message || 'Failed to fetch templates')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  return { templates, loading, error, refetch: fetchTemplates }
}

/**
 * Hook for fetching a single email template by key
 */
export function useEmailTemplate(templateKey: string | null) {
  const [template, setTemplate] = useState<EmailTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTemplate = useCallback(async () => {
    if (!templateKey) {
      setTemplate(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('email_templates')
        .select('*')
        .eq('template_key', templateKey)
        .single()

      if (fetchError) throw fetchError

      setTemplate(data)
    } catch (err: any) {
      console.error('Error fetching email template:', err)
      setError(err.message || 'Failed to fetch template')
    } finally {
      setLoading(false)
    }
  }, [templateKey])

  useEffect(() => {
    fetchTemplate()
  }, [fetchTemplate])

  return { template, loading, error, refetch: fetchTemplate }
}

/**
 * Hook for updating an email template
 */
export function useUpdateEmailTemplate() {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateTemplate = useCallback(async (
    templateId: string,
    updates: Partial<Pick<EmailTemplate, 'subject_line' | 'html_content' | 'plain_text_content' | 'is_active' | 'name' | 'description'>>
  ): Promise<{ success: boolean; error?: string }> => {
    setSaving(true)
    setError(null)

    try {
      // First, get the current template to create a version
      const { data: currentTemplate, error: fetchError } = await supabase
        .from('email_templates')
        .select('*')
        .eq('id', templateId)
        .single()

      if (fetchError) throw fetchError

      // Get the current user
      const { data: { user } } = await supabase.auth.getUser()

      // Get the latest version number
      const { data: versions } = await supabase
        .from('email_template_versions')
        .select('version_number')
        .eq('template_id', templateId)
        .order('version_number', { ascending: false })
        .limit(1)

      const nextVersion = versions && versions.length > 0 ? versions[0].version_number + 1 : 1

      // Create a version of the current state before updating
      const { error: versionError } = await supabase
        .from('email_template_versions')
        .insert({
          template_id: templateId,
          version_number: nextVersion,
          subject_line: currentTemplate.subject_line,
          html_content: currentTemplate.html_content,
          plain_text_content: currentTemplate.plain_text_content,
          created_by: user?.id
        })

      if (versionError) {
        console.warn('Failed to create version:', versionError)
        // Continue anyway - version history is nice to have, not critical
      }

      // Update the template
      const { error: updateError } = await supabase
        .from('email_templates')
        .update(updates)
        .eq('id', templateId)

      if (updateError) throw updateError

      return { success: true }
    } catch (err: any) {
      console.error('Error updating email template:', err)
      const errorMsg = err.message || 'Failed to update template'
      setError(errorMsg)
      return { success: false, error: errorMsg }
    } finally {
      setSaving(false)
    }
  }, [])

  return { updateTemplate, saving, error }
}

/**
 * Hook for fetching template versions
 */
export function useTemplateVersions(templateId: string | null) {
  const [versions, setVersions] = useState<EmailTemplateVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchVersions = useCallback(async () => {
    if (!templateId) {
      setVersions([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('email_template_versions')
        .select('*')
        .eq('template_id', templateId)
        .order('version_number', { ascending: false })
        .limit(10)

      if (fetchError) throw fetchError

      setVersions(data || [])
    } catch (err: any) {
      console.error('Error fetching template versions:', err)
      setError(err.message || 'Failed to fetch versions')
    } finally {
      setLoading(false)
    }
  }, [templateId])

  useEffect(() => {
    fetchVersions()
  }, [fetchVersions])

  return { versions, loading, error, refetch: fetchVersions }
}

/**
 * Hook for fetching brand settings
 */
export function useBrandSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('email_brand_settings')
        .select('*')

      if (fetchError) throw fetchError

      const settingsMap: Record<string, string> = {}
      data?.forEach((s: BrandSetting) => {
        settingsMap[s.setting_key] = s.setting_value || ''
      })

      setSettings(settingsMap)
    } catch (err: any) {
      console.error('Error fetching brand settings:', err)
      setError(err.message || 'Failed to fetch brand settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  return { settings, loading, error, refetch: fetchSettings }
}

/**
 * Hook for updating brand settings
 */
export function useUpdateBrandSettings() {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateSettings = useCallback(async (
    updates: Record<string, string>
  ): Promise<{ success: boolean; error?: string }> => {
    setSaving(true)
    setError(null)

    try {
      // Update each setting
      for (const [key, value] of Object.entries(updates)) {
        const { error: updateError } = await supabase
          .from('email_brand_settings')
          .update({ setting_value: value })
          .eq('setting_key', key)

        if (updateError) throw updateError
      }

      return { success: true }
    } catch (err: any) {
      console.error('Error updating brand settings:', err)
      const errorMsg = err.message || 'Failed to update brand settings'
      setError(errorMsg)
      return { success: false, error: errorMsg }
    } finally {
      setSaving(false)
    }
  }, [])

  return { updateSettings, saving, error }
}

/**
 * Helper function to replace variables in template
 */
export function replaceVariables(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] ?? match
  })
}

/**
 * Sample data for template preview
 */
export const SAMPLE_PREVIEW_DATA: Record<string, string> = {
  customer_name: 'John Smith',
  customer_first_name: 'John',
  customer_email: 'john@example.com',
  order_id: 'ORD-2025-001234',
  order_date: 'January 22, 2025',
  order_total: '$47.99',
  order_subtotal: '$42.99',
  order_shipping: '$5.00',
  order_tax: '$0.00',
  order_items: `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 20px 0;">
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 10px 0;"><strong>Tomato Seedling (Cherry)</strong><br><span style="color: #666; font-size: 14px;">Qty: 2</span></td>
        <td style="padding: 10px 0; text-align: right;">$19.98</td>
      </tr>
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 10px 0;"><strong>Basil Seedling (Sweet)</strong><br><span style="color: #666; font-size: 14px;">Qty: 1</span></td>
        <td style="padding: 10px 0; text-align: right;">$8.99</td>
      </tr>
      <tr>
        <td style="padding: 10px 0;"><strong>Herb Garden Starter Kit</strong><br><span style="color: #666; font-size: 14px;">Qty: 1</span></td>
        <td style="padding: 10px 0; text-align: right;">$14.02</td>
      </tr>
    </table>
  `,
  tracking_number: '1Z999AA10123456784',
  carrier: 'UPS',
  tracking_url: 'https://www.ups.com/track?tracknum=1Z999AA10123456784',
  estimated_delivery: 'January 25, 2025',
  login_url: 'https://atlurbanfarms.com/login',
  reset_url: 'https://atlurbanfarms.com/reset-password?token=abc123',
  expiry_time: '24 hours',
  pickup_location: 'ATL Urban Farms - Westside',
  pickup_address: '123 Garden St, Atlanta, GA 30318',
  pickup_hours: 'Mon-Sat 9am-5pm',
  pickup_instructions: 'Ring doorbell on arrival',
  business_name: 'ATL Urban Farms',
  business_email: 'hello@atlurbanfarms.com',
  business_phone: '(404) 555-1234',
  business_address: 'Atlanta, GA',
  logo_url: '',
  current_year: new Date().getFullYear().toString(),
  footer_text: `© ${new Date().getFullYear()} ATL Urban Farms. All rights reserved.`,
}
