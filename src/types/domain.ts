/**
 * Definisi tipe domain inti Finora AI (Strict TypeScript).
 * Seluruh nominal uang (`amount`, `balance`, `limit`, dll.) direpresentasikan
 * sebagai integer dalam satuan Rupiah (IDR).
 */

export type ThemePreference = 'light' | 'dark' | 'system';

export type AccountType = 'cash' | 'bank' | 'ewallet' | 'investment' | 'other';
export type WalletType = AccountType;

export type CategoryType = 'income' | 'expense';

export type TransactionType = 'income' | 'expense' | 'transfer';

export type TransactionSource =
  | 'manual'
  | 'ai_draft'
  | 'recurring'
  | 'debt_payment'
  | 'savings_contribution'
  | 'balance_adjustment';

export type DebtType = 'payable' | 'receivable';

export type DebtStatus = 'unpaid' | 'partial' | 'paid';

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Profile {
  id: string;
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  currencyCode: 'IDR';
  themePreference: ThemePreference;
  locale: string;
  createdAt: string;
  updatedAt: string;
}

export interface Account {
  id: string;
  userId: string;
  name: string;
  type: AccountType;
  currencyCode: 'IDR';
  initialBalance: number;
  currentBalance: number;
  color: string;
  icon: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export type Wallet = Account;

export interface Category {
  id: string;
  userId: string;
  name: string;
  type: CategoryType;
  color: string;
  icon: string;
  isSystem: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  userId: string;
  accountId: string;
  destinationAccountId: string | null;
  categoryId: string | null;
  type: TransactionType;
  amount: number;
  transactionDate: string;
  description: string;
  source: TransactionSource;
  referenceId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Budget {
  id: string;
  userId: string;
  categoryId: string | null;
  periodMonth: number;
  periodYear: number;
  amountLimit: number;
  alertThresholdPercent: number;
  createdAt: string;
  updatedAt: string;
}

export interface SavingsGoal {
  id: string;
  userId: string;
  accountId: string | null;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string | null;
  status: 'active' | 'completed' | 'cancelled';
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavingsContribution {
  id: string;
  userId: string;
  goalId: string;
  accountId: string | null;
  amount: number;
  type: 'deposit' | 'withdraw';
  contributionDate: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface DebtRecord {
  id: string;
  userId: string;
  type: DebtType;
  counterpartyName: string;
  principalAmount: number;
  remainingAmount: number;
  dueDate: string | null;
  status: DebtStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface DebtPayment {
  id: string;
  userId: string;
  debtId: string;
  transactionId: string | null;
  amount: number;
  paymentDate: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringTransaction {
  id: string;
  userId: string;
  accountId: string | null;
  categoryId: string | null;
  name: string;
  type: CategoryType;
  amount: number;
  frequency: RecurringFrequency;
  nextDueDate: string;
  lastExecutedDate: string | null;
  isActive: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type RecurringBill = RecurringTransaction;

export interface NotificationPreferences {
  id: string;
  userId: string;
  budgetAlertEnabled: boolean;
  recurringReminderEnabled: boolean;
  debtReminderEnabled: boolean;
  weeklySummaryEnabled: boolean;
  reminderDaysBefore: number;
  createdAt: string;
  updatedAt: string;
}

export interface AITransactionDraft {
  id: string;
  type: TransactionType;
  amount: number;
  accountId: string | null;
  destinationAccountId: string | null;
  categoryId: string | null;
  transactionDate: string;
  description: string;
  confidenceNote?: string;
}

export type AppErrorCode =
  | 'VALIDATION_ERROR'
  | 'AUTH_ERROR'
  | 'DATABASE_CONSTRAINT_ERROR'
  | 'AI_PROVIDER_UNCONFIGURED'
  | 'AI_PROVIDER_UNAVAILABLE'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';

export interface AppError {
  code: AppErrorCode;
  message: string;
  details?: string;
}
