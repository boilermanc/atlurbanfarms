import type { ShippingPackage } from '../admin/hooks/useShippingPackages';

export interface PackageCalculationInput {
  totalQuantity: number;
  weightPerItem: number; // pounds
  packages: ShippingPackage[];
}

export interface CalculatedPackage {
  package: ShippingPackage;
  itemCount: number;
  calculatedWeight: number; // empty_weight + items weight
  dimensions: {
    length: number;
    width: number;
    height: number;
    unit: 'inch';
  };
  weight: {
    value: number;
    unit: 'pound';
  };
}

export interface PackageCalculationResult {
  packages: CalculatedPackage[];
  totalPackages: number;
  totalWeight: number;
  summary: string; // e.g., "Ships in: 2 packages (1 Large + 1 Small)"
}

export function calculatePackages(input: PackageCalculationInput): PackageCalculationResult {
  const { totalQuantity, weightPerItem, packages: availablePackages } = input;

  const activePackages = availablePackages
    .filter(p => p.is_active)
    .sort((a, b) => b.max_quantity - a.max_quantity); // Sort by capacity descending

  if (activePackages.length === 0 || totalQuantity <= 0) {
    return {
      packages: [],
      totalPackages: 0,
      totalWeight: 0,
      summary: 'No package configuration available'
    };
  }

  const result: CalculatedPackage[] = [];
  let remainingQuantity = totalQuantity;

  // Helper to find best package for a quantity
  const findPackageForQuantity = (qty: number): ShippingPackage => {
    // First try to find exact fit
    const exactFit = activePackages.find(
      p => qty >= p.min_quantity && qty <= p.max_quantity
    );
    if (exactFit) return exactFit;

    // If quantity is larger than any package, use largest
    const largestPackage = activePackages[0];
    if (qty > largestPackage.max_quantity) return largestPackage;

    // Find smallest package that can fit the quantity
    const fittingPackage = [...activePackages]
      .reverse()
      .find(p => qty <= p.max_quantity);

    return fittingPackage || activePackages.find(p => p.is_default) || largestPackage;
  };

  // Calculate packages needed
  while (remainingQuantity > 0) {
    const pkg = findPackageForQuantity(remainingQuantity);
    const itemsInPackage = Math.min(remainingQuantity, pkg.max_quantity);
    const itemsWeight = itemsInPackage * weightPerItem;
    const totalWeight = pkg.empty_weight + itemsWeight;

    result.push({
      package: pkg,
      itemCount: itemsInPackage,
      calculatedWeight: totalWeight,
      dimensions: {
        length: pkg.length,
        width: pkg.width,
        height: pkg.height,
        unit: 'inch'
      },
      weight: {
        value: Math.round(totalWeight * 100) / 100,
        unit: 'pound'
      }
    });

    remainingQuantity -= itemsInPackage;
  }

  // Generate summary
  const totalPackages = result.length;
  const totalWeight = result.reduce((sum, p) => sum + p.calculatedWeight, 0);

  let summary: string;
  if (totalPackages === 1) {
    summary = `Ships in: 1 ${result[0].package.name}`;
  } else {
    const packageCounts = result.reduce((acc, p) => {
      acc[p.package.name] = (acc[p.package.name] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const parts = Object.entries(packageCounts)
      .map(([name, count]) => count > 1 ? `${count} ${name}` : name);

    summary = `Ships in: ${totalPackages} packages (${parts.join(' + ')})`;
  }

  return {
    packages: result,
    totalPackages,
    totalWeight: Math.round(totalWeight * 100) / 100,
    summary
  };
}
