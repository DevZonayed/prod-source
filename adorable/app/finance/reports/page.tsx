'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart2,
  TrendingUp,
  TrendingDown,
  PieChart as PieChartIcon,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { useFinanceStore } from '@/lib/finance/store';
import { getCategoryInfo } from '@/lib/finance/types';
import { cn } from '@/lib/utils';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import { format, subMonths, eachMonthOfInterval, startOfMonth, endOfMonth } from 'date-fns';

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

type Period = '3m' | '6m' | '12m' | 'ytd';

export default function ReportsPage() {
  const { transactions, accounts } = useFinanceStore();
  const [period, setPeriod] = useState<Period>('6m');
  const [activeTab, setActiveTab] = useState<'overview' | 'income' | 'expenses' | 'networth'>('overview');

  const monthCount = period === '3m' ? 3 : period === '6m' ? 6 : period === 'ytd' ? new Date().getMonth() + 1 : 12;

  // Monthly trend data
  const monthlyData = useMemo(() => {
    return Array.from({ length: monthCount }, (_, i) => {
      const date = subMonths(new Date(), monthCount - 1 - i);
      const monthStr = format(date, 'yyyy-MM');
      const monthTxs = transactions.filter((t) => t.date.startsWith(monthStr));
      const income = monthTxs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const expenses = monthTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      return {
        month: format(date, 'MMM yy'),
        Income: Math.round(income),
        Expenses: Math.round(expenses),
        Savings: Math.round(income - expenses),
        'Net Change': Math.round(income - expenses),
      };
    });
  }, [transactions, monthCount]);

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const cutoff = subMonths(new Date(), monthCount);
    const filtered = transactions.filter(
      (t) => t.type === 'expense' && new Date(t.date) >= cutoff,
    );
    const catMap: Record<string, number> = {};
    filtered.forEach((t) => {
      catMap[t.category] = (catMap[t.category] || 0) + t.amount;
    });
    const total = Object.values(catMap).reduce((s, v) => s + v, 0);
    return Object.entries(catMap)
      .map(([name, value]) => ({
        name,
        value: Math.round(value),
        pct: ((value / total) * 100).toFixed(1),
        color: getCategoryInfo(name).color,
        icon: getCategoryInfo(name).icon,
      }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, monthCount]);

  // Income breakdown
  const incomeBreakdown = useMemo(() => {
    const cutoff = subMonths(new Date(), monthCount);
    const filtered = transactions.filter(
      (t) => t.type === 'income' && new Date(t.date) >= cutoff,
    );
    const catMap: Record<string, number> = {};
    filtered.forEach((t) => {
      catMap[t.category] = (catMap[t.category] || 0) + t.amount;
    });
    const total = Object.values(catMap).reduce((s, v) => s + v, 0);
    return Object.entries(catMap)
      .map(([name, value]) => ({
        name,
        value: Math.round(value),
        pct: ((value / total) * 100).toFixed(1),
        color: getCategoryInfo(name).color,
        icon: getCategoryInfo(name).icon,
      }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, monthCount]);

  // Summary stats
  const totalIncome = monthlyData.reduce((s, m) => s + m.Income, 0);
  const totalExpenses = monthlyData.reduce((s, m) => s + m.Expenses, 0);
  const totalSavings = totalIncome - totalExpenses;
  const avgMonthlyExpense = Math.round(totalExpenses / monthCount);
  const avgMonthlyIncome = Math.round(totalIncome / monthCount);
  const savingsRate = totalIncome > 0 ? ((totalSavings / totalIncome) * 100).toFixed(1) : '0';

  // Radar data for spending pattern
  const radarData = useMemo(() => {
    const top6 = categoryBreakdown.slice(0, 6);
    const maxVal = Math.max(...top6.map((c) => c.value));
    return top6.map((c) => ({
      category: c.name.split(' ')[0],
      value: Math.round((c.value / maxVal) * 100),
      amount: c.value,
    }));
  }, [categoryBreakdown]);

  // Day of week spending pattern
  const dayOfWeekData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayMap: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    transactions
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        const dow = new Date(t.date + 'T12:00:00').getDay();
        dayMap[dow] += t.amount;
      });
    return days.map((day, i) => ({ day, amount: Math.round(dayMap[i]) }));
  }, [transactions]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Reports & Analytics</h1>
          <p className="text-white/40 text-sm mt-1">Deep dive into your financial health</p>
        </div>
        {/* Period selector */}
        <div className="flex gap-1 bg-white/5 rounded-xl p-1 border border-white/5">
          {(['3m', '6m', 'ytd', '12m'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium uppercase transition-all',
                period === p ? 'bg-violet-600 text-white' : 'text-white/40 hover:text-white/70',
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Income', value: `$${totalIncome.toLocaleString()}`, color: '#22c55e', sub: `Avg $${avgMonthlyIncome.toLocaleString()}/mo`, icon: TrendingUp },
          { label: 'Total Expenses', value: `$${totalExpenses.toLocaleString()}`, color: '#ef4444', sub: `Avg $${avgMonthlyExpense.toLocaleString()}/mo`, icon: TrendingDown },
          { label: 'Net Savings', value: `$${Math.abs(totalSavings).toLocaleString()}`, color: totalSavings >= 0 ? '#8b5cf6' : '#f59e0b', sub: totalSavings >= 0 ? 'Saved' : 'Deficit', icon: BarChart2 },
          { label: 'Savings Rate', value: `${savingsRate}%`, color: '#f59e0b', sub: 'of gross income', icon: PieChartIcon },
        ].map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-[#0d1117] rounded-2xl border border-white/5 p-5"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${item.color}15` }}>
                <item.icon className="w-4 h-4" style={{ color: item.color }} />
              </div>
            </div>
            <p className="text-xl font-bold" style={{ color: item.color }}>{item.value}</p>
            <p className="text-xs text-white/50 mt-0.5">{item.label}</p>
            <p className="text-[10px] text-white/30 mt-0.5">{item.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-2 gap-6">
        {/* Income vs Expenses Bar Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-[#0d1117] rounded-2xl border border-white/5 p-6"
        >
          <h3 className="font-semibold text-white mb-1">Income vs Expenses</h3>
          <p className="text-xs text-white/40 mb-5">Monthly comparison</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData} margin={{ left: -20, right: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="month" tick={{ fill: '#ffffff40', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#ffffff40', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Income" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Savings Trend */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-[#0d1117] rounded-2xl border border-white/5 p-6"
        >
          <h3 className="font-semibold text-white mb-1">Savings Trend</h3>
          <p className="text-xs text-white/40 mb-5">Monthly net savings</p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthlyData} margin={{ left: -20, right: 0 }}>
              <defs>
                <linearGradient id="savingsGrad2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="month" tick={{ fill: '#ffffff40', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#ffffff40', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="Savings"
                stroke="#22c55e"
                strokeWidth={2}
                fill="url(#savingsGrad2)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Category Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-[#0d1117] rounded-2xl border border-white/5 p-6"
        >
          <h3 className="font-semibold text-white mb-1">Expense Breakdown</h3>
          <p className="text-xs text-white/40 mb-5">By category for {period}</p>
          <div className="flex gap-4">
            <ResponsiveContainer width="50%" height={200}>
              <PieChart>
                <Pie
                  data={categoryBreakdown.slice(0, 8)}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {categoryBreakdown.slice(0, 8).map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#1a1f2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                  formatter={(v: any) => [`$${Number(v).toLocaleString()}`, '']}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2 overflow-y-auto max-h-48">
              {categoryBreakdown.slice(0, 8).map((cat) => (
                <div key={cat.name} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="text-xs text-white/60 truncate">{cat.icon} {cat.name}</span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-xs font-medium text-white">${cat.value.toLocaleString()}</span>
                    <span className="text-[10px] text-white/30 block">{cat.pct}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Day of week spending */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-[#0d1117] rounded-2xl border border-white/5 p-6"
        >
          <h3 className="font-semibold text-white mb-1">Spending by Day</h3>
          <p className="text-xs text-white/40 mb-5">Which days you spend most</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dayOfWeekData} margin={{ left: -20, right: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="day" tick={{ fill: '#ffffff40', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#ffffff40', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: '#1a1f2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                formatter={(v: any) => [`$${Number(v).toLocaleString()}`, 'Spent']}
              />
              <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                {dayOfWeekData.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={index === 0 || index === 6 ? '#f59e0b' : '#8b5cf6'}
                    opacity={0.7 + (entry.amount / Math.max(...dayOfWeekData.map((d) => d.amount))) * 0.3}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Top Expense Categories Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-[#0d1117] rounded-2xl border border-white/5 p-6"
      >
        <h3 className="font-semibold text-white mb-5">Top Spending Categories</h3>
        <div className="space-y-3">
          {categoryBreakdown.map((cat, i) => {
            const maxVal = categoryBreakdown[0]?.value ?? 1;
            const barWidth = (cat.value / maxVal) * 100;
            return (
              <motion.div
                key={cat.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 + 0.4 }}
                className="flex items-center gap-4"
              >
                <div className="flex items-center gap-2 w-40 flex-shrink-0">
                  <span className="text-base">{cat.icon}</span>
                  <span className="text-sm text-white/70 truncate">{cat.name}</span>
                </div>
                <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${barWidth}%` }}
                    transition={{ delay: i * 0.03 + 0.5, duration: 0.5 }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                </div>
                <div className="w-24 text-right flex-shrink-0">
                  <span className="text-sm font-medium text-white">${cat.value.toLocaleString()}</span>
                  <span className="text-xs text-white/30 ml-1">({cat.pct}%)</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Income Sources */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-[#0d1117] rounded-2xl border border-white/5 p-6"
      >
        <h3 className="font-semibold text-white mb-5">Income Sources</h3>
        <div className="grid grid-cols-2 gap-4">
          {incomeBreakdown.map((src, i) => (
            <div key={src.name} className="flex items-center gap-4 p-4 rounded-xl bg-white/3 border border-white/5">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ backgroundColor: `${src.color}15` }}
              >
                {src.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{src.name}</p>
                <p className="text-xs text-white/40">{src.pct}% of income</p>
              </div>
              <p className="text-base font-bold text-emerald-400">${src.value.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
