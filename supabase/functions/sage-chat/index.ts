import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getIntegrationSettings } from '../_shared/settings.ts'

interface Message {
  role: 'user' | 'model'
  text: string
}

interface ChatRequest {
  history: Message[]
  userInput: string
}

const SYSTEM_INSTRUCTION = `You are Sage, the high-tech AI gardening assistant for ATL Urban Farms.
ATL Urban Farms sells premium live plant seedlings to home gardeners and schools.
Your vibe: Fresh, modern, trustworthy, and expert.
Key Information:
- We ship live plants Monday through Wednesday ONLY to ensure they don't get stuck in transit over the weekend.
- We focus on seedlings (young plants), not seeds.
- You help customers choose plants based on their sunlight, space, and experience level.
- Be concise but helpful. Use emojis occasionally (🌱, ✨, 🌿).
- When asked about shipping, emphasize the Mon-Wed schedule for plant health.
- If they want to buy, suggest checking out our Vegetables, Herbs, or Flowers categories.`

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

    // Get Gemini settings from database
    const settings = await getIntegrationSettings(supabaseClient, [
      'gemini_enabled',
      'gemini_api_key'
    ])

    if (!settings.gemini_enabled || !settings.gemini_api_key) {
      return new Response(
        JSON.stringify({
          error: 'Sage is not configured',
          response: "Sage is coming soon! 🌱 In the meantime, check our FAQ above or email us at support@atlurbanfarms.com — we're happy to help!",
          disabled: true
        }),
        {
          status: 200, // Return 200 with error message for graceful handling
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const { history, userInput }: ChatRequest = await req.json()

    if (!userInput) {
      return new Response(
        JSON.stringify({ error: 'No input provided' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Format conversation history for Gemini API
    const contents = history.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }]
    }))

    // Add current user message
    contents.push({
      role: 'user',
      parts: [{ text: userInput }]
    })

    // Call Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${settings.gemini_api_key}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents,
          systemInstruction: {
            parts: [{ text: SYSTEM_INSTRUCTION }]
          },
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024
          }
        })
      }
    )

    if (!response.ok) {
      const error = await response.json()
      console.error('Gemini API error:', error)
      throw new Error(error.error?.message || 'Failed to get response from Sage')
    }

    const data = await response.json()

    // Extract text from response
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "I'm having a little trouble connecting to my roots. Try asking again? 🌱"

    return new Response(
      JSON.stringify({ response: responseText }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Sage chat error:', error)
    return new Response(
      JSON.stringify({
        error: error.message,
        response: "Oops, Sage ran into an issue! Please try again, or email us at support@atlurbanfarms.com for help. 🌿"
      }),
      {
        status: 200, // Return 200 with fallback message
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
