import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// UPS Service Code to Name mapping
const UPS_SERVICE_NAMES: Record<string, string> = {
  "01": "UPS Next Day Air",
  "02": "UPS 2nd Day Air",
  "03": "UPS Ground",
  "07": "UPS Express",
  "08": "UPS Expedited",
  "11": "UPS Standard",
  "12": "UPS 3 Day Select",
  "13": "UPS Next Day Air Saver",
  "14": "UPS Next Day Air Early",
  "54": "UPS Express Plus",
  "59": "UPS 2nd Day Air A.M.",
  "65": "UPS Saver",
  "82": "UPS Today Standard",
  "83": "UPS Today Dedicated Courier",
  "84": "UPS Today Intercity",
  "85": "UPS Today Express",
  "86": "UPS Today Express Saver",
  "96": "UPS Worldwide Express Freight",
};

// Services that are typically guaranteed
const GUARANTEED_SERVICES = ["01", "02", "13", "14", "54", "59"];

interface Address {
  name: string;
  company_name?: string;
  address_line1: string;
  address_line2?: string;
  city_locality: string;
  state_province: string;
  postal_code: string;
  country_code: string;
  phone?: string;
}

interface PackageWeight {
  value: number;
  unit: string; // "pound" or "kilogram"
}

interface PackageDimensions {
  length: number;
  width: number;
  height: number;
  unit: string; // "inch" or "centimeter"
}

interface Package {
  weight: PackageWeight;
  dimensions?: PackageDimensions;
}

interface Credentials {
  client_id: string;
  client_secret: string;
  account_number: string;
}

interface GetRatesRequest {
  ship_from: Address;
  ship_to: Address;
  packages: Package[];
  credentials: Credentials;
  is_sandbox: boolean;
  allowed_service_codes?: string[];
}

interface NormalizedRate {
  rate_id: string;
  carrier_source: string;
  carrier_code: string;
  carrier_name: string;
  service_code: string;
  service_name: string;
  base_amount: number;
  currency: string;
  transit_days: number | null;
  estimated_delivery_date: string | null;
  is_guaranteed: boolean;
}

async function getOAuthToken(
  clientId: string,
  clientSecret: string,
  accountNumber: string,
  isSandbox: boolean
): Promise<{ success: true; token: string } | { success: false; error: string }> {
  const oauthUrl = isSandbox
    ? "https://wwwcie.ups.com/security/v1/oauth/token"
    : "https://onlinetools.ups.com/security/v1/oauth/token";

  const credentials = btoa(`${clientId}:${clientSecret}`);

  try {
    const response = await fetch(oauthUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "x-merchant-id": accountNumber,
      },
      body: "grant_type=client_credentials",
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, token: data.access_token };
    } else {
      let errorMessage = "Authentication failed";
      try {
        const errorData = await response.json();
        if (errorData.response?.errors?.[0]?.message) {
          errorMessage = errorData.response.errors[0].message;
        } else if (errorData.error_description) {
          errorMessage = errorData.error_description;
        }
      } catch {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }
      return { success: false, error: errorMessage };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Token request failed",
    };
  }
}

function buildUPSAddress(address: Address, includePhone = false) {
  const upsAddress: Record<string, unknown> = {
    Name: address.name,
    Address: {
      AddressLine: [address.address_line1],
      City: address.city_locality,
      StateProvinceCode: address.state_province,
      PostalCode: address.postal_code,
      CountryCode: address.country_code,
    },
  };

  if (address.company_name) {
    upsAddress.AttentionName = address.name;
    upsAddress.Name = address.company_name;
  }

  if (address.address_line2) {
    (upsAddress.Address as Record<string, unknown>).AddressLine = [
      address.address_line1,
      address.address_line2,
    ];
  }

  if (includePhone && address.phone) {
    upsAddress.Phone = { Number: address.phone };
  }

  return upsAddress;
}

