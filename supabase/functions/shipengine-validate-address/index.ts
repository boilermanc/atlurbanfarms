import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getIntegrationSettings } from '../_shared/settings.ts'

interface AddressInput {
  name?: string
  company_name?: string
  phone?: string
  address_line1: string
  address_line2?: string
  city_locality: string
  state_province: string
  postal_code: string
  country_code?: string
}

interface ValidationResult {
  success: boolean
  status: 'verified' | 'unverified' | 'warning' | 'error'
  original_address: AddressInput
  matched_address?: AddressInput
  is_residential?: boolean
  messages: string[]
}

serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    // Create Supabase client with service role
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get ShipEngine API key from settings
    const settings = await getIntegrationSettings(supabaseClient, [
      'shipstation_enabled',
      'shipengine_api_key'
    ])

    if (!settings.shipstation_enabled) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'INTEGRATION_DISABLED',
            message: 'ShipEngine integration is not enabled'
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (!settings.shipengine_api_key) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'MISSING_API_KEY',
            message: 'ShipEngine API key is not configured'
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Parse request body
    const { address }: { address: AddressInput } = await req.json()

    if (!address || !address.address_line1 || !address.city_locality ||
        !address.state_province || !address.postal_code) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Address is required with address_line1, city_locality, state_province, and postal_code'
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Call ShipEngine address validation API
    const shipEngineResponse = await fetch('https://api.shipengine.com/v1/addresses/validate', {
      method: 'POST',
      headers: {
        'API-Key': settings.shipengine_api_key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([
        {
          name: address.name || '',
          company_name: address.company_name || '',
          phone: address.phone || '',
          address_line1: address.address_line1,
          address_line2: address.address_line2 || '',
          city_locality: address.city_locality,
          state_province: address.state_province,
          postal_code: address.postal_code,
          country_code: address.country_code || 'US',
          address_residential_indicator: 'unknown'
        }
      ])
    })

    if (!shipEngineResponse.ok) {
      const errorBody = await shipEngineResponse.text()
      console.error('ShipEngine API error:', errorBody)

      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'SHIPENGINE_ERROR',
            message: `ShipEngine API error: ${shipEngineResponse.status}`,
            details: errorBody
          }
        }),
        {
          status: shipEngineResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const validationResults = await shipEngineResponse.json()
    const result = validationResults[0] // We only validate one address

    // Map ShipEngine status to our simplified status
    const status = result.status as 'verified' | 'unverified' | 'warning' | 'error'

    // Extract messages from the response
    const messages: string[] = []
    if (result.messages) {
      for (const msg of result.messages) {
        if (msg.message) {
          messages.push(msg.message)
        }
      }
    }

    // Build the validation result
    const validationResult: ValidationResult = {
      success: status === 'verified' || status === 'warning',
      status,
      original_address: address,
      messages
    }

    // Include matched/normalized address if available
    if (result.matched_address) {
      validationResult.matched_address = {
        name: result.matched_address.name || address.name,
        company_name: result.matched_address.company_name || address.company_name,
        phone: result.matched_address.phone || address.phone,
        address_line1: result.matched_address.address_line1,
        address_line2: result.matched_address.address_line2 || '',
        city_locality: result.matched_address.city_locality,
        state_province: result.matched_address.state_province,
        postal_code: result.matched_address.postal_code,
        country_code: result.matched_address.country_code || 'US'
      }

      // Check if it's residential
      if (result.matched_address.address_residential_indicator === 'yes') {
        validationResult.is_residential = true
      } else if (result.matched_address.address_residential_indicator === 'no') {
        validationResult.is_residential = false
      }
    }

    return new Response(
      JSON.stringify(validationResult),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Address validation error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || 'Address validation failed'
        }
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
