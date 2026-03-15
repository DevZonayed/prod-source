'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Target,
  Trash2,
  Edit3,
  X,
  CheckCircle2,
  Clock,
  TrendingUp,
  DollarSign,
} from 'lucide-react';
import { useFinanceStore } from '@/lib/finance/store';
import { Goal } from '@/lib/finance/types';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow, isPast, differenceInDays } from 'date-fns';

const GOAL_CATEGORIES = [
  { value: 'emergency', label: 'Emergency Fund', icon: '🛡️', color: '#ef4444' },
  { value: 'vacation', label: 'Vacation', icon: '🏖️', color: '#06b6d4' },
  { value: 'purchase', label: 'Big Purchase', icon: '🛒', color: '#8b5cf6' },
  { value: 'retirement', label: 'Retirement', icon: '🌴', color: '#22c55e' },
  { value: 'education', label: 'Education', icon: '🎓', color: '#3b82f6' },
  { value: 'home', label: 'Home', icon: '🏡', color: '#f59e0b' },
  { value: 'other', label: 'Other', icon: '⭐', color: '#a855f7' },
] as const;

const GOAL_ICONS = ['🛡️', '🏖️', '💻', '🚗', '🏡', '🎓', '💍', '✈️', '🌴', '💰', '🎯', '⭐'];

