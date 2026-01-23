import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface TestConnectionRequest {
  client_id: string;
  client_secret: string;
  account_number: string;
  is_sandbox: boolean;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Only allow POST requests
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const body: TestConnectionRequest = await req.json();
    const { client_id, client_secret, account_number, is_sandbox } = body;

    // Validate required fields
    if (!client_id || !client_secret || !account_number) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: client_id, client_secret, and account_number are required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Determine the OAuth endpoint based on sandbox/production
    const oauthUrl = is_sandbox
      ? "https://wwwcie.ups.com/security/v1/oauth/token"
      : "https://onlinetools.ups.com/security/v1/oauth/token";

    // Create Basic Auth header with base64 encoded credentials
    const credentials = btoa(`${client_id}:${client_secret}`);

    // Make OAuth token request
    const tokenResponse = await fetch(oauthUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "x-merchant-id": account_number,
      },
      body: "grant_type=client_credentials",
    });

    if (tokenResponse.ok) {
      const tokenData = await tokenResponse.json();

      // Token was successfully obtained
      return new Response(
        JSON.stringify({
          success: true,
          message: "Connected successfully",
          details: {
            token_type: tokenData.token_type,
            expires_in: tokenData.expires_in,
            environment: is_sandbox ? "sandbox" : "production",
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } else {
      // Token request failed
      let errorMessage = "Authentication failed";

      try {
        const errorData = await tokenResponse.json();
        if (errorData.response?.errors?.[0]?.message) {
          errorMessage = errorData.response.errors[0].message;
        } else if (errorData.error_description) {
          errorMessage = errorData.error_description;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch {
        errorMessage = `HTTP ${tokenResponse.status}: ${tokenResponse.statusText}`;
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
        }),
        {
          status: 200, // Return 200 so frontend can handle the error gracefully
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
