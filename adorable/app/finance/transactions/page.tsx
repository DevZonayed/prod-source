'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
  Trash2,
  Edit3,
  X,
  Check,
  ChevronDown,
  SlidersHorizontal,
  Download,
} from 'lucide-react';
import { useFinanceStore } from '@/lib/finance/store';
import { Transaction, EXPENSE_CATEGORIES, INCOME_CATEGORIES, getCategoryInfo } from '@/lib/finance/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

type FilterType = 'all' | 'income' | 'expense' | 'transfer';

const typeColors = {
  income: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  expense: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
  transfer: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
};

interface TransactionFormData {
  accountId: string;
  type: 'income' | 'expense' | 'transfer';
  amount: string;
  category: string;
  description: string;
  date: string;
  tags: string;
  notes: string;
  toAccountId: string;
}

function TransactionModal({
  isOpen,
  onClose,
  transaction,
}: {
  isOpen: boolean;
  onClose: () => void;
  transaction?: Transaction;
}) {
  const { accounts, addTransaction, updateTransaction } = useFinanceStore();
  const [form, setForm] = useState<TransactionFormData>({
    accountId: transaction?.accountId ?? accounts[0]?.id ?? '',
    type: transaction?.type ?? 'expense',
    amount: transaction?.amount?.toString() ?? '',
    category: transaction?.category ?? '',
    description: transaction?.description ?? '',
    date: transaction?.date ?? new Date().toISOString().split('T')[0],
    tags: transaction?.tags?.join(', ') ?? '',
    notes: transaction?.notes ?? '',
    toAccountId: transaction?.toAccountId ?? '',
  });

  const categories = form.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      accountId: form.accountId,
      type: form.type,
      amount: parseFloat(form.amount),
      category: form.category || categories[0].name,
      description: form.description,
      date: form.date,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      notes: form.notes,
      toAccountId: form.type === 'transfer' ? form.toAccountId : undefined,
    };
    if (transaction) {
      updateTransaction(transaction.id, data);
    } else {
      addTransaction(data);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-[#0d1117] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl mx-4"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-white">
              {transaction ? 'Edit Transaction' : 'Add Transaction'}
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-white/60" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Type selector */}
            <div className="grid grid-cols-3 gap-2 p-1 bg-white/5 rounded-xl">
              {(['income', 'expense', 'transfer'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, type: t, category: '' }))}
                  className={cn(
                    'py-2 px-3 rounded-lg text-xs font-medium capitalize transition-all',
                    form.type === t
                      ? t === 'income'
                        ? 'bg-emerald-500 text-white shadow-lg'
                        : t === 'expense'
                        ? 'bg-red-500 text-white shadow-lg'
                        : 'bg-blue-500 text-white shadow-lg'
                      : 'text-white/50 hover:text-white',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Amount */}
            <div>
              <label className="text-xs font-medium text-white/50 mb-1.5 block">Amount</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 font-semibold">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-4 py-3 text-white text-lg font-semibold placeholder:text-white/20 focus:outline-none focus:border-violet-500/50 focus:bg-white/8 transition-colors"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-medium text-white/50 mb-1.5 block">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="e.g. Whole Foods Groceries"
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/50 transition-colors text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Account */}
              <div>
                <label className="text-xs font-medium text-white/50 mb-1.5 block">Account</label>
                <select
                  value={form.accountId}
                  onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value }))}
                  className="w-full bg-[#1a1f2e] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500/50 transition-colors"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.icon} {a.name}</option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="text-xs font-medium text-white/50 mb-1.5 block">Date</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  className="w-full bg-[#1a1f2e] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500/50 transition-colors"
                />
              </div>
            </div>

            {/* Category */}
            {form.type !== 'transfer' && (
              <div>
                <label className="text-xs font-medium text-white/50 mb-1.5 block">Category</label>
                <div className="grid grid-cols-4 gap-1.5 max-h-32 overflow-y-auto pr-1">
                  {categories.map((cat) => (
                    <button
                      key={cat.name}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, category: cat.name }))}
                      className={cn(
                        'flex flex-col items-center gap-1 p-2 rounded-xl text-xs transition-all border',
                        form.category === cat.name
                          ? 'border-violet-500/50 bg-violet-500/15 text-white'
                          : 'border-transparent bg-white/5 text-white/50 hover:bg-white/8',
                      )}
                    >
                      <span className="text-base">{cat.icon}</span>
                      <span className="truncate w-full text-center text-[9px]">{cat.name.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Transfer to account */}
            {form.type === 'transfer' && (
              <div>
                <label className="text-xs font-medium text-white/50 mb-1.5 block">To Account</label>
                <select
                  value={form.toAccountId}
                  onChange={(e) => setForm((f) => ({ ...f, toAccountId: e.target.value }))}
                  className="w-full bg-[#1a1f2e] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500/50 transition-colors"
                >
                  <option value="">Select destination account</option>
                  {accounts.filter((a) => a.id !== form.accountId).map((a) => (
                    <option key={a.id} value={a.id}>{a.icon} {a.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Tags */}
            <div>
              <label className="text-xs font-medium text-white/50 mb-1.5 block">Tags (comma separated)</label>
              <input
                type="text"
                value={form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                placeholder="groceries, work, travel..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/50 transition-colors text-sm"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 text-sm font-medium transition-colors border border-white/5"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors shadow-lg shadow-violet-500/20"
              >
                {transaction ? 'Update' : 'Add Transaction'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function TransactionsPage() {
  const { transactions, accounts, deleteTransaction } = useFinanceStore();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterAccount, setFilterAccount] = useState('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
  const [showModal, setShowModal] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | undefined>();

  const filtered = useMemo(() => {
    return transactions
      .filter((tx) => {
        if (filterType !== 'all' && tx.type !== filterType) return false;
        if (filterCategory !== 'all' && tx.category !== filterCategory) return false;
        if (filterAccount !== 'all' && tx.accountId !== filterAccount) return false;
        if (search) {
          const q = search.toLowerCase();
          return (
            tx.description.toLowerCase().includes(q) ||
            tx.category.toLowerCase().includes(q) ||
            tx.tags.some((t) => t.includes(q))
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'date') return new Date(b.date).getTime() - new Date(a.date).getTime();
        return b.amount - a.amount;
      });
  }, [transactions, filterType, filterCategory, filterAccount, search, sortBy]);

  const totalIncome = filtered.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpenses = filtered.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  const allCategories = useMemo(() => {
    const cats = new Set(transactions.map((t) => t.category));
    return Array.from(cats).sort();
  }, [transactions]);

  // Group by date
  const grouped = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    filtered.forEach((tx) => {
      if (!groups[tx.date]) groups[tx.date] = [];
      groups[tx.date].push(tx);
    });
    return Object.entries(groups).sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime());
  }, [filtered]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Transactions</h1>
          <p className="text-white/40 text-sm mt-1">{filtered.length} transactions</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white/60 text-sm px-4 py-2.5 rounded-xl transition-colors border border-white/5">
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={() => { setEditTx(undefined); setShowModal(true); }}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors shadow-lg shadow-violet-500/20"
          >
            <Plus className="w-4 h-4" />
            Add Transaction
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Income', value: totalIncome, color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: ArrowUpRight },
          { label: 'Total Expenses', value: totalExpenses, color: 'text-red-400', bg: 'bg-red-500/10', icon: ArrowDownRight },
          { label: 'Net', value: totalIncome - totalExpenses, color: (totalIncome - totalExpenses) >= 0 ? 'text-violet-400' : 'text-red-400', bg: 'bg-violet-500/10', icon: ArrowLeftRight },
        ].map((stat) => (
          <div key={stat.label} className={cn('rounded-2xl p-4 border border-white/5', 'bg-[#0d1117]')}>
            <div className="flex items-center justify-between">
              <p className="text-xs text-white/40">{stat.label}</p>
              <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', stat.bg)}>
                <stat.icon className={cn('w-3.5 h-3.5', stat.color)} />
              </div>
            </div>
            <p className={cn('text-xl font-bold mt-2', stat.color)}>
              {stat.value < 0 ? '-' : ''}${Math.abs(stat.value).toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-[#0d1117] rounded-2xl border border-white/5 p-4">
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2 flex-1 min-w-48 border border-white/5">
            <Search className="w-4 h-4 text-white/30" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search transactions..."
              className="bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none flex-1"
            />
            {search && (
              <button onClick={() => setSearch('')}>
                <X className="w-3.5 h-3.5 text-white/30 hover:text-white/60" />
              </button>
            )}
          </div>

          {/* Type filter */}
          <div className="flex gap-1 bg-white/5 rounded-xl p-1 border border-white/5">
            {(['all', 'income', 'expense', 'transfer'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all',
                  filterType === t
                    ? 'bg-violet-600 text-white shadow'
                    : 'text-white/40 hover:text-white/70',
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Account filter */}
          <select
            value={filterAccount}
            onChange={(e) => setFilterAccount(e.target.value)}
            className="bg-white/5 border border-white/5 rounded-xl px-3 py-2 text-sm text-white/60 focus:outline-none focus:border-violet-500/30"
          >
            <option value="all">All Accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.icon} {a.name}</option>
            ))}
          </select>

          {/* Category filter */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-white/5 border border-white/5 rounded-xl px-3 py-2 text-sm text-white/60 focus:outline-none focus:border-violet-500/30"
          >
            <option value="all">All Categories</option>
            {allCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Sort */}
          <button
            onClick={() => setSortBy(sortBy === 'date' ? 'amount' : 'date')}
            className="flex items-center gap-2 bg-white/5 border border-white/5 rounded-xl px-3 py-2 text-sm text-white/60 hover:text-white/80 transition-colors"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Sort: {sortBy === 'date' ? 'Date' : 'Amount'}
          </button>
        </div>
      </div>

      {/* Transactions List */}
      <div className="space-y-6">
        {grouped.length === 0 ? (
          <div className="bg-[#0d1117] rounded-2xl border border-white/5 p-12 text-center">
            <p className="text-white/30 text-sm">No transactions found</p>
          </div>
        ) : (
          grouped.map(([date, txs]) => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-3">
                <p className="text-xs font-semibold text-white/40 uppercase tracking-wide">
                  {format(new Date(date + 'T12:00:00'), 'EEEE, MMMM d')}
                </p>
                <div className="flex-1 h-px bg-white/5" />
                <p className="text-xs text-white/30">
                  {txs.filter((t) => t.type === 'income').length > 0 && (
                    <span className="text-emerald-400/60">+${txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0).toFixed(0)} </span>
                  )}
                  {txs.filter((t) => t.type === 'expense').length > 0 && (
                    <span className="text-red-400/60">-${txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0).toFixed(0)}</span>
                  )}
                </p>
              </div>
              <div className="bg-[#0d1117] rounded-2xl border border-white/5 overflow-hidden">
                {txs.map((tx, i) => {
                  const catInfo = getCategoryInfo(tx.category);
                  const account = accounts.find((a) => a.id === tx.accountId);
                  const toAccount = tx.toAccountId ? accounts.find((a) => a.id === tx.toAccountId) : undefined;
                  const typeStyle = typeColors[tx.type];
                  return (
                    <motion.div
                      key={tx.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={cn(
                        'flex items-center gap-4 px-5 py-4 group hover:bg-white/2 transition-colors',
                        i < txs.length - 1 && 'border-b border-white/3',
                      )}
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                        style={{ backgroundColor: `${catInfo.color}15`, border: `1px solid ${catInfo.color}20` }}
                      >
                        {catInfo.icon}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-white text-sm">{tx.description}</p>
                          {tx.tags.slice(0, 2).map((tag) => (
                            <span key={tag} className="text-[10px] bg-white/5 text-white/30 px-1.5 py-0.5 rounded">
                              #{tag}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-white/40">{catInfo.icon} {tx.category}</span>
                          <span className="text-white/20">·</span>
                          <span className="text-xs text-white/40">{account?.name}</span>
                          {toAccount && (
                            <>
                              <span className="text-white/20">→</span>
                              <span className="text-xs text-white/40">{toAccount.name}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <p
                          className={cn(
                            'text-base font-bold',
                            tx.type === 'income' ? 'text-emerald-400' : tx.type === 'transfer' ? 'text-blue-400' : 'text-white',
                          )}
                        >
                          {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                          ${tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <span
                          className={cn(
                            'text-[10px] px-2 py-0.5 rounded-md capitalize',
                            typeStyle.bg,
                            typeStyle.text,
                          )}
                        >
                          {tx.type}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setEditTx(tx); setShowModal(true); }}
                          className="w-8 h-8 rounded-lg bg-white/5 hover:bg-violet-500/20 flex items-center justify-center transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-white/40 hover:text-violet-400" />
                        </button>
                        <button
                          onClick={() => deleteTransaction(tx.id)}
                          className="w-8 h-8 rounded-lg bg-white/5 hover:bg-red-500/20 flex items-center justify-center transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-white/40 hover:text-red-400" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      <TransactionModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditTx(undefined); }}
        transaction={editTx}
      />
    </div>
  );
}