function AddFundsModal({
  isOpen,
  onClose,
  goal,
}: {
  isOpen: boolean;
  onClose: () => void;
  goal: Goal;
}) {
  const { updateGoal } = useFinanceStore();
  const [amount, setAmount] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newAmount = goal.currentAmount + parseFloat(amount);
    const isCompleted = newAmount >= goal.targetAmount;
    updateGoal(goal.id, { currentAmount: Math.min(newAmount, goal.targetAmount), isCompleted });
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
          className="bg-[#0d1117] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl mx-4"
        >
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-white">Add Funds to Goal</h3>
            <button onClick={onClose} className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
              <X className="w-4 h-4 text-white/50" />
            </button>
          </div>
          <div className="mb-4 p-3 rounded-xl bg-white/3 border border-white/5">
            <p className="text-xs text-white/40 mb-0.5">Goal</p>
            <p className="text-sm font-medium text-white">{goal.name}</p>
            <p className="text-xs text-white/40 mt-1">
              ${goal.currentAmount.toLocaleString()} / ${goal.targetAmount.toLocaleString()}
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-white/50 mb-1.5 block">Amount to Add</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 font-bold">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  autoFocus
                  placeholder="0.00"
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-4 py-3 text-white text-lg font-bold placeholder:text-white/20 focus:outline-none focus:border-violet-500/50"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/60 text-sm border border-white/5">Cancel</button>
              <button type="submit" className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium shadow-lg shadow-violet-500/20">Add Funds</button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function GoalModal({ isOpen, onClose, goal }: { isOpen: boolean; onClose: () => void; goal?: Goal }) {
  const { addGoal, updateGoal } = useFinanceStore();
  const [form, setForm] = useState({
    name: goal?.name ?? '',
    description: goal?.description ?? '',
    targetAmount: goal?.targetAmount?.toString() ?? '',
    currentAmount: goal?.currentAmount?.toString() ?? '0',
    deadline: goal?.deadline ?? '',
    category: goal?.category ?? 'other' as Goal['category'],
    icon: goal?.icon ?? '⭐',
    color: goal?.color ?? '#a855f7',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const catInfo = GOAL_CATEGORIES.find((c) => c.value === form.category);
    const data = {
      name: form.name,
      description: form.description,
      targetAmount: parseFloat(form.targetAmount),
      currentAmount: parseFloat(form.currentAmount),
      deadline: form.deadline,
      category: form.category,
      icon: form.icon || catInfo?.icon || '⭐',
      color: catInfo?.color ?? form.color,
      isCompleted: parseFloat(form.currentAmount) >= parseFloat(form.targetAmount),
    };
    if (goal) updateGoal(goal.id, data);
    else addGoal(data);
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
            <h2 className="text-lg font-semibold text-white">{goal ? 'Edit Goal' : 'New Goal'}</h2>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center">
              <X className="w-4 h-4 text-white/60" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Icon */}
            <div>
              <label className="text-xs font-medium text-white/50 mb-2 block">Icon</label>
              <div className="flex flex-wrap gap-2">
                {GOAL_ICONS.map((emoji) => (
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
              <label className="text-xs font-medium text-white/50 mb-1.5 block">Goal Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Emergency Fund"
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/50 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-white/50 mb-1.5 block">Category</label>
              <div className="grid grid-cols-4 gap-1.5">
                {GOAL_CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, category: cat.value, icon: cat.icon, color: cat.color }))}
                    className={cn(
                      'flex flex-col items-center gap-1 p-2 rounded-xl text-xs transition-all border',
                      form.category === cat.value
                        ? 'border-violet-500/50 bg-violet-500/15 text-white'
                        : 'border-transparent bg-white/5 text-white/50 hover:bg-white/8',
                    )}
                  >
                    <span className="text-base">{cat.icon}</span>
                    <span className="text-[9px] text-center leading-tight">{cat.label.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-white/50 mb-1.5 block">Target Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 font-bold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={form.targetAmount}
                    onChange={(e) => setForm((f) => ({ ...f, targetAmount: e.target.value }))}
                    required
                    placeholder="10000"
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-7 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500/50"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-white/50 mb-1.5 block">Current Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 font-bold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={form.currentAmount}
                    onChange={(e) => setForm((f) => ({ ...f, currentAmount: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-7 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500/50"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-white/50 mb-1.5 block">Target Date</label>
              <input
                type="date"
                value={form.deadline}
                onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                required
                className="w-full bg-[#1a1f2e] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-white/50 mb-1.5 block">Description (optional)</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="What are you saving for?"
                rows={2}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/50 text-sm resize-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/60 text-sm border border-white/5">Cancel</button>
              <button type="submit" className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium shadow-lg shadow-violet-500/20">
                {goal ? 'Update Goal' : 'Create Goal'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function GoalCard({ goal, onEdit, onDelete, onAddFunds }: {
  goal: Goal;
  onEdit: () => void;
  onDelete: () => void;
  onAddFunds: () => void;
}) {
  const pct = (goal.currentAmount / goal.targetAmount) * 100;
  const daysLeft = differenceInDays(new Date(goal.deadline), new Date());
  const isOverdue = daysLeft < 0 && !goal.isCompleted;
  const catInfo = GOAL_CATEGORIES.find((c) => c.value === goal.category);
  const remaining = goal.targetAmount - goal.currentAmount;

  // Monthly savings needed
  const monthlyNeeded = daysLeft > 0 ? (remaining / (daysLeft / 30)).toFixed(0) : '0';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'bg-[#0d1117] rounded-2xl border overflow-hidden group hover:border-white/10 transition-colors',
        goal.isCompleted ? 'border-emerald-500/20' : isOverdue ? 'border-red-500/20' : 'border-white/5',
      )}
    >
      {/* Header */}
      <div
        className="p-5 relative"
        style={{ background: `linear-gradient(135deg, ${goal.color}15, transparent 70%)` }}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
              style={{ backgroundColor: `${goal.color}20`, border: `1px solid ${goal.color}30` }}
            >
              {goal.icon}
            </div>
            <div>
              <p className="font-semibold text-white">{goal.name}</p>
              {goal.description && <p className="text-xs text-white/40 mt-0.5">{goal.description}</p>}
            </div>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={onEdit} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-violet-500/20 flex items-center justify-center">
              <Edit3 className="w-3 h-3 text-white/40 hover:text-violet-400" />
            </button>
            <button onClick={onDelete} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-red-500/20 flex items-center justify-center">
              <Trash2 className="w-3 h-3 text-white/40 hover:text-red-400" />
            </button>
          </div>
        </div>

        {/* Status badge */}
        {goal.isCompleted ? (
          <span className="inline-flex items-center gap-1.5 text-xs bg-emerald-500/15 text-emerald-400 px-2.5 py-1 rounded-lg mb-3 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            Completed! 🎉
          </span>
        ) : isOverdue ? (
          <span className="inline-flex items-center gap-1.5 text-xs bg-red-500/15 text-red-400 px-2.5 py-1 rounded-lg mb-3 border border-red-500/20">
            <Clock className="w-3 h-3" />
            Overdue by {Math.abs(daysLeft)} days
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs bg-white/5 text-white/40 px-2.5 py-1 rounded-lg mb-3">
            <Clock className="w-3 h-3" />
            {daysLeft} days left · {format(new Date(goal.deadline + 'T12:00:00'), 'MMM d, yyyy')}
          </span>
        )}

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-white">${goal.currentAmount.toLocaleString()}</span>
            <span className="text-sm text-white/40">of ${goal.targetAmount.toLocaleString()}</span>
          </div>
          <div className="h-3 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(pct, 100)}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full rounded-full relative"
              style={{
                backgroundColor: goal.isCompleted ? '#22c55e' : goal.color,
                boxShadow: `0 0 12px ${goal.isCompleted ? '#22c55e' : goal.color}40`,
              }}
            />
          </div>
          <p className="text-xs text-white/50">{Math.min(pct, 100).toFixed(1)}% funded</p>
        </div>
      </div>

      {/* Stats */}
      <div className="px-5 py-4 border-t border-white/5 grid grid-cols-3 gap-3">
        <div>
          <p className="text-[10px] text-white/30 mb-0.5">Remaining</p>
          <p className="text-sm font-semibold text-white">${remaining > 0 ? remaining.toLocaleString() : '0'}</p>
        </div>
        <div>
          <p className="text-[10px] text-white/30 mb-0.5">Monthly Need</p>
          <p className="text-sm font-semibold text-white">${monthlyNeeded}</p>
        </div>
        <div>
          <p className="text-[10px] text-white/30 mb-0.5">Progress</p>
          <p className="text-sm font-semibold" style={{ color: goal.color }}>
            {Math.min(pct, 100).toFixed(0)}%
          </p>
        </div>
      </div>

      {/* Add funds button */}
      {!goal.isCompleted && (
        <div className="px-5 pb-4">
          <button
            onClick={onAddFunds}
            className="w-full py-2 rounded-xl text-sm font-medium transition-all border border-white/5 hover:border-opacity-30 text-white/50 hover:text-white bg-white/3 hover:bg-white/8"
            style={{ '--hover-color': goal.color } as any}
          >
            + Add Funds
          </button>
        </div>
      )}
    </motion.div>
  );
}

export default function GoalsPage() {
  const { goals, deleteGoal } = useFinanceStore();
  const [showModal, setShowModal] = useState(false);
  const [showFundsModal, setShowFundsModal] = useState(false);
  const [editGoal, setEditGoal] = useState<Goal | undefined>();
  const [fundsGoal, setFundsGoal] = useState<Goal | undefined>();

  const activeGoals = goals.filter((g) => !g.isCompleted);
  const completedGoals = goals.filter((g) => g.isCompleted);
  const totalTarget = activeGoals.reduce((s, g) => s + g.targetAmount, 0);
  const totalSaved = activeGoals.reduce((s, g) => s + g.currentAmount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Goals</h1>
          <p className="text-white/40 text-sm mt-1">{activeGoals.length} active · {completedGoals.length} completed</p>
        </div>
        <button
          onClick={() => { setEditGoal(undefined); setShowModal(true); }}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors shadow-lg shadow-violet-500/20"
        >
          <Plus className="w-4 h-4" />
          New Goal
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Target', value: `$${totalTarget.toLocaleString()}`, color: '#8b5cf6' },
          { label: 'Total Saved', value: `$${totalSaved.toLocaleString()}`, color: '#22c55e' },
          { label: 'Overall Progress', value: `${totalTarget > 0 ? ((totalSaved / totalTarget) * 100).toFixed(1) : 0}%`, color: '#f59e0b' },
        ].map((item) => (
          <div key={item.label} className="bg-[#0d1117] rounded-2xl border border-white/5 p-5">
            <p className="text-xs text-white/40 mb-2">{item.label}</p>
            <p className="text-2xl font-bold" style={{ color: item.color }}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Active Goals */}
      {activeGoals.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wide mb-4">Active Goals</h2>
          <div className="grid grid-cols-2 gap-5">
            {activeGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onEdit={() => { setEditGoal(goal); setShowModal(true); }}
                onDelete={() => deleteGoal(goal.id)}
                onAddFunds={() => { setFundsGoal(goal); setShowFundsModal(true); }}
              />
            ))}
            <motion.button
              whileHover={{ scale: 1.01 }}
              onClick={() => { setEditGoal(undefined); setShowModal(true); }}
              className="bg-[#0d1117] rounded-2xl border border-dashed border-white/10 hover:border-violet-500/30 flex flex-col items-center justify-center gap-3 p-8 transition-colors group min-h-48"
            >
              <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                <Plus className="w-5 h-5 text-violet-400" />
              </div>
              <p className="text-sm text-white/30 group-hover:text-white/50">Add New Goal</p>
            </motion.button>
          </div>
        </div>
      )}

      {/* Completed Goals */}
      {completedGoals.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wide mb-4">Completed Goals 🎉</h2>
          <div className="grid grid-cols-2 gap-5">
            {completedGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onEdit={() => { setEditGoal(goal); setShowModal(true); }}
                onDelete={() => deleteGoal(goal.id)}
                onAddFunds={() => {}}
              />
            ))}
          </div>
        </div>
      )}

      <GoalModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditGoal(undefined); }}
        goal={editGoal}
      />
      {fundsGoal && (
        <AddFundsModal
          isOpen={showFundsModal}
          onClose={() => { setShowFundsModal(false); setFundsGoal(undefined); }}
          goal={fundsGoal}
        />
      )}
    </div>
  );
}
