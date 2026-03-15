'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Account, Transaction, Budget, Goal, Bill } from './types';
import { seedAccounts, seedTransactions, seedBudgets, seedGoals, seedBills } from './seed-data';

interface FinanceStore {
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  bills: Bill[];
  initialized: boolean;

  // Account actions
  addAccount: (account: Omit<Account, 'id' | 'createdAt'>) => void;
  updateAccount: (id: string, updates: Partial<Account>) => void;
  deleteAccount: (id: string) => void;

  // Transaction actions
  addTransaction: (tx: Omit<Transaction, 'id'>) => Transaction;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;

  // Budget actions
  addBudget: (budget: Omit<Budget, 'id'>) => void;
  updateBudget: (id: string, updates: Partial<Budget>) => void;
  deleteBudget: (id: string) => void;

  // Goal actions
  addGoal: (goal: Omit<Goal, 'id' | 'createdAt'>) => void;
  updateGoal: (id: string, updates: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;

  // Bill actions
  addBill: (bill: Omit<Bill, 'id' | 'payments'>) => void;
  updateBill: (id: string, updates: Partial<Bill>) => void;
  deleteBill: (id: string) => void;
  markBillPaid: (id: string, amount?: number) => void;

  // Utility
  resetToSeedData: () => void;
}

function generateId(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export const useFinanceStore = create<FinanceStore>()(
  persist(
    (set, get) => ({
      accounts: seedAccounts,
      transactions: seedTransactions,
      budgets: seedBudgets,
      goals: seedGoals,
      bills: seedBills,
      initialized: true,

      addAccount: (account) => {
        const newAccount: Account = {
          ...account,
          id: generateId('acc'),
          createdAt: new Date().toISOString().split('T')[0],
        };
        set((s) => ({ accounts: [...s.accounts, newAccount] }));
      },

      updateAccount: (id, updates) => {
        set((s) => ({
          accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...updates } : a)),
        }));
      },

      deleteAccount: (id) => {
        set((s) => ({
          accounts: s.accounts.filter((a) => a.id !== id),
          transactions: s.transactions.filter((t) => t.accountId !== id),
        }));
      },

      addTransaction: (tx) => {
        const newTx: Transaction = { ...tx, id: generateId('tx') };
        // Update account balance
        set((s) => {
          const accounts = s.accounts.map((a) => {
            if (a.id === tx.accountId) {
              const delta = tx.type === 'income' ? tx.amount : -tx.amount;
              return { ...a, balance: a.balance + delta };
            }
            if (tx.toAccountId && a.id === tx.toAccountId) {
              return { ...a, balance: a.balance + tx.amount };
            }
            return a;
          });
          return { transactions: [newTx, ...s.transactions], accounts };
        });
        return newTx;
      },

      updateTransaction: (id, updates) => {
        set((s) => ({
          transactions: s.transactions.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        }));
      },

      deleteTransaction: (id) => {
        const tx = get().transactions.find((t) => t.id === id);
        if (!tx) return;
        set((s) => {
          const accounts = s.accounts.map((a) => {
            if (a.id === tx.accountId) {
              const delta = tx.type === 'income' ? -tx.amount : tx.amount;
              return { ...a, balance: a.balance + delta };
            }
            if (tx.toAccountId && a.id === tx.toAccountId) {
              return { ...a, balance: a.balance - tx.amount };
            }
            return a;
          });
          return { transactions: s.transactions.filter((t) => t.id !== id), accounts };
        });
      },

      addBudget: (budget) => {
        set((s) => ({ budgets: [...s.budgets, { ...budget, id: generateId('bud') }] }));
      },

      updateBudget: (id, updates) => {
        set((s) => ({ budgets: s.budgets.map((b) => (b.id === id ? { ...b, ...updates } : b)) }));
      },

      deleteBudget: (id) => {
        set((s) => ({ budgets: s.budgets.filter((b) => b.id !== id) }));
      },

      addGoal: (goal) => {
        const newGoal: Goal = {
          ...goal,
          id: generateId('goal'),
          createdAt: new Date().toISOString().split('T')[0],
        };
        set((s) => ({ goals: [...s.goals, newGoal] }));
      },

      updateGoal: (id, updates) => {
        set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, ...updates } : g)) }));
      },

      deleteGoal: (id) => {
        set((s) => ({ goals: s.goals.filter((g) => g.id !== id) }));
      },

      addBill: (bill) => {
        set((s) => ({ bills: [...s.bills, { ...bill, id: generateId('bill'), payments: [] }] }));
      },

      updateBill: (id, updates) => {
        set((s) => ({ bills: s.bills.map((b) => (b.id === id ? { ...b, ...updates } : b)) }));
      },

      deleteBill: (id) => {
        set((s) => ({ bills: s.bills.filter((b) => b.id !== id) }));
      },

      markBillPaid: (id, amount) => {
        const bill = get().bills.find((b) => b.id === id);
        if (!bill) return;
        const paidAmount = amount ?? bill.amount;
        const today = new Date().toISOString().split('T')[0];

        // Calculate next due date
        const next = new Date();
        if (bill.frequency === 'monthly') next.setMonth(next.getMonth() + 1);
        else if (bill.frequency === 'weekly') next.setDate(next.getDate() + 7);
        else if (bill.frequency === 'quarterly') next.setMonth(next.getMonth() + 3);
        else if (bill.frequency === 'yearly') next.setFullYear(next.getFullYear() + 1);

        set((s) => ({
          bills: s.bills.map((b) =>
            b.id === id
              ? {
                  ...b,
                  lastPaidDate: today,
                  nextDueDate: next.toISOString().split('T')[0],
                  payments: [{ date: today, amount: paidAmount }, ...b.payments],
                }
              : b,
          ),
        }));
      },

      resetToSeedData: () => {
        set({
          accounts: seedAccounts,
          transactions: seedTransactions,
          budgets: seedBudgets,
          goals: seedGoals,
          bills: seedBills,
        });
      },
    }),
    {
      name: 'finance-tracker-storage',
    },
  ),
);

// Selectors
export function useNetWorth() {
  return useFinanceStore((s) => s.accounts.reduce((sum, a) => sum + a.balance, 0));
}

export function useCurrentMonthStats() {
  return useFinanceStore((s) => {
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthTxs = s.transactions.filter((t) => t.date.startsWith(monthStr));
    const income = monthTxs.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expenses = monthTxs.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    return { income, expenses, net: income - expenses };
  });
}

export function useBudgetProgress() {
  return useFinanceStore((s) => {
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthTxs = s.transactions.filter(
      (t) => t.type === 'expense' && t.date.startsWith(monthStr),
    );
    return s.budgets.map((b) => {
      const spent = monthTxs
        .filter((t) => t.category === b.category)
        .reduce((sum, t) => sum + t.amount, 0);
      return { ...b, spent, percentage: Math.min((spent / b.amount) * 100, 100) };
    });
  });
}
