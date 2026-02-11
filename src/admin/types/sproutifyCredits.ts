export type CreditLogAction = 'check' | 'redeem' | 'grant'
export type CreditLogStatus = 'success' | 'failed'

export interface CreditLogEntry {
  id: string
  action: CreditLogAction
  customer_email: string
  credit_amount: number
  credit_id: string | null
  order_id: string | null
  order_number: string | null
  performed_by: string | null
  status: CreditLogStatus
  notes: string | null
  sproutify_response: Record<string, any> | null
  created_at: string
}

export interface CreditLogFilters {
  action?: 'all' | CreditLogAction
  search?: string
  page?: number
  perPage?: number
}

export interface CreditStats {
  totalRedeemed: number
  totalSavings: number
  uniqueCustomers: number
  totalGranted: number
}

export interface SproutifyCreditStatus {
  hasCredit: boolean
  creditAmount: number
  creditId: string | null
  isLifetime: boolean
}

export const ACTION_CONFIG: Record<CreditLogAction, { label: string; color: string; borderColor: string }> = {
  check: {
    label: 'Check',
    color: 'bg-blue-50 text-blue-700',
    borderColor: 'border-blue-200',
  },
  redeem: {
    label: 'Redeem',
    color: 'bg-emerald-50 text-emerald-700',
    borderColor: 'border-emerald-200',
  },
  grant: {
    label: 'Grant',
    color: 'bg-purple-50 text-purple-700',
    borderColor: 'border-purple-200',
  },
}

export const STATUS_CONFIG: Record<CreditLogStatus, { label: string; color: string }> = {
  success: {
    label: 'Success',
    color: 'bg-emerald-50 text-emerald-700',
  },
  failed: {
    label: 'Failed',
    color: 'bg-red-50 text-red-700',
  },
}
