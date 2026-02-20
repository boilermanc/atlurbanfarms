import { useSetting } from '../admin/hooks/useSettings';
import { TaxConfig, DEFAULT_TAX_CONFIG } from '../lib/tax';

/**
 * Fetches tax configuration from config_settings and returns a TaxConfig object.
 * Falls back to DEFAULT_TAX_CONFIG values when settings haven't loaded yet.
 */
export function useTaxConfig(): { taxConfig: TaxConfig; loading: boolean } {
  const { value: taxEnabled, loading: l1 } = useSetting('tax', 'tax_enabled');
  const { value: defaultTaxRate, loading: l2 } = useSetting('tax', 'default_tax_rate');
  const { value: nexusStates, loading: l3 } = useSetting('tax', 'nexus_states');
  const { value: taxLabel, loading: l4 } = useSetting('tax', 'tax_label');

  const loading = l1 || l2 || l3 || l4;

  const taxConfig: TaxConfig = {
    taxEnabled: taxEnabled ?? DEFAULT_TAX_CONFIG.taxEnabled,
    defaultTaxRate: defaultTaxRate ?? DEFAULT_TAX_CONFIG.defaultTaxRate,
    nexusStates: nexusStates ?? DEFAULT_TAX_CONFIG.nexusStates,
    taxLabel: taxLabel ?? DEFAULT_TAX_CONFIG.taxLabel,
  };

  return { taxConfig, loading };
}
