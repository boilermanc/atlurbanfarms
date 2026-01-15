// Inventory Types for Admin Panel

export type BatchStatus = 'planned' | 'seeded' | 'growing' | 'available' | 'depleted';

export type AdjustmentType = 'loss' | 'damage' | 'correction' | 'count' | 'return';

export type ReasonCode =
  | 'spoilage'
  | 'pest_damage'
  | 'weather_damage'
  | 'quality_issue'
  | 'customer_return'
  | 'inventory_count'
  | 'data_correction'
  | 'other';

export interface ProductInventorySummary {
  product_id: string;
  product_name: string;
  category: string;
  total_available: number;
  total_allocated: number;
  total_sold: number;
  batch_count: number;
  low_stock_threshold: number;
  is_low_stock: boolean;
}

export interface InventoryBatch {
  id: string;
  batch_number: string;
  product_id: string;
  product_name?: string;
  status: BatchStatus;
  quantity_seeded: number;
  quantity_expected: number;
  quantity_actual: number;
  quantity_available: number;
  quantity_allocated: number;
  planned_date: string | null;
  seeded_date: string | null;
  ready_date: string | null;
  expiry_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryAdjustment {
  id: string;
  batch_id: string;
  batch_number?: string;
  product_name?: string;
  adjustment_type: AdjustmentType;
  quantity: number;
  reason_code: ReasonCode;
  notes: string | null;
  adjusted_by: string;
  adjusted_by_name?: string;
  created_at: string;
}

export interface BatchFormData {
  product_id: string;
  batch_number: string;
  status: BatchStatus;
  quantity_seeded: number;
  quantity_expected: number;
  quantity_actual: number;
  planned_date: string;
  seeded_date: string;
  ready_date: string;
  expiry_date: string;
  notes: string;
}

export interface AdjustmentFormData {
  batch_id: string;
  adjustment_type: AdjustmentType;
  quantity: number;
  reason_code: ReasonCode;
  notes: string;
}

// Status badge configurations
export const BATCH_STATUS_CONFIG: Record<BatchStatus, { label: string; color: string }> = {
  planned: { label: 'Planned', color: 'bg-slate-500' },
  seeded: { label: 'Seeded', color: 'bg-blue-500' },
  growing: { label: 'Growing', color: 'bg-yellow-500' },
  available: { label: 'Available', color: 'bg-emerald-500' },
  depleted: { label: 'Depleted', color: 'bg-red-500' },
};

export const ADJUSTMENT_TYPE_CONFIG: Record<AdjustmentType, { label: string; color: string }> = {
  loss: { label: 'Loss', color: 'text-red-400' },
  damage: { label: 'Damage', color: 'text-orange-400' },
  correction: { label: 'Correction', color: 'text-blue-400' },
  count: { label: 'Count', color: 'text-purple-400' },
  return: { label: 'Return', color: 'text-emerald-400' },
};

export const REASON_CODE_OPTIONS: { value: ReasonCode; label: string }[] = [
  { value: 'spoilage', label: 'Spoilage' },
  { value: 'pest_damage', label: 'Pest Damage' },
  { value: 'weather_damage', label: 'Weather Damage' },
  { value: 'quality_issue', label: 'Quality Issue' },
  { value: 'customer_return', label: 'Customer Return' },
  { value: 'inventory_count', label: 'Inventory Count' },
  { value: 'data_correction', label: 'Data Correction' },
  { value: 'other', label: 'Other' },
];
