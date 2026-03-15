'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Trash2,
  Edit3,
  X,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Target,
} from 'lucide-react';
import { useFinanceStore, useBudgetProgress } from '@/lib/finance/store';
import { Budget, EXPENSE_CATEGORIES } from '@/lib/finance/types';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

function BudgetModal({
  isOpen,
  onClose,
  budget,
}: {
  isOpen: boolean;
  onClose: () => void;
  budget?: Budget;
}) {
  const { addBudget, updateBudget } = useFinanceStore();
  const [form, setForm] = useState({
    category: budget?.category ?? '',
    amount: budget?.amount?.toString() ?? '',
    period: budget?.period ?? 'monthly' as 'monthly' | 'weekly' | 'yearly',
    color: budget?.color ?? '#8b5cf6',
    icon: budget?.icon ?? '💰',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const catInfo = EXPENSE_CATEGORIES.find((c) => c.name === form.category);
    const data = {
      category: form.category,
      amount: parseFloat(form.amount),
      period: form.period,
      color: catInfo?.color ?? form.color,
      icon: catInfo?.icon ?? form.icon,
    };
    if (budget) updateBudget(budget.id, data);
    else addBudget(data);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[#0d1117] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl mx-4"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-white">{budget ? 'Edit Budget' : 'Set Budget'}</h2>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center">
              <X className="w-4 h-4 text-white/60" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-white/50 mb-1.5 block">Category</label>
              <div className="grid grid-cols-4 gap-1.5 max-h-40 overflow-y-auto pr-1">
                {EXPENSE_CATEGORIES.map((cat) => (
                  <button
                    key={cat.name}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, category: cat.name, color: cat.color, icon: cat.icon }))}
                    className={cn(
                      'flex flex-col items-center gap-1 p-2 rounded-xl text-xs transition-all border',
                      form.category === cat.name
                        ? 'border-violet-500/50 bg-violet-500/15 text-white'
                        : 'border-transparent bg-white/5 text-white/50 hover:bg-white/8',
                    )}
                  >
                    <span className="text-base">{cat.icon}</span>
                    <span className="text-[9px] truncate w-full text-center">{cat.name.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-white/50 mb-1.5 block">Budget Amount</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 font-semibold">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  required
                  placeholder="500"
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-4 py-3 text-white text-lg font-semibold placeholder:text-white/20 focus:outline-none focus:border-violet-500/50"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-white/50 mb-1.5 block">Period</label>
              <div className="grid grid-cols-3 gap-2">
                {(['weekly', 'monthly', 'yearly'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, period: p }))}
                    className={cn(
                      'py-2 rounded-xl text-sm capitalize transition-all border',
                      form.period === p
                        ? 'bg-violet-600 border-violet-500 text-white'
                        : 'bg-white/5 border-white/5 text-white/50 hover:text-white',
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/60 text-sm font-medium border border-white/5">Cancel</button>
              <button type="submit" className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium shadow-lg shadow-violet-500/20">
                {budget ? 'Update' : 'Create Budget'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function BudgetsPage() {
  const { deleteBudget, transactions } = useFinanceStore();
  const budgets = useBudgetProgress();
  const [showModal, setShowModal] = useState(false);
  const [editBudget, setEditBudget] = useState<Budget | undefined>();

  const totalBudgeted = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);
  const overBudgetCount = budgets.filter((b) => b.spent > b.amount).length;

  // Last 3 months comparison
  const monthlyComparison = useMemo(() => {
    return budgets.map((budget) => {
      const months = Array.from({ length: 3 }, (_, i) => {
        const date = subMonths(new Date(), i);
        const monthStr = format(date, 'yyyy-MM');
        const spent = transactions
          .filter((t) => t.type === 'expense' && t.category === budget.category && t.date.startsWith(monthStr))
          .reduce((s, t) => s + t.amount, 0);
        return { month: format(date, 'MMM'), spent: Math.round(spent) };
      }).reverse();
      return { ...budget, months };
    });
  }, [budgets, transactions]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Budgets</h1>
          <p className="text-white/40 text-sm mt-1">
            {format(new Date(), 'MMMM yyyy')} — Track your spending limits
          </p>
        </div>
        <button
          onClick={() => { setEditBudget(undefined); setShowModal(true); }}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors shadow-lg shadow-violet-500/20"
        >
          <Plus className="w-4 h-4" />
          Set Budget
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Budgeted', value: `$${totalBudgeted.toLocaleString()}`, color: '#8b5cf6', icon: Target },
          { label: 'Total Spent', value: `$${totalSpent.toFixed(0)}`, color: '#ef4444', icon: TrendingUp },
          { label: 'Remaining', value: `$${Math.max(totalBudgeted - totalSpent, 0).toFixed(0)}`, color: '#22c55e', icon: CheckCircle2 },
          { label: 'Over Budget', value: `${overBudgetCount} categories`, color: overBudgetCount > 0 ? '#f59e0b' : '#22c55e', icon: AlertTriangle },
        ].map((item) => (
          <div key={item.label} className="bg-[#0d1117] rounded-2xl border border-white/5 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${item.color}15` }}>
                <item.icon className="w-4 h-4" style={{ color: item.color }} />
              </div>
            </div>
            <p className="text-lg font-bold text-white">{item.value}</p>
            <p className="text-xs text-white/40 mt-0.5">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Overall progress */}
      <div className="bg-[#0d1117] rounded-2xl border border-white/5 p-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-white">Overall Budget Progress</p>
          <p className="text-sm text-white/50">${totalSpent.toFixed(0)} / ${totalBudgeted.toLocaleString()}</p>
        </div>
        <div className="h-3 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min((totalSpent / totalBudgeted) * 100, 100)}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{
              background: totalSpent / totalBudgeted > 0.9
                ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                : totalSpent / totalBudgeted > 0.7
                ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                : 'linear-gradient(90deg, #8b5cf6, #7c3aed)',
            }}
          />
        </div>
        <p className="text-xs text-white/30 mt-2">
          {((totalSpent / totalBudgeted) * 100).toFixed(1)}% of total budget used
        </p>
      </div>

      {/* Budget Cards */}
      <div className="grid grid-cols-2 gap-4">
        {monthlyComparison.map((budget, i) => {
          const pct = budget.percentage;
          const isOver = pct >= 100;
          const isWarning = pct >= 75 && !isOver;
          const statusColor = isOver ? '#ef4444' : isWarning ? '#f59e0b' : budget.color;

          return (
            <motion.div
              key={budget.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-[#0d1117] rounded-2xl border border-white/5 p-5 hover:border-white/10 transition-colors group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                    style={{ backgroundColor: `${statusColor}15`, border: `1px solid ${statusColor}20` }}
                  >
                    {budget.icon}
                  </div>
                  <div>
                    <p className="font-medium text-white text-sm">{budget.category}</p>
                    <p className="text-xs text-white/40 capitalize">{budget.period}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isOver && (
                    <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded-md font-medium">
                      Over Budget
                    </span>
                  )}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setEditBudget(budget as Budget); setShowModal(true); }}
                      className="w-7 h-7 rounded-lg bg-white/5 hover:bg-violet-500/20 flex items-center justify-center"
                    >
                      <Edit3 className="w-3 h-3 text-white/40 hover:text-violet-400" />
                    </button>
                    <button
                      onClick={() => deleteBudget(budget.id)}
                      className="w-7 h-7 rounded-lg bg-white/5 hover:bg-red-500/20 flex items-center justify-center"
                    >
                      <Trash2 className="w-3 h-3 text-white/40 hover:text-red-400" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Progress */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl font-bold" style={{ color: statusColor }}>${budget.spent.toFixed(0)}</span>
                  <span className="text-sm text-white/40">/ ${budget.amount.toLocaleString()}</span>
                </div>
                <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(pct, 100)}%` }}
                    transition={{ delay: i * 0.05 + 0.2, duration: 0.6, ease: 'easeOut' }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: statusColor }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-xs" style={{ color: statusColor }}>
                    {pct.toFixed(0)}% used
                  </span>
                  <span className="text-xs text-white/30">
                    {isOver
                      ? `$${(budget.spent - budget.amount).toFixed(0)} over`
                      : `$${(budget.amount - budget.spent).toFixed(0)} left`}
                  </span>
                </div>
              </div>

              {/* 3-month trend bars */}
              <div>
                <p className="text-[10px] text-white/30 mb-2 uppercase tracking-wide">3-Month Trend</p>
                <div className="flex items-end gap-1.5 h-12">
                  {budget.months.map((m, mi) => {
                    const barPct = budget.amount > 0 ? (m.spent / budget.amount) * 100 : 0;
                    return (
                      <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full flex items-end justify-center h-8">
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: `${Math.min(barPct, 100)}%` }}
                            transition={{ delay: i * 0.05 + mi * 0.1 + 0.3 }}
                            className="w-full rounded-sm min-h-1"
                            style={{
                              backgroundColor: mi === 2 ? statusColor : `${statusColor}40`,
                              maxHeight: '32px',
                              height: `${Math.min(barPct, 100)}%`,
                            }}
                          />
                        </div>
                        <span className="text-[9px] text-white/30">{m.month}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          );
        })}

        {/* Add budget */}
        <motion.button
          whileHover={{ scale: 1.01 }}
          onClick={() => { setEditBudget(undefined); setShowModal(true); }}
          className="bg-[#0d1117] rounded-2xl border border-dashed border-white/10 hover:border-violet-500/30 flex flex-col items-center justify-center gap-3 p-8 transition-colors group min-h-40"
        >
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <Plus className="w-5 h-5 text-violet-400" />
          </div>
          <p className="text-sm text-white/30 group-hover:text-white/50">Add Category Budget</p>
        </motion.button>
      </div>

      <BudgetModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditBudget(undefined); }}
        budget={editBudget}
      />
    </div>
  );
}
