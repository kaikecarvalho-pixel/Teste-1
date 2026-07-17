import { useState, useMemo } from "react";
import { Transaction, Category } from "../types";
import { MERCADO_SUB_SUBCATEGORIES } from "../data";
import { motion } from "motion/react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  ShoppingCart, 
  ArrowUpRight, 
  ArrowDownRight,
  Sparkles,
  CalendarDays
} from "lucide-react";

interface DashboardViewProps {
  transactions: Transaction[];
  categories: Category[];
}

export default function DashboardView({ transactions, categories }: DashboardViewProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>("all");

  // Get list of available months in transactions for filtering
  const monthsList = useMemo(() => {
    const months = new Set<string>();
    transactions.forEach((t) => {
      if (t.date) {
        const [year, month] = t.date.split("-");
        if (year && month) {
          months.add(`${year}-${month}`);
        }
      }
    });
    return Array.from(months).sort((a, b) => b.localeCompare(a)); // Sort descending
  }, [transactions]);

  // Format month name for display (e.g. "2026-07" -> "Julho de 2026")
  const formatMonthDisplay = (monthStr: string) => {
    if (monthStr === "all") return "Todo o Período";
    const [year, month] = monthStr.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1, 15);
    return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  };

  // Filter transactions based on selected month
  const filteredTransactions = useMemo(() => {
    if (selectedMonth === "all") return transactions;
    return transactions.filter((t) => t.date.startsWith(selectedMonth));
  }, [transactions, selectedMonth]);

  // Calculate high-level financial metrics
  const stats = useMemo(() => {
    let income = 0;
    let expenses = 0;
    let mercadoTotal = 0;

    filteredTransactions.forEach((t) => {
      if (t.type === "income") {
        income += t.amount;
      } else {
        expenses += t.amount;
        if (t.subcategory === "Mercado") {
          mercadoTotal += t.amount;
        }
      }
    });

    return {
      income,
      expenses,
      balance: income - expenses,
      savingsRate: income > 0 ? Math.round(((income - expenses) / income) * 100) : 0,
      mercadoTotal,
    };
  }, [filteredTransactions]);

  // Calculate expenses by Category for Donut Chart
  const categoryData = useMemo(() => {
    const map: Record<string, { value: number; color: string }> = {};

    filteredTransactions
      .filter((t) => t.type === "expense")
      .forEach((t) => {
        const catObj = categories.find((c) => c.name === t.category);
        const catColor = catObj ? catObj.color : "gray";
        
        if (!map[t.category]) {
          map[t.category] = { value: 0, color: catColor };
        }
        map[t.category].value += t.amount;
      });

    return Object.entries(map)
      .map(([name, data]) => ({
        name,
        value: parseFloat(data.value.toFixed(2)),
        color: data.color,
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTransactions, categories]);

  // Map category color keys to actual Tailwind hex codes
  const getTailwindHexColor = (colorName: string) => {
    const colors: Record<string, string> = {
      emerald: "#0d9488", // transition emerald category color representation to sleek teal
      amber: "#f59e0b",
      blue: "#3b82f6",
      rose: "#f43f5e",
      violet: "#8b5cf6",
      indigo: "#6366f1",
      teal: "#0d9488",
      gray: "#9ca3af",
    };
    return colors[colorName] || colors.gray;
  };

  // Calculate Mercado sub-subcategories details
  const mercadoSubSubData = useMemo(() => {
    const map: Record<string, number> = {};
    MERCADO_SUB_SUBCATEGORIES.forEach((subSub) => {
      map[subSub] = 0;
    });

    filteredTransactions
      .filter((t) => t.subcategory === "Mercado")
      .forEach((t) => {
        const subSub = t.subSubcategory || "Outros";
        if (map[subSub] === undefined) {
          map[subSub] = 0;
        }
        map[subSub] += t.amount;
      });

    return Object.entries(map)
      .map(([name, value]) => ({
        name,
        valor: parseFloat(value.toFixed(2)),
      }))
      .filter((item) => item.valor > 0)
      .sort((a, b) => b.valor - a.valor);
  }, [filteredTransactions]);

  // Calculate daily chart data (last 30 days) for the selected month or period
  const overTimeData = useMemo(() => {
    const dailyMap: Record<string, { income: number; expense: number }> = {};
    
    // Sort transactions by date ascending
    const sorted = [...filteredTransactions].sort((a, b) => a.date.localeCompare(b.date));
    
    sorted.forEach((t) => {
      const dateStr = t.date;
      if (!dailyMap[dateStr]) {
        dailyMap[dateStr] = { income: 0, expense: 0 };
      }
      if (t.type === "income") {
        dailyMap[dateStr].income += t.amount;
      } else {
        dailyMap[dateStr].expense += t.amount;
      }
    });

    // Format for AreaChart
    return Object.entries(dailyMap).map(([date, data]) => {
      const [,, day] = date.split("-");
      return {
        rawDate: date,
        displayName: day ? `${day}/${date.split("-")[1]}` : date,
        Receitas: parseFloat(data.income.toFixed(2)),
        Despesas: parseFloat(data.expense.toFixed(2)),
      };
    }).slice(-15); // Show last 15 active days for better readability
  }, [filteredTransactions]);

  const currencyFormatter = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div className="space-y-6" id="dashboard-view-container">
      {/* Filters and Month Selection */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm no-print">
        <div>
          <h2 className="text-xl font-display font-semibold text-slate-800 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-teal-600" />
            Visão Geral das Finanças
          </h2>
          <p className="text-sm text-slate-500">Acompanhe seu fluxo de caixa e categorize suas despesas</p>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label htmlFor="month-select" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Período:</label>
          <select
            id="month-select"
            className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 p-2.5 outline-none font-medium cursor-pointer"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          >
            <option value="all">Todo o Período</option>
            {monthsList.map((m) => (
              <option key={m} value={m}>
                {formatMonthDisplay(m)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Balance Card */}
        <motion.div 
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between"
          id="kpi-card-balance"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Saldo Líquido</p>
              <h3 className={`text-2xl font-display font-bold mt-1 ${stats.balance >= 0 ? "text-slate-800" : "text-red-600"}`}>
                {currencyFormatter(stats.balance)}
              </h3>
            </div>
            <div className={`p-3 rounded-xl ${stats.balance >= 0 ? "bg-teal-50 text-teal-600" : "bg-red-50 text-red-600"}`}>
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-slate-400">
            {stats.balance >= 0 ? (
              <span className="text-teal-600 font-medium flex items-center gap-1 bg-teal-50 px-1.5 py-0.5 rounded">
                <ArrowUpRight className="w-3.5 h-3.5" /> Positivo
              </span>
            ) : (
              <span className="text-red-600 font-medium flex items-center gap-1 bg-red-50 px-1.5 py-0.5 rounded">
                <ArrowDownRight className="w-3.5 h-3.5" /> Negativo
              </span>
            )}
            <span className="ml-2 font-medium">saldo acumulado do período</span>
          </div>
        </motion.div>

        {/* Income Card */}
        <motion.div 
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between"
          id="kpi-card-income"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total de Receitas</p>
              <h3 className="text-2xl font-display font-bold text-slate-800 mt-1">
                {currencyFormatter(stats.income)}
              </h3>
            </div>
            <div className="p-3 rounded-xl bg-teal-50 text-teal-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-slate-400">
            <span className="text-teal-600 font-medium flex items-center gap-0.5">
              + {currencyFormatter(stats.income)}
            </span>
            <span className="ml-2">entradas registradas</span>
          </div>
        </motion.div>

        {/* Expenses Card */}
        <motion.div 
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between"
          id="kpi-card-expenses"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total de Despesas</p>
              <h3 className="text-2xl font-display font-bold text-slate-800 mt-1">
                {currencyFormatter(stats.expenses)}
              </h3>
            </div>
            <div className="p-3 rounded-xl bg-rose-50 text-rose-600">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-slate-400">
            <span className="text-rose-600 font-medium flex items-center gap-0.5">
              - {currencyFormatter(stats.expenses)}
            </span>
            <span className="ml-2">saídas totais</span>
          </div>
        </motion.div>

        {/* Supermarket Special Detail Card */}
        <motion.div 
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between"
          id="kpi-card-supermarket"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Foco: Mercado 🛒</p>
              <h3 className="text-2xl font-display font-bold text-teal-700 mt-1">
                {currencyFormatter(stats.mercadoTotal)}
              </h3>
            </div>
            <div className="p-3 rounded-xl bg-teal-50 text-teal-700">
              <ShoppingCart className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-slate-400">
            <span className="text-teal-700 font-semibold bg-teal-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
              <Sparkles className="w-3 h-3" />
              {stats.expenses > 0 ? Math.round((stats.mercadoTotal / stats.expenses) * 100) : 0}%
            </span>
            <span className="ml-2">do total das despesas</span>
          </div>
        </motion.div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Area Chart: Cashflow over time */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm lg:col-span-2 flex flex-col justify-between min-h-[380px]" id="chart-cashflow">
          <div>
            <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-1">Evolução Diária do Caixa</h4>
            <p className="text-xs text-slate-400 mb-4">Acompanhamento diário de entradas e saídas no período selecionado</p>
          </div>
          <div className="h-64 w-full">
            {overTimeData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={overTimeData}>
                  <defs>
                    <linearGradient id="colorIncomes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#14b8a6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="displayName" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis 
                    stroke="#94a3b8" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(v) => `R$${v}`} 
                  />
                  <Tooltip 
                    formatter={(v) => currencyFormatter(v as number)}
                    contentStyle={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}
                  />
                  <Area type="monotone" dataKey="Receitas" stroke="#14b8a6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorIncomes)" />
                  <Area type="monotone" dataKey="Despesas" stroke="#f43f5e" strokeWidth={2.5} fillOpacity={1} fill="url(#colorExpenses)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full flex items-center justify-center text-slate-400 text-sm">
                Nenhum dado disponível para gráfico temporal neste período.
              </div>
            )}
          </div>
        </div>

        {/* Pie Chart: Expenses by Category */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col" id="chart-categories">
          <div>
            <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-1">Gastos por Categoria</h4>
            <p className="text-xs text-slate-400 mb-4">Distribuição percentual das despesas</p>
          </div>
          <div className="h-48 w-full relative flex items-center justify-center">
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getTailwindHexColor(entry.color)} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => currencyFormatter(v as number)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-slate-400 text-sm">Nenhum gasto registrado neste período.</div>
            )}
            {categoryData.length > 0 && (
              <div className="absolute flex flex-col items-center">
                <span className="text-xs text-slate-400 uppercase font-semibold">Despesas</span>
                <span className="text-lg font-bold font-display text-slate-800">{currencyFormatter(stats.expenses)}</span>
              </div>
            )}
          </div>
          {/* Custom Legends list */}
          <div className="mt-4 flex-1 overflow-y-auto max-h-[140px] pr-1 space-y-2">
            {categoryData.map((item, index) => (
              <div key={item.name} className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getTailwindHexColor(item.color) }} />
                  <span className="font-medium text-slate-600">{item.name}</span>
                </div>
                <div className="text-slate-800 font-semibold flex items-center gap-1">
                  <span>{currencyFormatter(item.value)}</span>
                  <span className="text-[10px] text-slate-400">
                    ({Math.round((item.value / stats.expenses) * 100)}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Supermarket Sub-Subcategories Detailed Panel */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm" id="chart-supermarket-detail">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Sparkles className="w-4.5 h-4.5 text-teal-600 animate-pulse" />
              Detalhamento de Compras de Mercado 🛒
            </h4>
            <p className="text-xs text-slate-400">Análise automática por inteligência artificial dos itens da nota carioca</p>
          </div>
          {stats.mercadoTotal > 0 && (
            <div className="text-right">
              <span className="text-xs text-slate-400">Total em Mercado:</span>
              <p className="text-lg font-bold font-display text-teal-800">{currencyFormatter(stats.mercadoTotal)}</p>
            </div>
          )}
        </div>

        {mercadoSubSubData.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Horizontal Bar Chart */}
            <div className="h-56 lg:col-span-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={mercadoSubSubData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                  <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v}`} />
                  <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} width={120} />
                  <Tooltip formatter={(v) => currencyFormatter(v as number)} />
                  <Bar dataKey="valor" fill="#0d9488" radius={[0, 8, 8, 0]} maxBarSize={30}>
                    {mercadoSubSubData.map((entry, index) => {
                      const colors = ["#0d9488", "#3b82f6", "#f59e0b", "#f43f5e", "#8b5cf6"];
                      return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Structured detailed list */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col justify-center space-y-3">
              <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Detalhamento dos Itens</h5>
              <div className="space-y-2.5">
                {mercadoSubSubData.map((item, index) => {
                  const percent = stats.mercadoTotal > 0 ? Math.round((item.valor / stats.mercadoTotal) * 100) : 0;
                  const colors = ["bg-teal-500", "bg-blue-500", "bg-amber-500", "bg-rose-500", "bg-violet-500"];
                  return (
                    <div key={item.name} className="space-y-1">
                       <div className="flex justify-between text-xs font-medium text-slate-700">
                        <span>{item.name}</span>
                        <span className="font-bold">{currencyFormatter(item.valor)} ({percent}%)</span>
                      </div>
                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div className={`h-full ${colors[index % colors.length]}`} style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-500 text-sm">
            Nenhuma despesa de Mercado itemizada neste período.
            <br />
            <span className="text-xs text-slate-400 mt-1 block">
              💡 Use a aba <strong>Scanner Inteligente</strong> para escanear uma Nota Carioca ou recibo e ver o detalhamento automático aqui!
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