function buildUPSPackages(packages: Package[]) {
  return packages.map((pkg) => {
    const upsPackage: Record<string, unknown> = {
      PackagingType: {
        Code: "02", // Customer Supplied Package
        Description: "Package",
      },
      PackageWeight: {
        UnitOfMeasurement: {
          Code: pkg.weight.unit === "kilogram" ? "KGS" : "LBS",
          Description: pkg.weight.unit === "kilogram" ? "Kilograms" : "Pounds",
        },
        Weight: pkg.weight.value.toString(),
      },
    };

    if (pkg.dimensions) {
      upsPackage.Dimensions = {
        UnitOfMeasurement: {
          Code: pkg.dimensions.unit === "centimeter" ? "CM" : "IN",
          Description: pkg.dimensions.unit === "centimeter" ? "Centimeters" : "Inches",
        },
        Length: pkg.dimensions.length.toString(),
        Width: pkg.dimensions.width.toString(),
        Height: pkg.dimensions.height.toString(),
      };
    }

    return upsPackage;
  });
}

function parseEstimatedDeliveryDate(ratedShipment: Record<string, unknown>): string | null {
  // Try to get from GuaranteedDelivery
  const guaranteed = ratedShipment.GuaranteedDelivery as Record<string, unknown> | undefined;
  if (guaranteed?.DeliveryByTime) {
    // UPS returns date in format like "2026-01-27"
    return guaranteed.DeliveryByTime as string;
  }

  // Try TimeInTransit if available
  const timeInTransit = ratedShipment.TimeInTransit as Record<string, unknown> | undefined;
  if (timeInTransit?.ServiceSummary) {
    const serviceSummary = timeInTransit.ServiceSummary as Record<string, unknown>;
    const estimatedArrival = serviceSummary.EstimatedArrival as Record<string, unknown> | undefined;
    if (estimatedArrival?.Arrival?.Date) {
      return estimatedArrival.Arrival.Date as string;
    }
  }

  return null;
}

function parseTransitDays(ratedShipment: Record<string, unknown>): number | null {
  // Try GuaranteedDelivery first
  const guaranteed = ratedShipment.GuaranteedDelivery as Record<string, unknown> | undefined;
  if (guaranteed?.BusinessDaysInTransit) {
    return parseInt(guaranteed.BusinessDaysInTransit as string, 10);
  }

  // Try TimeInTransit
  const timeInTransit = ratedShipment.TimeInTransit as Record<string, unknown> | undefined;
  if (timeInTransit?.ServiceSummary) {
    const serviceSummary = timeInTransit.ServiceSummary as Record<string, unknown>;
    const estimatedArrival = serviceSummary.EstimatedArrival as Record<string, unknown> | undefined;
    if (estimatedArrival?.BusinessDaysInTransit) {
      return parseInt(estimatedArrival.BusinessDaysInTransit as string, 10);
    }
  }

  return null;
}

