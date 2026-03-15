'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Wallet,
  CreditCard,
  PiggyBank,
  TrendingUp,
  DollarSign,
  Banknote,
  Bitcoin,
  Trash2,
  Edit3,
  X,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useFinanceStore } from '@/lib/finance/store';
import { Account, AccountType, getCategoryInfo } from '@/lib/finance/types';
import { cn } from '@/lib/utils';
import { format, subDays } from 'date-fns';

const accountTypeIcons: Record<AccountType, React.ElementType> = {
  checking: Wallet,
  savings: PiggyBank,
  credit: CreditCard,
  investment: TrendingUp,
  cash: Banknote,
  crypto: Bitcoin,
};

const accountTypeColors: Record<AccountType, string> = {
  checking: '#3b82f6',
  savings: '#22c55e',
  credit: '#ec4899',
  investment: '#8b5cf6',
  cash: '#f59e0b',
  crypto: '#f97316',
};

const ACCOUNT_EMOJIS = ['🏦', '💰', '💳', '📈', '👛', '🏧', '💵', '🏛️', '💎', '🪙'];

function AccountModal({
  isOpen,
  onClose,
  account,
}: {
  isOpen: boolean;
  onClose: () => void;
  account?: Account;
}) {
  const { addAccount, updateAccount } = useFinanceStore();
  const [form, setForm] = useState({
    name: account?.name ?? '',
    type: account?.type ?? ('checking' as AccountType),
    balance: account?.balance?.toString() ?? '0',
    currency: account?.currency ?? 'USD',
    color: account?.color ?? '#3b82f6',
    icon: account?.icon ?? '🏦',
    creditLimit: account?.creditLimit?.toString() ?? '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name: form.name,
      type: form.type,
      balance: parseFloat(form.balance),
      currency: form.currency,
      color: form.color || accountTypeColors[form.type],
      icon: form.icon,
      creditLimit: form.creditLimit ? parseFloat(form.creditLimit) : undefined,
    };
    if (account) updateAccount(account.id, data);
    else addAccount(data);
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
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[#0d1117] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl mx-4"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-white">{account ? 'Edit Account' : 'Add Account'}</h2>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center">
              <X className="w-4 h-4 text-white/60" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Icon picker */}
            <div>
              <label className="text-xs font-medium text-white/50 mb-2 block">Icon</label>
              <div className="flex gap-2 flex-wrap">
                {ACCOUNT_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, icon: emoji }))}
                    className={cn(
                      'w-9 h-9 rounded-xl text-xl flex items-center justify-center transition-all',
                      form.icon === emoji ? 'bg-violet-500/20 border border-violet-500/40' : 'bg-white/5 hover:bg-white/10 border border-transparent',
                    )}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-white/50 mb-1.5 block">Account Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Chase Checking"
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/50 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-white/50 mb-1.5 block">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as AccountType, color: accountTypeColors[e.target.value as AccountType] }))}
                  className="w-full bg-[#1a1f2e] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none"
                >
                  {Object.keys(accountTypeIcons).map((t) => (
                    <option key={t} value={t} className="capitalize">{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-white/50 mb-1.5 block">Currency</label>
                <select
                  value={form.currency}
                  onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                  className="w-full bg-[#1a1f2e] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none"
                >
                  {['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-white/50 mb-1.5 block">Current Balance</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 font-semibold">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={form.balance}
                  onChange={(e) => setForm((f) => ({ ...f, balance: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500/50"
                />
              </div>
            </div>

            {form.type === 'credit' && (
              <div>
                <label className="text-xs font-medium text-white/50 mb-1.5 block">Credit Limit</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 font-semibold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={form.creditLimit}
                    onChange={(e) => setForm((f) => ({ ...f, creditLimit: e.target.value }))}
                    placeholder="10000"
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500/50"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-white/50 mb-2 block">Color</label>
              <div className="flex gap-2 flex-wrap">
                {['#3b82f6', '#22c55e', '#ec4899', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#f97316', '#14b8a6', '#a855f7'].map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, color }))}
                    className={cn(
                      'w-7 h-7 rounded-full transition-transform',
                      form.color === color ? 'scale-125 ring-2 ring-white/30 ring-offset-2 ring-offset-[#0d1117]' : 'hover:scale-110',
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/60 text-sm font-medium border border-white/5">
                Cancel
              </button>
              <button type="submit" className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium shadow-lg shadow-violet-500/20">
                {account ? 'Update Account' : 'Add Account'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function AccountCard({ account, onEdit, onDelete }: { account: Account; onEdit: () => void; onDelete: () => void }) {
  const { transactions } = useFinanceStore();
  const [showBalance, setShowBalance] = useState(true);
  const Icon = accountTypeIcons[account.type];

  const recentTxs = useMemo(() =>
    transactions.filter((t) => t.accountId === account.id).slice(0, 3),
    [transactions, account.id],
  );

  const monthStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const monthIncome = transactions
    .filter((t) => t.accountId === account.id && t.type === 'income' && t.date.startsWith(monthStr))
    .reduce((s, t) => s + t.amount, 0);
  const monthExpenses = transactions
    .filter((t) => t.accountId === account.id && t.type === 'expense' && t.date.startsWith(monthStr))
    .reduce((s, t) => s + t.amount, 0);

  const creditUsage = account.type === 'credit' && account.creditLimit
    ? (Math.abs(account.balance) / account.creditLimit) * 100
    : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-[#0d1117] rounded-2xl border border-white/5 overflow-hidden hover:border-white/10 transition-colors group"
    >
      {/* Card header with gradient */}
      <div
        className="p-5 relative"
        style={{ background: `linear-gradient(135deg, ${account.color}15 0%, ${account.color}05 100%)` }}
      >
        <div className="flex items-start justify-between mb-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
            style={{ backgroundColor: `${account.color}20`, border: `1px solid ${account.color}30` }}
          >
            {account.icon}
          </div>
          <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => setShowBalance(!showBalance)}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center"
            >
              {showBalance ? <Eye className="w-3.5 h-3.5 text-white/40" /> : <EyeOff className="w-3.5 h-3.5 text-white/40" />}
            </button>
            <button onClick={onEdit} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-violet-500/20 flex items-center justify-center">
              <Edit3 className="w-3.5 h-3.5 text-white/40 hover:text-violet-400" />
            </button>
            <button onClick={onDelete} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-red-500/20 flex items-center justify-center">
              <Trash2 className="w-3.5 h-3.5 text-white/40 hover:text-red-400" />
            </button>
          </div>
        </div>
        <p className="text-sm text-white/50 mb-1">{account.name}</p>
        <div className="flex items-baseline gap-2">
          <p className={cn('text-2xl font-bold', account.balance < 0 ? 'text-red-400' : 'text-white')}>
            {showBalance
              ? `${account.balance < 0 ? '-' : ''}$${Math.abs(account.balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : '••••••'}
          </p>
          <span className="text-xs text-white/30">{account.currency}</span>
        </div>
        <span
          className="text-[10px] font-medium px-2 py-0.5 rounded-md mt-2 inline-block capitalize"
          style={{ backgroundColor: `${account.color}20`, color: account.color }}
        >
          {account.type}
        </span>

        {/* Credit usage bar */}
        {creditUsage !== null && account.creditLimit && (
          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-white/30">Credit Used</span>
              <span style={{ color: creditUsage > 80 ? '#ef4444' : '#f59e0b' }}>
                {creditUsage.toFixed(0)}% of ${account.creditLimit.toLocaleString()}
              </span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${creditUsage}%`,
                  backgroundColor: creditUsage > 80 ? '#ef4444' : creditUsage > 50 ? '#f59e0b' : account.color,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="px-5 py-3 border-t border-white/5 grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] text-white/30 mb-0.5">This Month In</p>
          <p className="text-sm font-semibold text-emerald-400">+${monthIncome.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[10px] text-white/30 mb-0.5">This Month Out</p>
          <p className="text-sm font-semibold text-red-400">-${monthExpenses.toLocaleString()}</p>
        </div>
      </div>

      {/* Recent transactions */}
      <div className="px-5 pb-4">
        <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-2">Recent</p>
        {recentTxs.length === 0 ? (
          <p className="text-xs text-white/20">No transactions</p>
        ) : (
          <div className="space-y-1.5">
            {recentTxs.map((tx) => {
              const catInfo = getCategoryInfo(tx.category);
              return (
                <div key={tx.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs">{catInfo.icon}</span>
                    <span className="text-xs text-white/50 truncate max-w-32">{tx.description}</span>
                  </div>
                  <span className={cn('text-xs font-medium', tx.type === 'income' ? 'text-emerald-400' : 'text-white/60')}>
                    {tx.type === 'income' ? '+' : '-'}${tx.amount.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function AccountsPage() {
  const { accounts, deleteAccount } = useFinanceStore();
  const [showModal, setShowModal] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | undefined>();

  const totalAssets = accounts.filter((a) => a.balance > 0).reduce((s, a) => s + a.balance, 0);
  const totalLiabilities = accounts.filter((a) => a.balance < 0).reduce((s, a) => s + Math.abs(a.balance), 0);
  const netWorth = totalAssets - totalLiabilities;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Accounts</h1>
          <p className="text-white/40 text-sm mt-1">{accounts.length} accounts linked</p>
        </div>
        <button
          onClick={() => { setEditAccount(undefined); setShowModal(true); }}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors shadow-lg shadow-violet-500/20"
        >
          <Plus className="w-4 h-4" />
          Add Account
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Assets', value: totalAssets, color: '#22c55e', bg: '#22c55e10' },
          { label: 'Total Liabilities', value: totalLiabilities, color: '#ef4444', bg: '#ef444410' },
          { label: 'Net Worth', value: netWorth, color: '#8b5cf6', bg: '#8b5cf610' },
        ].map((item) => (
          <div key={item.label} className="bg-[#0d1117] rounded-2xl border border-white/5 p-5">
            <p className="text-xs text-white/40 mb-2">{item.label}</p>
            <p className="text-2xl font-bold" style={{ color: item.color }}>
              ${item.value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
            <div className="h-1 rounded-full mt-3" style={{ backgroundColor: item.bg }}>
              <div className="h-full w-3/4 rounded-full" style={{ backgroundColor: item.color }} />
            </div>
          </div>
        ))}
      </div>

      {/* Account Cards */}
      <div className="grid grid-cols-3 gap-5">
        {accounts.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            onEdit={() => { setEditAccount(account); setShowModal(true); }}
            onDelete={() => deleteAccount(account.id)}
          />
        ))}

        {/* Add account card */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => { setEditAccount(undefined); setShowModal(true); }}
          className="bg-[#0d1117] rounded-2xl border border-dashed border-white/10 hover:border-violet-500/30 flex flex-col items-center justify-center gap-3 p-8 transition-colors group min-h-48"
        >
          <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center group-hover:bg-violet-500/20 transition-colors">
            <Plus className="w-5 h-5 text-violet-400" />
          </div>
          <p className="text-sm text-white/30 group-hover:text-white/50 transition-colors">Add New Account</p>
        </motion.button>
      </div>

      <AccountModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditAccount(undefined); }}
        account={editAccount}
      />
    </div>
  );
}
