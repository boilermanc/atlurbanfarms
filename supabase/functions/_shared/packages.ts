/**
 * Shared package calculation logic for shipping functions.
 *
 * Both shipengine-get-rates and shipengine-create-label must use the same
 * multi-package splitting algorithm so the rate quoted at checkout matches
 * the label created later.  See GitHub issue #23 for the bug this fixes.
 */

// Standard weight per seedling based on WooCommerce historical data
export const SEEDLING_WEIGHT_OZ = 1.92
export const SEEDLING_WEIGHT_LBS = SEEDLING_WEIGHT_OZ / 16  // ~0.12 lbs

export interface PackageDetails {
  weight: {
    value: number
    unit: 'pound' | 'ounce' | 'gram' | 'kilogram'
  }
  dimensions?: {
    length: number
    width: number
    height: number
    unit: 'inch' | 'centimeter'
  }
}

export interface ShippingPackageConfig {
  id: string
  name: string
  length: number
  width: number
  height: number
  empty_weight: number
  min_quantity: number
  max_quantity: number
  is_default: boolean
}

export interface CalculatedPackageInfo {
  packages: PackageDetails[]
  breakdown: Array<{
    name: string
    dimensions: PackageDetails['dimensions']
    weight: PackageDetails['weight']
    item_count: number
  }>
  summary: string
}

/**
 * Fetch active shipping package configs from the database and coerce
 * numeric columns (Supabase can return decimal/numeric as strings).
 */
export async function getShippingPackageConfigs(supabaseClient: any): Promise<ShippingPackageConfig[]> {
  const { data, error } = await supabaseClient
    .from('shipping_packages')
    .select('*')
    .eq('is_active', true)
    .order('min_quantity', { ascending: true })

  if (error || !data) {
    console.error('Error fetching shipping packages:', error)
    return []
  }

  return data.map((row: any) => ({
    id: row.id,
    name: row.name,
    length: Number(row.length),
    width: Number(row.width),
    height: Number(row.height),
    empty_weight: Number(row.empty_weight),
    min_quantity: Number(row.min_quantity),
    max_quantity: Number(row.max_quantity),
    is_default: !!row.is_default,
  }))
}

/**
 * Calculate packages needed for an order based on total seedling quantity.
 *
 * Splits large orders across multiple boxes using a greedy algorithm:
 * fill the largest fitting box, then repeat for the remainder.
 */
export function calculateOrderPackages(
  totalQuantity: number,
  weightPerItem: number,
  packageConfigs: ShippingPackageConfig[]
): CalculatedPackageInfo {
  if (packageConfigs.length === 0 || totalQuantity <= 0) {
    return {
      packages: [],
      breakdown: [],
      summary: 'No package configuration available'
    }
  }

  const sortedConfigs = [...packageConfigs].sort((a, b) => b.max_quantity - a.max_quantity)
  const largest = sortedConfigs[0]
  const packages: PackageDetails[] = []
  const breakdown: CalculatedPackageInfo['breakdown'] = []
  let remaining = totalQuantity

  const findPackage = (qty: number): ShippingPackageConfig => {
    // Find ALL configs where qty falls within [min, max] range
    const fits = packageConfigs.filter(p => qty >= p.min_quantity && qty <= p.max_quantity)
    if (fits.length > 0) {
      // Prefer the best fit: smallest max_quantity that still contains qty
      fits.sort((a, b) => a.max_quantity - b.max_quantity)
      const bestFit = fits.find(p => p.max_quantity >= qty) || fits[fits.length - 1]
      return bestFit
    }

    // If quantity is larger than any package, use largest
    if (qty > largest.max_quantity) return largest

    // Find smallest package that can fit
    const fitting = [...sortedConfigs].reverse().find(p => qty <= p.max_quantity)
    return fitting || packageConfigs.find(p => p.is_default) || largest
  }

  while (remaining > 0) {
    const pkg = findPackage(remaining)
    const itemsInPackage = Math.min(remaining, pkg.max_quantity)
    const totalWeight = Number(pkg.empty_weight) + (itemsInPackage * weightPerItem)

    packages.push({
      weight: {
        value: Math.round(totalWeight * 100) / 100,
        unit: 'pound'
      },
      dimensions: {
        length: pkg.length,
        width: pkg.width,
        height: pkg.height,
        unit: 'inch'
      }
    })

    breakdown.push({
      name: pkg.name,
      dimensions: {
        length: pkg.length,
        width: pkg.width,
        height: pkg.height,
        unit: 'inch'
      },
      weight: {
        value: Math.round(totalWeight * 100) / 100,
        unit: 'pound'
      },
      item_count: itemsInPackage
    })

    remaining -= itemsInPackage
  }

  // Generate summary (always include item count for transparency)
  const totalItems = breakdown.reduce((sum, b) => sum + b.item_count, 0)
  let summary: string
  if (packages.length === 1) {
    summary = `Ships in: 1 ${breakdown[0].name} (${totalItems} items)`
  } else {
    const counts = breakdown.reduce((acc, p) => {
      acc[p.name] = (acc[p.name] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const parts = Object.entries(counts)
      .map(([name, count]) => count > 1 ? `${count} ${name}` : name)

    summary = `Ships in: ${packages.length} packages (${parts.join(' + ')}) — ${totalItems} items`
  }

  console.log('[calculateOrderPackages] Result:', JSON.stringify({
    totalQuantity,
    weightPerItem,
    configCount: packageConfigs.length,
    configs: packageConfigs.map(c => `${c.name}(${c.min_quantity}-${c.max_quantity})`),
    result: breakdown.map(b => `${b.name}:${b.item_count}`),
    summary
  }))

  return { packages, breakdown, summary }
}

/**
 * Calculate total seedling count from order items, accounting for bundles.
 *
 * Each order_item has a `quantity` (cart qty) and optionally a
 * `seedlings_per_unit` from the linked product (e.g. 20 for a
 * "20 Seedling Variety Pack").  The true seedling count is
 * quantity × seedlings_per_unit.
 */
export function calculateTotalSeedlings(
  orderItems: Array<{ quantity: number; seedlings_per_unit?: number | null }>
): number {
  return orderItems.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0
    const spu = Number(item.seedlings_per_unit) || 1
    return sum + (qty * spu)
  }, 0)
}
