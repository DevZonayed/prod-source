'use client';

import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Wallet,
  Target,
  ArrowLeftRight,
  Receipt,
  AlertCircle,
} from 'lucide-react';
import { useFinanceStore, useNetWorth, useCurrentMonthStats, useBudgetProgress } from '@/lib/finance/store';
import { getCategoryInfo } from '@/lib/finance/types';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import Link from 'next/link';
import { cn } from '@/lib/utils';

function KPICard({
  title,
  value,
  change,
  icon: Icon,
  color,
  delay = 0,
}: {
  title: string;
  value: string;
  change?: { value: string; positive: boolean };
  icon: React.ElementType;
  color: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="relative bg-[#0d1117] rounded-2xl border border-white/5 p-5 overflow-hidden group hover:border-white/10 transition-colors"
    >
      <div
        className="absolute inset-0 opacity-5 group-hover:opacity-10 transition-opacity"
        style={{ background: `radial-gradient(ellipse at top right, ${color}, transparent 70%)` }}
      />
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${color}20`, border: `1px solid ${color}30` }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        {change && (
          <div
            className={cn(
              'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg',
              change.positive
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-red-500/10 text-red-400',
            )}
          >
            {change.positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {change.value}
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-white mb-1">{value}</p>
      <p className="text-sm text-white/40">{title}</p>
    </motion.div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1a1f2e] border border-white/10 rounded-xl p-3 shadow-2xl">
        <p className="text-xs text-white/50 mb-2">{label}</p>
        {payload.map((p: any, i: number) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-white/70">{p.name}:</span>
            <span className="text-white font-medium">${p.value?.toLocaleString()}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function FinanceDashboard() {
  const { transactions, accounts, bills, goals } = useFinanceStore();
  const netWorth = useNetWorth();
  const { income, expenses, net } = useCurrentMonthStats();
  const budgets = useBudgetProgress();

  // Last 6 months chart data
  const monthlyData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const date = subMonths(new Date(), 5 - i);
      const monthStr = format(date, 'yyyy-MM');
      const monthTxs = transactions.filter((t) => t.date.startsWith(monthStr));
      const inc = monthTxs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const exp = monthTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      return {
        month: format(date, 'MMM'),
        Income: Math.round(inc),
        Expenses: Math.round(exp),
        Savings: Math.round(inc - exp),
      };
    });
  }, [transactions]);

  // Category breakdown for pie chart
  const categoryData = useMemo(() => {
    const now = new Date();
    const monthStr = format(now, 'yyyy-MM');
    const monthExpenses = transactions.filter(
      (t) => t.type === 'expense' && t.date.startsWith(monthStr),
    );
    const catMap: Record<string, number> = {};
    monthExpenses.forEach((t) => {
      catMap[t.category] = (catMap[t.category] || 0) + t.amount;
    });
    return Object.entries(catMap)
      .map(([name, value]) => ({
        name,
        value: Math.round(value),
        color: getCategoryInfo(name).color,
        icon: getCategoryInfo(name).icon,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [transactions]);

  // Recent transactions
  const recentTxs = useMemo(() => transactions.slice(0, 8), [transactions]);

  // Upcoming bills
  const upcomingBills = useMemo(
    () =>
      bills
        .sort((a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime())
        .slice(0, 5),
    [bills],
  );

  const totalBillsThisMonth = bills.reduce((s, b) => s + b.amount, 0);
  const overdueGoals = goals.filter((g) => !g.isCompleted && new Date(g.deadline) < new Date()).length;

  const savings = income - expenses;
  const savingsRate = income > 0 ? ((savings / income) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Good morning, John 👋</h1>
          <p className="text-white/40 text-sm mt-1">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <Link
          href="/finance/transactions"
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors shadow-lg shadow-violet-500/20"
        >
          <ArrowLeftRight className="w-4 h-4" />
          Add Transaction
        </Link>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard
          title="Net Worth"
          value={`$${(netWorth / 1000).toFixed(1)}k`}
          change={{ value: '+12.4%', positive: true }}
          icon={DollarSign}
          color="#8b5cf6"
          delay={0}
        />
        <KPICard
          title="Monthly Income"
          value={`$${income.toLocaleString()}`}
          change={{ value: '+8.2%', positive: true }}
          icon={TrendingUp}
          color="#22c55e"
          delay={0.05}
        />
        <KPICard
          title="Monthly Expenses"
          value={`$${expenses.toLocaleString()}`}
          change={{ value: '+3.1%', positive: false }}
          icon={TrendingDown}
          color="#ef4444"
          delay={0.1}
        />
        <KPICard
          title="Savings Rate"
          value={`${savingsRate}%`}
          change={{ value: savings >= 0 ? `+$${savings.toLocaleString()}` : `-$${Math.abs(savings).toLocaleString()}`, positive: savings >= 0 }}
          icon={Wallet}
          color="#f59e0b"
          delay={0.15}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-3 gap-6">
        {/* Income vs Expenses Area Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="col-span-2 bg-[#0d1117] rounded-2xl border border-white/5 p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-semibold text-white">Cash Flow</h2>
              <p className="text-xs text-white/40 mt-0.5">Last 6 months overview</p>
            </div>
            <div className="flex gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-1 rounded bg-violet-500" />
                <span className="text-white/50">Income</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-1 rounded bg-red-500" />
                <span className="text-white/50">Expenses</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-1 rounded bg-emerald-500" />
                <span className="text-white/50">Savings</span>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthlyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="savingsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="month" tick={{ fill: '#ffffff40', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#ffffff40', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="Income" stroke="#8b5cf6" strokeWidth={2} fill="url(#incomeGrad)" />
              <Area type="monotone" dataKey="Expenses" stroke="#ef4444" strokeWidth={2} fill="url(#expenseGrad)" />
              <Area type="monotone" dataKey="Savings" stroke="#22c55e" strokeWidth={2} fill="url(#savingsGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Spending by Category */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-[#0d1117] rounded-2xl border border-white/5 p-6"
        >
          <div className="mb-4">
            <h2 className="font-semibold text-white">Spending</h2>
            <p className="text-xs text-white/40 mt-0.5">This month by category</p>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={72}
                paddingAngle={3}
                dataKey="value"
              >
                {categoryData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: '#1a1f2e',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '12px',
                }}
                formatter={(v: any) => [`$${Number(v).toLocaleString()}`, '']}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {categoryData.slice(0, 4).map((cat) => (
              <div key={cat.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                  <span className="text-xs text-white/60">{cat.icon} {cat.name}</span>
                </div>
                <span className="text-xs font-medium text-white">${cat.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-3 gap-6">
        {/* Recent Transactions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="col-span-2 bg-[#0d1117] rounded-2xl border border-white/5 p-6"
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold text-white">Recent Transactions</h2>
              <p className="text-xs text-white/40 mt-0.5">Latest activity</p>
            </div>
            <Link href="/finance/transactions" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
              View all →
            </Link>
          </div>
          <div className="space-y-3">
            {recentTxs.map((tx, i) => {
              const catInfo = getCategoryInfo(tx.category);
              const account = accounts.find((a) => a.id === tx.accountId);
              return (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.03 }}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/3 transition-colors"
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                    style={{ backgroundColor: `${catInfo.color}15`, border: `1px solid ${catInfo.color}20` }}
                  >
                    {catInfo.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{tx.description}</p>
                    <p className="text-xs text-white/40">
                      {account?.name} · {tx.date}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p
                      className={cn(
                        'text-sm font-semibold',
                        tx.type === 'income' ? 'text-emerald-400' : tx.type === 'transfer' ? 'text-blue-400' : 'text-white',
                      )}
                    >
                      {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}${tx.amount.toLocaleString()}
                    </p>
                    <span
                      className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded-md',
                        tx.type === 'income'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : tx.type === 'transfer'
                          ? 'bg-blue-500/10 text-blue-400'
                          : 'bg-white/5 text-white/40',
                      )}
                    >
                      {tx.type}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Right column: Budget overview + Upcoming bills */}
        <div className="space-y-6">
          {/* Budget Overview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-[#0d1117] rounded-2xl border border-white/5 p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white text-sm">Budget Status</h2>
              <Link href="/finance/budgets" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
                Manage →
              </Link>
            </div>
            <div className="space-y-3">
              {budgets.slice(0, 4).map((b) => (
                <div key={b.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-white/60">{b.icon} {b.category}</span>
                    <span className="text-xs text-white/50">${b.spent.toFixed(0)}/${b.amount}</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${b.percentage}%` }}
                      transition={{ delay: 0.4, duration: 0.6, ease: 'easeOut' }}
                      className="h-full rounded-full transition-colors"
                      style={{
                        backgroundColor:
                          b.percentage > 90 ? '#ef4444' : b.percentage > 70 ? '#f59e0b' : b.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Upcoming Bills */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-[#0d1117] rounded-2xl border border-white/5 p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white text-sm">Upcoming Bills</h2>
              <Link href="/finance/bills" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
                View all →
              </Link>
            </div>
            <div className="space-y-2.5">
              {upcomingBills.slice(0, 4).map((bill) => {
                const daysUntil = Math.ceil(
                  (new Date(bill.nextDueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
                );
                const isUrgent = daysUntil <= 3;
                return (
                  <div key={bill.id} className="flex items-center gap-3">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-xs flex-shrink-0"
                      style={{ backgroundColor: `${bill.color}15` }}
                    >
                      {bill.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{bill.name}</p>
                      <p className={cn('text-[10px]', isUrgent ? 'text-red-400' : 'text-white/40')}>
                        {daysUntil <= 0 ? 'Due today!' : daysUntil === 1 ? 'Due tomorrow' : `Due in ${daysUntil}d`}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-white">${bill.amount}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
              <span className="text-xs text-white/40">Monthly total</span>
              <span className="text-sm font-bold text-white">${totalBillsThisMonth.toLocaleString()}</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Accounts Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="bg-[#0d1117] rounded-2xl border border-white/5 p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-semibold text-white">Accounts</h2>
            <p className="text-xs text-white/40 mt-0.5">All linked accounts</p>
          </div>
          <Link href="/finance/accounts" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
            Manage →
          </Link>
        </div>
        <div className="grid grid-cols-5 gap-4">
          {accounts.map((acc, i) => (
            <motion.div
              key={acc.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.45 + i * 0.05 }}
              className="p-4 rounded-xl border transition-colors hover:border-white/15 cursor-pointer"
              style={{
                backgroundColor: `${acc.color}08`,
                borderColor: `${acc.color}20`,
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{acc.icon}</span>
                <span
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded-md capitalize"
                  style={{ backgroundColor: `${acc.color}20`, color: acc.color }}
                >
                  {acc.type}
                </span>
              </div>
              <p className="text-xs text-white/50 truncate mb-1">{acc.name}</p>
              <p
                className={cn(
                  'text-base font-bold',
                  acc.balance < 0 ? 'text-red-400' : 'text-white',
                )}
              >
                {acc.balance < 0 ? '-' : ''}${Math.abs(acc.balance).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
              {acc.type === 'credit' && acc.creditLimit && (
                <div className="mt-2">
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(Math.abs(acc.balance) / acc.creditLimit) * 100}%`,
                        backgroundColor: acc.color,
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-white/30 mt-1">
                    {((Math.abs(acc.balance) / acc.creditLimit) * 100).toFixed(0)}% used
                  </p>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
