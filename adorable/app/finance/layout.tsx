'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  PiggyBank,
  Target,
  BarChart3,
  Receipt,
  TrendingUp,
  Settings,
  ChevronRight,
  Bell,
  Search,
  Moon,
} from 'lucide-react';
import { useNetWorth, useCurrentMonthStats } from '@/lib/finance/store';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/finance', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/finance/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/finance/accounts', label: 'Accounts', icon: Wallet },
  { href: '/finance/budgets', label: 'Budgets', icon: PiggyBank },
  { href: '/finance/goals', label: 'Goals', icon: Target },
  { href: '/finance/reports', label: 'Reports', icon: BarChart3 },
  { href: '/finance/bills', label: 'Bills', icon: Receipt },
];

function Sidebar() {
  const pathname = usePathname();
  const netWorth = useNetWorth();
  const { income, expenses } = useCurrentMonthStats();

  return (
    <aside className="w-64 flex-shrink-0 h-screen bg-[#0d1117] border-r border-white/5 flex flex-col sticky top-0">
      {/* Logo */}
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-white text-sm leading-none">FinanceOS</h1>
            <p className="text-[10px] text-white/40 mt-0.5">Personal Finance</p>
          </div>
        </div>
      </div>

      {/* Net Worth Card */}
      <div className="mx-4 mt-4 p-4 rounded-2xl bg-gradient-to-br from-violet-600/20 to-indigo-600/10 border border-violet-500/20">
        <p className="text-xs text-white/50 mb-1">Net Worth</p>
        <p className="text-xl font-bold text-white">
          ${netWorth.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        </p>
        <div className="flex gap-3 mt-2">
          <div>
            <p className="text-[10px] text-emerald-400/70">Income</p>
            <p className="text-xs font-semibold text-emerald-400">${income.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] text-red-400/70">Expenses</p>
            <p className="text-xs font-semibold text-red-400">${expenses.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest px-3 mb-2">Menu</p>
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/finance' && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}>
              <motion.div
                whileHover={{ x: 2 }}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer',
                  isActive
                    ? 'bg-violet-500/15 text-violet-300 border border-violet-500/20'
                    : 'text-white/50 hover:text-white/80 hover:bg-white/5',
                )}
              >
                <item.icon className={cn('w-4 h-4', isActive ? 'text-violet-400' : '')} />
                {item.label}
                {isActive && <ChevronRight className="w-3 h-3 ml-auto text-violet-400/60" />}
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="p-4 border-t border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-xs font-bold text-white">
            J
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">John Doe</p>
            <p className="text-[10px] text-white/40 truncate">john@example.com</p>
          </div>
          <Settings className="w-4 h-4 text-white/30 hover:text-white/60 cursor-pointer transition-colors" />
        </div>
      </div>
    </aside>
  );
}

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#080c12] text-white" style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {/* Top bar */}
        <div className="sticky top-0 z-10 bg-[#080c12]/80 backdrop-blur-xl border-b border-white/5 px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-2 w-72 border border-white/5">
            <Search className="w-4 h-4 text-white/30" />
            <span className="text-sm text-white/30">Search transactions...</span>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors border border-white/5">
              <Bell className="w-4 h-4 text-white/50" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-violet-500 rounded-full" />
            </button>
            <button className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors border border-white/5">
              <Moon className="w-4 h-4 text-white/50" />
            </button>
          </div>
        </div>
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