function normalizeRates(
  ratedShipments: Record<string, unknown>[],
  allowedServiceCodes?: string[]
): NormalizedRate[] {
  const timestamp = Date.now();
  const rates: NormalizedRate[] = [];

  for (const shipment of ratedShipments) {
    const service = shipment.Service as Record<string, unknown>;
    const serviceCode = service?.Code as string;

    // Filter by allowed service codes if provided
    if (allowedServiceCodes && allowedServiceCodes.length > 0) {
      if (!allowedServiceCodes.includes(serviceCode)) {
        continue;
      }
    }

    const totalCharges = shipment.TotalCharges as Record<string, unknown>;
    const monetaryValue = parseFloat(totalCharges?.MonetaryValue as string || "0");
    const currency = (totalCharges?.CurrencyCode as string) || "USD";

    const serviceName = UPS_SERVICE_NAMES[serviceCode] || `UPS Service ${serviceCode}`;
    const isGuaranteed = GUARANTEED_SERVICES.includes(serviceCode);

    rates.push({
      rate_id: `ups-${serviceCode}-${timestamp}`,
      carrier_source: "ups_direct",
      carrier_code: "ups",
      carrier_name: "UPS",
      service_code: serviceCode,
      service_name: serviceName,
      base_amount: monetaryValue,
      currency: currency,
      transit_days: parseTransitDays(shipment),
      estimated_delivery_date: parseEstimatedDeliveryDate(shipment),
      is_guaranteed: isGuaranteed,
    });
  }

  // Sort by price
  rates.sort((a, b) => a.base_amount - b.base_amount);

  return rates;
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
    const body: GetRatesRequest = await req.json();
    const {
      ship_from,
      ship_to,
      packages,
      credentials,
      is_sandbox,
      allowed_service_codes,
    } = body;

    // Validate required fields
    if (!ship_from || !ship_to || !packages || !credentials) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: ship_from, ship_to, packages, and credentials are required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!packages.length) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "At least one package is required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get OAuth token
    const tokenResult = await getOAuthToken(
      credentials.client_id,
      credentials.client_secret,
      credentials.account_number,
      is_sandbox
    );

    if (!tokenResult.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Authentication failed: ${tokenResult.error}`,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Build UPS Rate Request
    const rateRequest = {
      RateRequest: {
        Request: {
          SubVersion: "2403",
          TransactionReference: {
            CustomerContext: `ATLUrbanFarms-${Date.now()}`,
          },
        },
        Shipment: {
          Shipper: {
            Name: ship_from.company_name || ship_from.name,
            ShipperNumber: credentials.account_number,
            Address: {
              AddressLine: [ship_from.address_line1],
              City: ship_from.city_locality,
              StateProvinceCode: ship_from.state_province,
              PostalCode: ship_from.postal_code,
              CountryCode: ship_from.country_code,
            },
          },
          ShipTo: buildUPSAddress(ship_to),
          ShipFrom: buildUPSAddress(ship_from),
          Package: buildUPSPackages(packages),
          ShipmentRatingOptions: {
            NegotiatedRatesIndicator: "",
            RateChartIndicator: "",
          },
        },
      },
    };

    // Add address line 2 if provided
    if (ship_from.address_line2) {
      rateRequest.RateRequest.Shipment.Shipper.Address.AddressLine = [
        ship_from.address_line1,
        ship_from.address_line2,
      ];
    }

    // Call UPS Rating API
    const ratingUrl = is_sandbox
      ? "https://wwwcie.ups.com/api/rating/v2403/Shop"
      : "https://onlinetools.ups.com/api/rating/v2403/Shop";

    const transactionId = crypto.randomUUID();

    const ratingResponse = await fetch(ratingUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${tokenResult.token}`,
        "Content-Type": "application/json",
        "transId": transactionId,
        "transactionSrc": "ATLUrbanFarms",
      },
      body: JSON.stringify(rateRequest),
    });

    const responseData = await ratingResponse.json();

    if (!ratingResponse.ok) {
      let errorMessage = "Rating request failed";

      if (responseData.response?.errors?.[0]?.message) {
        errorMessage = responseData.response.errors[0].message;
      } else if (responseData.fault?.detail?.Errors?.ErrorDetail?.PrimaryErrorCode?.Description) {
        errorMessage = responseData.fault.detail.Errors.ErrorDetail.PrimaryErrorCode.Description;
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse rated shipments
    const rateResponse = responseData.RateResponse;
    if (!rateResponse?.RatedShipment) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "No rates returned from UPS",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Normalize the RatedShipment to always be an array
    const ratedShipments = Array.isArray(rateResponse.RatedShipment)
      ? rateResponse.RatedShipment
      : [rateResponse.RatedShipment];

    // Normalize and filter rates
    const normalizedRates = normalizeRates(ratedShipments, allowed_service_codes);

    return new Response(
      JSON.stringify({
        success: true,
        rates: normalizedRates,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
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
