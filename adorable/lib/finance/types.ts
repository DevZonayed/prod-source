export type AccountType = 'checking' | 'savings' | 'credit' | 'investment' | 'cash' | 'crypto';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: string;
  color: string;
  icon: string;
  creditLimit?: number;
  isArchived?: boolean;
  createdAt: string;
}

export type TransactionType = 'income' | 'expense' | 'transfer';

export interface Transaction {
  id: string;
  accountId: string;
  toAccountId?: string;
  type: TransactionType;
  amount: number;
  category: string;
  subcategory?: string;
  description: string;
  date: string;
  tags: string[];
  notes?: string;
  isRecurring?: boolean;
  billId?: string;
}

export interface Budget {
  id: string;
  category: string;
  amount: number;
  period: 'monthly' | 'weekly' | 'yearly';
  color: string;
  icon: string;
}

export interface Goal {
  id: string;
  name: string;
  description?: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  category: 'emergency' | 'vacation' | 'purchase' | 'retirement' | 'education' | 'home' | 'other';
  color: string;
  icon: string;
  isCompleted: boolean;
  createdAt: string;
}

export type BillFrequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface Bill {
  id: string;
  name: string;
  amount: number;
  frequency: BillFrequency;
  dueDay: number;
  category: string;
  color: string;
  icon: string;
  isAutoPay: boolean;
  notes?: string;
  nextDueDate: string;
  lastPaidDate?: string;
  payments: { date: string; amount: number }[];
}

export const EXPENSE_CATEGORIES = [
  { name: 'Housing', icon: '🏠', color: '#6366f1' },
  { name: 'Food & Dining', icon: '🍔', color: '#f59e0b' },
  { name: 'Transportation', icon: '🚗', color: '#10b981' },
  { name: 'Shopping', icon: '🛍️', color: '#ec4899' },
  { name: 'Entertainment', icon: '🎬', color: '#8b5cf6' },
  { name: 'Health', icon: '⚕️', color: '#ef4444' },
  { name: 'Education', icon: '📚', color: '#3b82f6' },
  { name: 'Travel', icon: '✈️', color: '#06b6d4' },
  { name: 'Utilities', icon: '💡', color: '#84cc16' },
  { name: 'Insurance', icon: '🛡️', color: '#f97316' },
  { name: 'Subscriptions', icon: '📱', color: '#a855f7' },
  { name: 'Personal Care', icon: '💆', color: '#14b8a6' },
  { name: 'Gifts', icon: '🎁', color: '#fb923c' },
  { name: 'Taxes', icon: '🏛️', color: '#64748b' },
  { name: 'Investments', icon: '📈', color: '#22c55e' },
  { name: 'Other', icon: '💸', color: '#94a3b8' },
] as const;

export const INCOME_CATEGORIES = [
  { name: 'Salary', icon: '💼', color: '#22c55e' },
  { name: 'Freelance', icon: '💻', color: '#3b82f6' },
  { name: 'Business', icon: '🏢', color: '#f59e0b' },
  { name: 'Investments', icon: '📈', color: '#10b981' },
  { name: 'Rental', icon: '🏘️', color: '#8b5cf6' },
  { name: 'Bonus', icon: '🎯', color: '#ec4899' },
  { name: 'Gift', icon: '🎁', color: '#fb923c' },
  { name: 'Refund', icon: '↩️', color: '#06b6d4' },
  { name: 'Other', icon: '💰', color: '#94a3b8' },
] as const;

export const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

export function getCategoryInfo(name: string) {
  return ALL_CATEGORIES.find(c => c.name === name) ?? { name, icon: '💸', color: '#94a3b8' };
}
