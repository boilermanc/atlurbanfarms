/**
 * Tax calculation utility — single source of truth for all tax logic.
 * Pure function, no React dependencies.
 */

export interface TaxConfig {
  taxEnabled: boolean;
  defaultTaxRate: number;   // e.g. 0.07
  nexusStates: string[];    // e.g. ["GA"]
  taxLabel: string;         // e.g. "Sales Tax"
}

export interface TaxResult {
  taxRate: number;
  taxAmount: number;
  taxLabel: string;   // Display label for UI (e.g. "Sales Tax (7%)")
  taxNote: string;    // Stored on order for audit (e.g. "GA 7%")
  isTaxable: boolean;
}

export const DEFAULT_TAX_CONFIG: TaxConfig = {
  taxEnabled: true,
  defaultTaxRate: 0.07,
  nexusStates: ['GA'],
  taxLabel: 'Sales Tax',
};

export function calculateTax(params: {
  subtotal: number;
  shippingState: string;
  isTaxExempt?: boolean;
  taxExemptReason?: string;
  config?: TaxConfig;
}): TaxResult {
  const config = params.config || DEFAULT_TAX_CONFIG;

  // Tax disabled globally
  if (!config.taxEnabled) {
    return {
      taxRate: 0,
      taxAmount: 0,
      taxLabel: 'Tax',
      taxNote: 'Tax disabled',
      isTaxable: false,
    };
  }

  // Customer is tax-exempt
  if (params.isTaxExempt) {
    const reason = params.taxExemptReason || 'Tax-exempt';
    return {
      taxRate: 0,
      taxAmount: 0,
      taxLabel: 'Tax-exempt',
      taxNote: `Tax-exempt: ${reason}`,
      isTaxable: false,
    };
  }

  // Check nexus
  const stateUpper = (params.shippingState || '').toUpperCase().trim();
  const isNexusState = config.nexusStates.some(s => s.toUpperCase() === stateUpper);

  if (!isNexusState) {
    return {
      taxRate: 0,
      taxAmount: 0,
      taxLabel: stateUpper ? 'No tax (out of state)' : 'Tax',
      taxNote: stateUpper ? `Out of state (${stateUpper})` : 'No state provided',
      isTaxable: false,
    };
  }

  // Taxable — in nexus state
  const rate = config.defaultTaxRate;
  const amount = Math.round(params.subtotal * rate * 100) / 100;
  const pctLabel = `${(rate * 100).toFixed(0)}%`;

  return {
    taxRate: rate,
    taxAmount: amount,
    taxLabel: `${config.taxLabel} (${pctLabel})`,
    taxNote: `${stateUpper} ${pctLabel}`,
    isTaxable: true,
  };
}
