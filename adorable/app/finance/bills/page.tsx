'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Trash2,
  Edit3,
  X,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar,
  Zap,
  RefreshCw,
} from 'lucide-react';
import { useFinanceStore } from '@/lib/finance/store';
import { Bill, BillFrequency, EXPENSE_CATEGORIES } from '@/lib/finance/types';
import { cn } from '@/lib/utils';
import { format, differenceInDays, addDays } from 'date-fns';

const BILL_ICONS = ['🏠', '💡', '📺', '🎵', '🚗', '💪', '📡', '⚕️', '📱', '🛡️', '🐾', '🎓', '🏋️', '🍕'];

function BillModal({ isOpen, onClose, bill }: { isOpen: boolean; onClose: () => void; bill?: Bill }) {
  const { addBill, updateBill } = useFinanceStore();
  const [form, setForm] = useState({
    name: bill?.name ?? '',
    amount: bill?.amount?.toString() ?? '',
    frequency: bill?.frequency ?? 'monthly' as BillFrequency,
    dueDay: bill?.dueDay?.toString() ?? '1',
    category: bill?.category ?? 'Housing',
    icon: bill?.icon ?? '📄',
    isAutoPay: bill?.isAutoPay ?? false,
    notes: bill?.notes ?? '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dueDay = parseInt(form.dueDay);
    const today = new Date();
    let nextDue = new Date(today.getFullYear(), today.getMonth(), dueDay);
    if (nextDue <= today) {
      nextDue = new Date(today.getFullYear(), today.getMonth() + 1, dueDay);
    }

    const catInfo = EXPENSE_CATEGORIES.find((c) => c.name === form.category);
    const data = {
      name: form.name,
      amount: parseFloat(form.amount),
      frequency: form.frequency,
      dueDay,
      category: form.category,
      color: catInfo?.color ?? '#6366f1',
      icon: form.icon,
      isAutoPay: form.isAutoPay,
      notes: form.notes,
      nextDueDate: nextDue.toISOString().split('T')[0],
    };
    if (bill) updateBill(bill.id, data);
    else addBill(data);
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
          className="bg-[#0d1117] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl mx-4 max-h-[90vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-white">{bill ? 'Edit Bill' : 'Add Bill'}</h2>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center">
              <X className="w-4 h-4 text-white/60" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Icon */}
            <div>
              <label className="text-xs font-medium text-white/50 mb-2 block">Icon</label>
              <div className="flex gap-2 flex-wrap">
                {BILL_ICONS.map((emoji) => (
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
              <label className="text-xs font-medium text-white/50 mb-1.5 block">Bill Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Netflix"
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/50 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-white/50 mb-1.5 block">Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 font-bold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    required
                    placeholder="29.99"
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-7 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500/50"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-white/50 mb-1.5 block">Due Day of Month</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={form.dueDay}
                  onChange={(e) => setForm((f) => ({ ...f, dueDay: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500/50"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-white/50 mb-1.5 block">Frequency</label>
                <select
                  value={form.frequency}
                  onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value as BillFrequency }))}
                  className="w-full bg-[#1a1f2e] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none"
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-white/50 mb-1.5 block">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full bg-[#1a1f2e] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none"
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c.name} value={c.name}>{c.icon} {c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Auto-pay toggle */}
            <div className="flex items-center justify-between p-3 bg-white/3 rounded-xl border border-white/5">
              <div className="flex items-center gap-3">
                <Zap className="w-4 h-4 text-yellow-400" />
                <div>
                  <p className="text-sm font-medium text-white">Auto Pay</p>
                  <p className="text-xs text-white/40">Automatically paid each period</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, isAutoPay: !f.isAutoPay }))}
                className={cn(
                  'w-10 h-5.5 rounded-full relative transition-colors',
                  form.isAutoPay ? 'bg-violet-600' : 'bg-white/10',
                )}
                style={{ height: '22px', width: '40px' }}
              >
                <div
                  className={cn(
                    'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                    form.isAutoPay ? 'translate-x-5' : 'translate-x-0.5',
                  )}
                />
              </button>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/60 text-sm border border-white/5">Cancel</button>
              <button type="submit" className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium shadow-lg shadow-violet-500/20">
                {bill ? 'Update' : 'Add Bill'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function BillCard({ bill, onEdit, onDelete, onMarkPaid }: {
  bill: Bill;
  onEdit: () => void;
  onDelete: () => void;
  onMarkPaid: () => void;
}) {
  const daysUntil = differenceInDays(new Date(bill.nextDueDate + 'T12:00:00'), new Date());
  const isOverdue = daysUntil < 0;
  const isUrgent = daysUntil >= 0 && daysUntil <= 3;
  const isPaidRecently = bill.lastPaidDate &&
    differenceInDays(new Date(), new Date(bill.lastPaidDate)) < 3;

  const statusColor = isOverdue ? '#ef4444' : isUrgent ? '#f59e0b' : '#22c55e';
  const statusBg = isOverdue ? 'bg-red-500/10' : isUrgent ? 'bg-yellow-500/10' : 'bg-emerald-500/10';
  const statusText = isOverdue ? 'text-red-400' : isUrgent ? 'text-yellow-400' : 'text-emerald-400';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'bg-[#0d1117] rounded-2xl border overflow-hidden group hover:border-white/10 transition-colors',
        isOverdue ? 'border-red-500/20' : isUrgent ? 'border-yellow-500/15' : 'border-white/5',
      )}
    >
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-xl"
              style={{ backgroundColor: `${bill.color}15`, border: `1px solid ${bill.color}20` }}
            >
              {bill.icon}
            </div>
            <div>
              <p className="font-semibold text-white">{bill.name}</p>
              <p className="text-xs text-white/40 capitalize">{bill.category} · {bill.frequency}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={onEdit} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-violet-500/20 flex items-center justify-center">
              <Edit3 className="w-3 h-3 text-white/40 hover:text-violet-400" />
            </button>
            <button onClick={onDelete} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-red-500/20 flex items-center justify-center">
              <Trash2 className="w-3 h-3 text-white/40 hover:text-red-400" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <p className="text-2xl font-bold text-white">${bill.amount.toLocaleString()}</p>
          {bill.isAutoPay && (
            <span className="flex items-center gap-1 text-[10px] bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded-md font-medium border border-yellow-500/15">
              <Zap className="w-2.5 h-2.5" />
              Auto Pay
            </span>
          )}
        </div>

        <div className={cn('flex items-center gap-2 px-3 py-2 rounded-xl mb-4', statusBg)}>
          {isOverdue ? <AlertTriangle className="w-3.5 h-3.5" style={{ color: statusColor }} /> : <Calendar className="w-3.5 h-3.5" style={{ color: statusColor }} />}
          <p className={cn('text-xs font-medium', statusText)}>
            {isOverdue
              ? `Overdue by ${Math.abs(daysUntil)} days`
              : daysUntil === 0
              ? 'Due today!'
              : daysUntil === 1
              ? 'Due tomorrow'
              : `Due in ${daysUntil} days`}
          </p>
          <p className="text-xs text-white/30 ml-auto">{format(new Date(bill.nextDueDate + 'T12:00:00'), 'MMM d')}</p>
        </div>

        {bill.lastPaidDate && (
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-3.5 h-3.5 text-white/20" />
            <p className="text-xs text-white/30">
              Last paid {format(new Date(bill.lastPaidDate + 'T12:00:00'), 'MMM d, yyyy')}
            </p>
          </div>
        )}

        <button
          onClick={onMarkPaid}
          className={cn(
            'w-full py-2 rounded-xl text-sm font-medium transition-all border',
            isPaidRecently
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-white/5 border-white/5 text-white/60 hover:bg-violet-500/15 hover:border-violet-500/20 hover:text-violet-300',
          )}
        >
          {isPaidRecently ? (
            <span className="flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Recently Paid
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Mark as Paid
            </span>
          )}
        </button>
      </div>

      {/* Payment history */}
      {bill.payments.length > 0 && (
        <div className="px-5 pb-4 border-t border-white/5 pt-3">
          <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wide mb-2">Recent Payments</p>
          <div className="space-y-1.5">
            {bill.payments.slice(0, 2).map((p, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-xs text-white/40">{format(new Date(p.date + 'T12:00:00'), 'MMM d, yyyy')}</span>
                <span className="text-xs font-medium text-emerald-400">-${p.amount}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default function BillsPage() {
  const { bills, deleteBill, markBillPaid } = useFinanceStore();
  const [showModal, setShowModal] = useState(false);
  const [editBill, setEditBill] = useState<Bill | undefined>();

  const totalMonthly = bills.reduce((s, b) => {
    if (b.frequency === 'monthly') return s + b.amount;
    if (b.frequency === 'weekly') return s + b.amount * 4.33;
    if (b.frequency === 'quarterly') return s + b.amount / 3;
    if (b.frequency === 'yearly') return s + b.amount / 12;
    return s;
  }, 0);

  const overdueBills = bills.filter((b) => differenceInDays(new Date(b.nextDueDate), new Date()) < 0);
  const upcomingBills = bills.filter((b) => {
    const d = differenceInDays(new Date(b.nextDueDate + 'T12:00:00'), new Date());
    return d >= 0 && d <= 7;
  });
  const autoPayBills = bills.filter((b) => b.isAutoPay);

  // Sort bills: overdue first, then by due date
  const sortedBills = [...bills].sort((a, b) => {
    const dA = differenceInDays(new Date(a.nextDueDate), new Date());
    const dB = differenceInDays(new Date(b.nextDueDate), new Date());
    return dA - dB;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Bills & Subscriptions</h1>
          <p className="text-white/40 text-sm mt-1">{bills.length} bills tracked</p>
        </div>
        <button
          onClick={() => { setEditBill(undefined); setShowModal(true); }}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors shadow-lg shadow-violet-500/20"
        >
          <Plus className="w-4 h-4" />
          Add Bill
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Monthly Total', value: `$${totalMonthly.toFixed(0)}`, color: '#8b5cf6', sub: 'per month', icon: RefreshCw },
          { label: 'Annual Total', value: `$${(totalMonthly * 12).toFixed(0)}`, color: '#06b6d4', sub: 'per year', icon: Calendar },
          { label: 'Overdue', value: overdueBills.length.toString(), color: overdueBills.length > 0 ? '#ef4444' : '#22c55e', sub: 'bills', icon: AlertTriangle },
          { label: 'Auto Pay', value: autoPayBills.length.toString(), color: '#f59e0b', sub: `of ${bills.length} bills`, icon: Zap },
        ].map((item) => (
          <div key={item.label} className="bg-[#0d1117] rounded-2xl border border-white/5 p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${item.color}15` }}>
                <item.icon className="w-4 h-4" style={{ color: item.color }} />
              </div>
            </div>
            <p className="text-xl font-bold" style={{ color: item.color }}>{item.value}</p>
            <p className="text-xs text-white/50 mt-0.5">{item.label}</p>
            <p className="text-[10px] text-white/30">{item.sub}</p>
          </div>
        ))}
      </div>

      {/* Due Soon Banner */}
      {upcomingBills.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-4 flex items-center gap-4"
        >
          <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-yellow-300">Bills Due This Week</p>
            <p className="text-xs text-yellow-400/70">
              {upcomingBills.map((b) => b.name).join(', ')} —
              total ${upcomingBills.reduce((s, b) => s + b.amount, 0).toFixed(0)}
            </p>
          </div>
          <div className="ml-auto flex gap-2">
            {upcomingBills.map((b) => (
              <button
                key={b.id}
                onClick={() => markBillPaid(b.id)}
                className="text-xs bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 px-3 py-1.5 rounded-lg border border-yellow-500/20 transition-colors"
              >
                Pay {b.name}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Bills Grid */}
      <div className="grid grid-cols-3 gap-5">
        {sortedBills.map((bill) => (
          <BillCard
            key={bill.id}
            bill={bill}
            onEdit={() => { setEditBill(bill); setShowModal(true); }}
            onDelete={() => deleteBill(bill.id)}
            onMarkPaid={() => markBillPaid(bill.id)}
          />
        ))}
        <motion.button
          whileHover={{ scale: 1.01 }}
          onClick={() => { setEditBill(undefined); setShowModal(true); }}
          className="bg-[#0d1117] rounded-2xl border border-dashed border-white/10 hover:border-violet-500/30 flex flex-col items-center justify-center gap-3 p-8 transition-colors group min-h-48"
        >
          <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <Plus className="w-5 h-5 text-violet-400" />
          </div>
          <p className="text-sm text-white/30 group-hover:text-white/50">Add New Bill</p>
        </motion.button>
      </div>

      <BillModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditBill(undefined); }}
        bill={editBill}
      />
    </div>
  );
}
