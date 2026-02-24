import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

export interface EmailTemplate {
  id: string
  template_key: string
  name: string
  description: string | null
  category: string | null
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
 * Hook for creating a new email template
 */
export function useCreateEmailTemplate() {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createTemplate = useCallback(async (
    template: Pick<EmailTemplate, 'template_key' | 'name' | 'description' | 'category' | 'subject_line'> & {
      html_content?: string
      plain_text_content?: string
      variables_schema?: VariableSchema[]
      is_active?: boolean
    }
  ): Promise<{ success: boolean; error?: string; template?: EmailTemplate }> => {
    setSaving(true)
    setError(null)

    try {
      const { data, error: insertError } = await supabase
        .from('email_templates')
        .insert({
          template_key: template.template_key,
          name: template.name,
          description: template.description || null,
          category: template.category || 'general',
          subject_line: template.subject_line,
          html_content: template.html_content || '',
          plain_text_content: template.plain_text_content || null,
          variables_schema: template.variables_schema || [],
          is_active: template.is_active ?? true,
        })
        .select()
        .single()

      if (insertError) throw insertError

      return { success: true, template: data }
    } catch (err: any) {
      console.error('Error creating email template:', err)
      const errorMsg = err.message || 'Failed to create template'
      setError(errorMsg)
      return { success: false, error: errorMsg }
    } finally {
      setSaving(false)
    }
  }, [])

  return { createTemplate, saving, error }
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
 * Hook for fetching brand settings from config_settings (single source of truth).
 * Maps config_settings keys to email template variable names.
 */
export function useBrandSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Fetch branding settings
      const { data: brandingData, error: brandingError } = await supabase
        .from('config_settings')
        .select('key, value, data_type')
        .eq('category', 'branding')

      if (brandingError) throw brandingError

      // Fetch business settings for name/email/phone
      const { data: businessData, error: businessError } = await supabase
        .from('config_settings')
        .select('key, value, data_type')
        .eq('category', 'business')
        .in('key', ['company_name', 'support_email', 'support_phone', 'business_address'])

      if (businessError) throw businessError

      const raw: Record<string, string> = {}
      for (const row of [...(brandingData || []), ...(businessData || [])]) {
        // Strip double-encoded JSONB strings
        let val = row.value
        if (typeof val === 'string' && val.startsWith('"') && val.endsWith('"')) {
          try { val = JSON.parse(val) } catch { /* keep as-is */ }
        }
        raw[row.key] = String(val ?? '')
      }

      // Map to email template variable names (same mapping as edge function)
      const companyName = raw.company_name || 'ATL Urban Farms'
      const settingsMap: Record<string, string> = {
        primary_color: raw.primary_brand_color || '#10b981',
        secondary_color: raw.secondary_brand_color || '#047857',
        logo_url: raw.logo_url || '',
        business_name: companyName,
        business_email: raw.support_email || 'hello@atlurbanfarms.com',
        business_phone: raw.support_phone || '',
        business_address: raw.business_address || 'Atlanta, GA',
        footer_text: `\u00a9 ${new Date().getFullYear()} ${companyName}. All rights reserved.`,
        facebook_url: raw.social_facebook || '',
        instagram_url: raw.social_instagram || '',
        current_year: new Date().getFullYear().toString(),
      }

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
/**
 * Generate progress bar HTML for email template preview
 */
function generatePreviewProgressBar(activeStep: number): string {
  const steps = ['Order<br>Placed', 'Shipped', 'In<br>Transit', 'Delivered']
  const activeColor = '#8dc63f'
  const inactiveColor = '#d1d5db'
  const activeTextColor = '#333333'
  const inactiveTextColor = '#999999'

  let html = '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;">'
  html += '<tr>'
  steps.forEach((_step, i) => {
    const isActive = i < activeStep
    const color = isActive ? activeColor : inactiveColor
    html += `<td width="40" align="center" valign="middle" style="padding:0;"><div style="width:20px;height:20px;border-radius:50%;background-color:${color};margin:0 auto;font-size:0;line-height:0;">&nbsp;</div></td>`
    if (i < steps.length - 1) {
      const connectorColor = i < activeStep - 1 ? activeColor : inactiveColor
      html += `<td valign="middle" style="padding:0 2px;"><div style="height:3px;background-color:${connectorColor};border-radius:2px;"></div></td>`
    }
  })
  html += '</tr><tr>'
  steps.forEach((step, i) => {
    const isActive = i < activeStep
    const textColor = isActive ? activeTextColor : inactiveTextColor
    html += `<td align="center" style="padding-top:8px;font-size:11px;font-family:Arial,Helvetica,sans-serif;color:${textColor};line-height:1.3;">${step}</td>`
    if (i < steps.length - 1) html += '<td></td>'
  })
  html += '</tr></table>'
  return html
}

export const SAMPLE_PREVIEW_DATA: Record<string, string> = {
  customer_name: 'John Smith',
  customer_first_name: 'John',
  customer_email: 'john@example.com',
  customer_phone: '(404) 555-9876',
  order_id: 'ORD-2025-001234',
  order_date: 'January 22, 2025',
  order_total: '$47.99',
  order_subtotal: '$42.99',
  order_shipping: '$5.00',
  order_tax: '$0.00',
  order_items: '2 x Tomato Seedling (Cherry)<br>1 x Basil Seedling (Sweet)<br>1 x Herb Garden Starter Kit',
  tracking_number: '1Z999AA10123456784',
  carrier: 'UPS',
  tracking_url: 'https://www.ups.com/track?tracknum=1Z999AA10123456784',
  estimated_delivery: 'Friday, January 24th',
  current_location: 'Atlanta, GA Distribution Center',
  delivery_date: 'January 24, 2026 at 2:30 PM',
  order_number: 'ORD-2026-001234',
  shipping_address: '123 Garden St<br>Atlanta, GA 30318',
  status: 'Shipped',
  progress_bar: generatePreviewProgressBar(2),
  pickup_date: 'Saturday, January 25th',
  pickup_time: '10:00 AM - 2:00 PM',
  login_url: 'https://atlurbanfarms.com/login',
  reset_url: 'https://atlurbanfarms.com/reset-password?token=abc123',
  expiry_time: '24 hours',
  pickup_location: 'ATL Urban Farms - Westside',
  pickup_address: '123 Garden St, Atlanta, GA 30318',
  pickup_hours: 'Mon-Sat 9am-5pm',
  pickup_instructions: 'Ring doorbell on arrival',
  business_name: 'ATL Urban Farms',
  business_email: 'hello@atlurbanfarms.com',
  business_phone: '770.678.6552',
  business_address: 'Atlanta, GA',
  logo_url: '',
  current_year: new Date().getFullYear().toString(),
  footer_text: `© ${new Date().getFullYear()} ATL Urban Farms. All rights reserved.`,
}
