/**
 * Definisi tipe skema PostgreSQL Supabase untuk Finora AI.
 * Seluruh kolom nominal uang direpresentasikan sebagai integer Rupiah (number).
 */

export interface ProfileRow {
  id: string;
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  currency_code: 'IDR';
  theme_preference: 'light' | 'dark' | 'system';
  locale: string;
  created_at: string;
  updated_at: string;
}

export interface AccountRow {
  id: string;
  user_id: string;
  name: string;
  type: 'cash' | 'bank' | 'ewallet' | 'investment' | 'other';
  currency_code: 'IDR';
  initial_balance: number;
  current_balance: number;
  color: string;
  icon: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface CategoryRow {
  id: string;
  user_id: string;
  name: string;
  type: 'income' | 'expense';
  color: string;
  icon: string;
  is_system: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface TransactionRow {
  id: string;
  user_id: string;
  account_id: string;
  destination_account_id: string | null;
  category_id: string | null;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  transaction_date: string;
  description: string;
  source:
    | 'manual'
    | 'ai_draft'
    | 'recurring'
    | 'debt_payment'
    | 'savings_contribution'
    | 'balance_adjustment';
  reference_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface BudgetRow {
  id: string;
  user_id: string;
  category_id: string | null;
  period_month: number;
  period_year: number;
  amount_limit: number;
  alert_threshold_percent: number;
  created_at: string;
  updated_at: string;
}

export interface SavingsGoalRow {
  id: string;
  user_id: string;
  account_id: string | null;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  status: 'active' | 'completed' | 'cancelled';
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface SavingsContributionRow {
  id: string;
  user_id: string;
  goal_id: string;
  account_id: string | null;
  amount: number;
  type: 'deposit' | 'withdraw';
  contribution_date: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface DebtRow {
  id: string;
  user_id: string;
  type: 'payable' | 'receivable';
  counterparty_name: string;
  principal_amount: number;
  remaining_amount: number;
  due_date: string | null;
  status: 'unpaid' | 'partial' | 'paid';
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface DebtPaymentRow {
  id: string;
  user_id: string;
  debt_id: string;
  transaction_id: string | null;
  amount: number;
  payment_date: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface RecurringTransactionRow {
  id: string;
  user_id: string;
  account_id: string | null;
  category_id: string | null;
  name: string;
  type: 'income' | 'expense';
  amount: number;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  next_due_date: string;
  last_executed_date: string | null;
  is_active: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreferenceRow {
  id: string;
  user_id: string;
  budget_alert_enabled: boolean;
  recurring_reminder_enabled: boolean;
  debt_reminder_enabled: boolean;
  weekly_summary_enabled: boolean;
  reminder_days_before: number;
  created_at: string;
  updated_at: string;
}

