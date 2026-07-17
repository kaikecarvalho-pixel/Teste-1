import { useState, useMemo, FormEvent } from "react";
import { RecurringExpense, Category, Transaction } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { 
  CalendarDays, 
  Plus, 
  Trash2, 
  Pencil, 
  CheckCircle2, 
  AlertCircle, 
  DollarSign, 
  CreditCard,
  X,
  HelpCircle,
  PiggyBank,
  TrendingUp
} from "lucide-react";

interface RecurringExpensesViewProps {
  expenses: RecurringExpense[];
  categories: Category[];
  transactions: Transaction[];
  onAddRecurringExpense: (expense: Omit<RecurringExpense, "id" | "paidMonths">) => void;
  onUpdateRecurringExpense: (expense: RecurringExpense) => void;
  onDeleteRecurringExpense: (id: string) => void;
  onPayRecurringExpense: (expenseId: string, monthStr: string) => void;
}

export default function RecurringExpensesView({
  expenses,
  categories,
  transactions,
  onAddRecurringExpense,
  onUpdateRecurringExpense,
  onDeleteRecurringExpense,
  onPayRecurringExpense
}: RecurringExpensesViewProps) {
  // Current month string in format YYYY-MM
  const currentMonthStr = useMemo(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }, []);

  const [activeMonth, setActiveMonth] = useState<string>(currentMonthStr);
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  
  // Custom modal state for deletion
  const [expenseToDelete, setExpenseToDelete] = useState<RecurringExpense | null>(null);

  // Form states for new expense
  const [newDesc, setNewDesc] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newDueDate, setNewDueDate] = useState("5");
  const [newCategory, setNewCategory] = useState("");
  const [newSubcategory, setNewSubcategory] = useState("");
  const [newAutoPay, setNewAutoPay] = useState(false);
  const [newType, setNewType] = useState<"expense" | "income">("expense");
  const [newDurationMonths, setNewDurationMonths] = useState("");

  // Form states for edit expense
  const [editDesc, setEditDesc] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editSubcategory, setEditSubcategory] = useState("");
  const [editAutoPay, setEditAutoPay] = useState(false);
  const [editType, setEditType] = useState<"expense" | "income">("expense");
  const [editDurationMonths, setEditDurationMonths] = useState("");

  // Get cascaded subcategories for new expense
  const newSubcategories = useMemo(() => {
    const cat = categories.find((c) => c.name === newCategory);
    return cat ? cat.subcategories : [];
  }, [categories, newCategory]);

  // Get cascaded subcategories for edit expense
  const editSubcategories = useMemo(() => {
    const cat = categories.find((c) => c.name === editCategory);
    return cat ? cat.subcategories : [];
  }, [categories, editCategory]);

  const handleCategoryChange = (catName: string) => {
    setNewCategory(catName);
    const cat = categories.find((c) => c.name === catName);
    if (cat && cat.subcategories.length > 0) {
      setNewSubcategory(cat.subcategories[0]);
    } else {
      setNewSubcategory("");
    }
  };

  const handleEditCategoryChange = (catName: string) => {
    setEditCategory(catName);
    const cat = categories.find((c) => c.name === catName);
    if (cat && cat.subcategories.length > 0) {
      setEditSubcategory(cat.subcategories[0]);
    } else {
      setEditSubcategory("");
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!newDesc.trim() || !newAmount || !newCategory) {
      alert("Por favor, preencha a descrição, valor e categoria.");
      return;
    }

    onAddRecurringExpense({
      description: newDesc.trim(),
      amount: parseFloat(newAmount),
      dueDate: parseInt(newDueDate) || 5,
      category: newCategory,
      subcategory: newSubcategory,
      autoPay: newAutoPay,
      type: newType,
      durationMonths: newDurationMonths ? parseInt(newDurationMonths) : undefined,
    });

    // Reset form
    setNewDesc("");
    setNewAmount("");
    setNewDueDate("5");
    setNewCategory("");
    setNewSubcategory("");
    setNewAutoPay(false);
    setNewType("expense");
    setNewDurationMonths("");
    setIsAddFormOpen(false);
  };

  const startEdit = (expense: RecurringExpense) => {
    setEditingExpenseId(expense.id);
    setEditDesc(expense.description);
    setEditAmount(expense.amount.toString());
    setEditDueDate(expense.dueDate.toString());
    setEditCategory(expense.category);
    setEditSubcategory(expense.subcategory);
    setEditAutoPay(expense.autoPay || false);
    setEditType(expense.type || "expense");
    setEditDurationMonths(expense.durationMonths ? expense.durationMonths.toString() : "");
  };

  const handleSaveEdit = (e: FormEvent) => {
    e.preventDefault();
    const original = expenses.find((ex) => ex.id === editingExpenseId);
    if (!original) return;

    if (!editDesc.trim() || !editAmount || !editCategory) {
      alert("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    onUpdateRecurringExpense({
      ...original,
      description: editDesc.trim(),
      amount: parseFloat(editAmount),
      dueDate: parseInt(editDueDate) || 5,
      category: editCategory,
      subcategory: editSubcategory,
      autoPay: editAutoPay,
      type: editType,
      durationMonths: editDurationMonths ? parseInt(editDurationMonths) : undefined,
    });

    setEditingExpenseId(null);
  };

  // Helper formatting values
  const currencyFormatter = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // List of available months for tracking (current month and previous/next)
  const monthOptions = useMemo(() => {
    const options: string[] = [];
    const date = new Date();
    // Generate previous 3 months, current, and next 2 months
    for (let i = -3; i <= 2; i++) {
      const d = new Date(date.getFullYear(), date.getMonth() + i, 15);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      options.push(`${year}-${month}`);
    }
    return options;
  }, []);

  const formatMonthName = (monthStr: string) => {
    const [year, month] = monthStr.split("-");
    const d = new Date(parseInt(year), parseInt(month) - 1, 15);
    return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  };

  // Metrics for activeMonth
  const stats = useMemo(() => {
    let totalExpenses = 0;
    let totalIncomes = 0;
    let paidExpenses = 0;
    let paidIncomes = 0;
    
    let paidExpenseCount = 0;
    let paidIncomeCount = 0;
    let totalExpenseCount = 0;
    let totalIncomeCount = 0;

    expenses.forEach((ex) => {
      // Check if item has expired before this activeMonth
      const isPaidThisMonth = ex.paidMonths?.includes(activeMonth);
      const pastPaidMonthsCount = ex.paidMonths?.filter(m => m !== activeMonth).length || 0;
      const hasReachedLimitBeforeActiveMonth = ex.durationMonths && ex.durationMonths > 0 && pastPaidMonthsCount >= ex.durationMonths;

      if (hasReachedLimitBeforeActiveMonth) return;

      const isExpense = (ex.type || "expense") === "expense";
      
      if (isExpense) {
        totalExpenses += ex.amount;
        totalExpenseCount++;
        if (isPaidThisMonth) {
          paidExpenses += ex.amount;
          paidExpenseCount++;
        }
      } else {
        totalIncomes += ex.amount;
        totalIncomeCount++;
        if (isPaidThisMonth) {
          paidIncomes += ex.amount;
          paidIncomeCount++;
        }
      }
    });

    const pendingExpenses = totalExpenses - paidExpenses;
    const pendingIncomes = totalIncomes - paidIncomes;
    
    const totalCount = totalExpenseCount + totalIncomeCount;
    const paidCount = paidExpenseCount + paidIncomeCount;
    const progress = totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0;

    return {
      totalExpenses,
      totalIncomes,
      paidExpenses,
      paidIncomes,
      pendingExpenses,
      pendingIncomes,
      totalExpenseCount,
      totalIncomeCount,
      paidExpenseCount,
      paidIncomeCount,
      totalCount,
      paidCount,
      progress
    };
  }, [expenses, activeMonth]);

  // Color mapped category indicator
  const getCategoryColorClass = (catName: string) => {
    const cat = categories.find((c) => c.name === catName);
    if (!cat) return "bg-slate-100 text-slate-700 border-slate-200";
    const colors: Record<string, string> = {
      emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
      amber: "bg-amber-50 text-amber-700 border-amber-100",
      blue: "bg-blue-50 text-blue-700 border-blue-100",
      rose: "bg-rose-50 text-rose-700 border-rose-100",
      violet: "bg-violet-50 text-violet-700 border-violet-100",
      indigo: "bg-indigo-50 text-indigo-700 border-indigo-100",
      teal: "bg-teal-50 text-teal-700 border-teal-100",
    };
    return colors[cat.color] || "bg-slate-100 text-slate-700 border-slate-200";
  };

  return (
    <div className="space-y-6" id="recurring-expenses-view-root">
      
      {/* View Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-extrabold text-slate-800 tracking-tight">
            Gastos Mensais & Contas Fixas
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Cadastre seus compromissos recorrentes (aluguel, condomínio, assinaturas) e dê baixa mensalmente com 1 clique.
          </p>
        </div>

        {/* Month Selector & Add Button */}
        <div className="flex items-center gap-3 self-start md:self-center">
          <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-xs">
            <CalendarDays className="w-4 h-4 text-slate-400" />
            <select
              value={activeMonth}
              onChange={(e) => setActiveMonth(e.target.value)}
              className="text-xs font-bold text-slate-700 bg-transparent focus:outline-none cursor-pointer capitalize"
            >
              {monthOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {formatMonthName(opt)}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setIsAddFormOpen(true)}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nova Conta
          </button>
        </div>
      </div>

      {/* Recorrente Stats Summary Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        {/* Total Cost card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100/50">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Despesas Recorrentes</span>
            <span className="text-xl font-display font-black text-rose-600 mt-0.5 block leading-none">
              {currencyFormatter(stats.totalExpenses)}
            </span>
            <span className="text-[10px] text-slate-400 block mt-1">
              {stats.totalExpenseCount} compromissos • {currencyFormatter(stats.pendingExpenses)} pendente
            </span>
          </div>
        </div>

        {/* Total Income card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100/50">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Receitas Recorrentes</span>
            <span className="text-xl font-display font-black text-emerald-600 mt-0.5 block leading-none">
              {currencyFormatter(stats.totalIncomes)}
            </span>
            <span className="text-[10px] text-slate-400 block mt-1">
              {stats.totalIncomeCount} receitas • {currencyFormatter(stats.pendingIncomes)} a receber
            </span>
          </div>
        </div>

        {/* Total paid card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-teal-50 text-teal-600 border border-teal-100/50">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider font-semibold">Lançamentos do Mês</span>
            <div className="space-y-0.5 mt-0.5">
              <span className="text-[11px] font-semibold text-slate-700 block">
                Pagas: <strong className="text-rose-600 font-mono">{currencyFormatter(stats.paidExpenses)}</strong> ({stats.paidExpenseCount}/{stats.totalExpenseCount})
              </span>
              <span className="text-[11px] font-semibold text-slate-700 block">
                Recebidas: <strong className="text-emerald-600 font-mono">{currencyFormatter(stats.paidIncomes)}</strong> ({stats.paidIncomeCount}/{stats.totalIncomeCount})
              </span>
            </div>
          </div>
        </div>

        {/* Progress gauge card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-center">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Progresso do Mês</span>
            <span className="text-xs font-mono font-black text-slate-700">{stats.progress}%</span>
          </div>
          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200/50">
            <motion.div 
              className="bg-teal-500 h-full rounded-full" 
              initial={{ width: 0 }}
              animate={{ width: `${stats.progress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
          <span className="text-[9px] text-slate-400 block mt-1.5 italic text-center">
            {stats.progress === 100 ? "🎉 Tudo concluído este mês!" : "Marque os itens para lançar transações"}
          </span>
        </div>

      </div>

      {/* Add New Recurring Expense Modal */}
      <AnimatePresence>
        {isAddFormOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-3xl shadow-xl overflow-hidden border border-slate-100 text-left"
            >
              <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-teal-400" />
                  <span className="font-display font-extrabold text-base tracking-tight">Cadastrar Gasto Mensal</span>
                </div>
                <button 
                  onClick={() => setIsAddFormOpen(false)}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Descrição / Nome da Conta</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Aluguel do Apartamento, Mensalidade Academia, Netflix"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm font-medium bg-white text-slate-800"
                  />
                </div>

                {/* Type Selector: Despesa vs Receita */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Tipo de Lançamento</label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => {
                        setNewType("expense");
                        setNewCategory("");
                        setNewSubcategory("");
                      }}
                      className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                        newType === "expense"
                          ? "bg-rose-500 text-white shadow-xs"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Despesa Recorrente
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNewType("income");
                        setNewCategory("");
                        setNewSubcategory("");
                      }}
                      className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                        newType === "income"
                          ? "bg-emerald-500 text-white shadow-xs"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Receita Recorrente
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Amount */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Valor Estimado (R$)</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2.5 text-xs font-bold text-slate-400 font-mono">R$</span>
                      <input
                        type="number"
                        required
                        step="0.01"
                        placeholder="0,00"
                        value={newAmount}
                        onChange={(e) => setNewAmount(e.target.value)}
                        className="w-full pl-9 pr-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm font-bold bg-white text-slate-800 font-mono"
                      />
                    </div>
                  </div>

                  {/* Due Date Day & Duration Limit */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Dia de Lançamento</label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="31"
                      placeholder="Ex: 5, 10, 20"
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm font-semibold bg-white text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Category */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Categoria</label>
                    <select
                      value={newCategory}
                      onChange={(e) => handleCategoryChange(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm cursor-pointer"
                      required
                    >
                      <option value="">Selecione...</option>
                      {categories
                        .filter((c) => {
                          const cType = c.type || "expense";
                          return newType === "income" ? cType === "income" : cType === "expense";
                        })
                        .map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Subcategory */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Subcategoria</label>
                    <select
                      value={newSubcategory}
                      onChange={(e) => setNewSubcategory(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm cursor-pointer disabled:bg-slate-50 disabled:text-slate-400"
                      disabled={!newCategory}
                    >
                      <option value="">Selecione...</option>
                      {newSubcategories.map((sub) => (
                        <option key={sub} value={sub}>
                          {sub}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Duration Limit (Months) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Duração (Nº de Meses) <span className="text-[10px] text-slate-400 font-normal lowercase">(deixe vazio se for infinito)</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Ex: 4 para parcelado em 4 meses"
                    value={newDurationMonths}
                    onChange={(e) => setNewDurationMonths(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm font-semibold bg-white text-slate-800"
                  />
                </div>

                {/* AutoPay / Débito Automático */}
                <div className="bg-slate-50 border border-slate-200/60 p-3.5 rounded-2xl flex items-start gap-3 select-none">
                  <input
                    type="checkbox"
                    id="newAutoPay"
                    checked={newAutoPay}
                    onChange={(e) => setNewAutoPay(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                  />
                  <label htmlFor="newAutoPay" className="cursor-pointer space-y-0.5">
                    <span className="block text-xs font-bold text-slate-700">
                      {newType === "income" ? "Recebimento Automático (Crédito Automático)" : "Pago Automaticamente (Débito Automático)"}
                    </span>
                    <span className="block text-[10px] text-slate-500 leading-normal">
                      {newType === "income"
                        ? "Esta receita será liquidada e lançada na planilha automaticamente na abertura do mês."
                        : "Esta conta será liquidada e lançada na planilha automaticamente na abertura do mês."}
                    </span>
                  </label>
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="submit"
                    className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 rounded-xl text-sm transition-all shadow-xs cursor-pointer"
                  >
                    Salvar Conta
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddFormOpen(false)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold py-2.5 rounded-xl text-sm transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main content body: List & Edit side by side or vertical */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Monthly bills checklist ledger */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
            <div className="px-5 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4 text-teal-600" />
                Contas a Pagar em {formatMonthName(activeMonth)}
              </span>
              <span className="text-xs font-mono font-bold text-slate-400">
                {stats.paidCount} de {stats.totalCount} pagas
              </span>
            </div>

            {(() => {
              const activeExpenses = expenses.filter((ex) => {
                const isPaidThisMonth = ex.paidMonths?.includes(activeMonth);
                const pastPaidMonthsCount = ex.paidMonths?.filter(m => m !== activeMonth).length || 0;
                const hasReachedLimitBeforeActiveMonth = ex.durationMonths && ex.durationMonths > 0 && pastPaidMonthsCount >= ex.durationMonths;
                return !hasReachedLimitBeforeActiveMonth;
              });

              if (activeExpenses.length === 0) {
                return (
                  <div className="p-8 text-center text-slate-400 space-y-3">
                    <PiggyBank className="w-12 h-12 mx-auto text-slate-300" />
                    <p className="text-sm font-semibold">Nenhum lançamento recorrente para este mês.</p>
                    <p className="text-xs text-slate-400">Cadastre suas receitas e despesas recorrentes clicando no botão "Nova Conta" acima.</p>
                  </div>
                );
              }

              return (
                <div className="divide-y divide-slate-100">
                  {activeExpenses
                    .sort((a, b) => a.dueDate - b.dueDate) // Sort by day
                    .map((ex) => {
                      const isPaid = ex.paidMonths?.includes(activeMonth);
                      const isIncome = ex.type === "income";
                      
                      // Installment calculations
                      const installmentText = (() => {
                        if (!ex.durationMonths || ex.durationMonths <= 0) return null;
                        if (isPaid) {
                          const sortedPaid = [...(ex.paidMonths || [])].sort();
                          const idx = sortedPaid.indexOf(activeMonth);
                          return `Parcela ${idx !== -1 ? idx + 1 : sortedPaid.length}/${ex.durationMonths}`;
                        } else {
                          const nextInst = (ex.paidMonths?.length || 0) + 1;
                          return `Parcela ${nextInst}/${ex.durationMonths}`;
                        }
                      })();

                      return (
                        <div 
                          key={ex.id} 
                          className={`p-4 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                            isPaid 
                              ? isIncome 
                                ? "bg-emerald-50/10" 
                                : "bg-rose-50/10" 
                              : "hover:bg-slate-50/50"
                          }`}
                        >
                          {/* Item info */}
                          <div className="flex items-start gap-3.5">
                            {/* Day Indicator Badge */}
                            <div className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center border text-center font-sans ${
                              isPaid 
                                ? isIncome
                                  ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                                  : "bg-rose-50 border-rose-100 text-rose-700" 
                                : isIncome
                                  ? "bg-emerald-50/30 border-emerald-200/50 text-emerald-600"
                                  : "bg-slate-50 border-slate-200/60 text-slate-600"
                            }`}>
                              <span className="text-[8px] uppercase tracking-wider font-extrabold block leading-none">Dia</span>
                              <span className="text-base font-extrabold font-mono leading-none mt-0.5">{ex.dueDate}</span>
                            </div>

                            <div className="space-y-0.5">
                              <h4 className={`text-sm font-bold flex items-center gap-1.5 ${isPaid ? "text-slate-400 line-through" : "text-slate-800"}`}>
                                {ex.description}
                                {installmentText && (
                                  <span className="text-[10px] font-semibold text-teal-600 bg-teal-50 border border-teal-100/50 px-1.5 py-0.2 rounded-full font-mono">
                                    {installmentText}
                                  </span>
                                )}
                              </h4>
                              <div className="flex flex-wrap items-center gap-1.5">
                                {/* Type indicator badge */}
                                <span className={`text-[8px] px-1.5 py-0.2 rounded-md font-extrabold uppercase tracking-wider ${
                                  isIncome 
                                    ? "bg-emerald-500/10 text-emerald-700 border border-emerald-200/40" 
                                    : "bg-rose-500/10 text-rose-700 border border-rose-200/40"
                                }`}>
                                  {isIncome ? "Receita" : "Despesa"}
                                </span>

                                {/* Category Badge */}
                                <span className={`text-[9px] px-2 py-0.5 rounded-md font-bold tracking-wider border ${getCategoryColorClass(ex.category)}`}>
                                  {ex.category}
                                </span>
                                {ex.subcategory && (
                                  <span className="text-[9px] bg-slate-100 text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded-md font-semibold">
                                    {ex.subcategory}
                                  </span>
                                )}
                                {ex.autoPay && (
                                  <span 
                                    className={`text-[9px] border px-1.5 py-0.5 rounded-md font-bold flex items-center gap-0.5 ${
                                      isIncome 
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                                        : "bg-rose-50 text-rose-700 border-rose-100"
                                    }`} 
                                    title={isIncome ? "Depositado automaticamente todo mês" : "Pago automaticamente todo mês"}
                                  >
                                    {isIncome ? "Crédito Automático" : "Débito Automático"}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Cost & Status Button actions */}
                          <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                            {/* Cost */}
                            <div className="text-left sm:text-right">
                              <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Valor</span>
                              <span className={`text-sm font-black font-mono ${isIncome ? "text-emerald-600" : "text-rose-600"}`}>
                                {isIncome ? "+" : "-"} {currencyFormatter(ex.amount)}
                              </span>
                            </div>

                            {/* Quick action buttons */}
                            <div className="flex items-center gap-1.5">
                              {/* Paid checkbox button */}
                              {isPaid ? (
                                <button
                                  onClick={() => onPayRecurringExpense(ex.id, activeMonth)}
                                  className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                                    isIncome
                                      ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
                                      : "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200"
                                  }`}
                                  title={isIncome ? "Marcar como Pendente de Recebimento" : "Marcar como Pendente de Pagamento"}
                                >
                                  <CheckCircle2 className={`w-4 h-4 ${isIncome ? "text-emerald-600" : "text-rose-600"}`} />
                                  <span>{isIncome ? "Recebido" : "Pago"}</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => onPayRecurringExpense(ex.id, activeMonth)}
                                  className={`flex items-center gap-1 bg-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs border ${
                                    isIncome
                                      ? "hover:bg-emerald-600 text-slate-700 hover:text-white border-slate-200 hover:border-emerald-600"
                                      : "hover:bg-rose-600 text-slate-700 hover:text-white border-slate-200 hover:border-rose-600"
                                  }`}
                                  title={isIncome ? "Lançar transação de recebimento" : "Lançar transação de pagamento"}
                                >
                                  <div className="w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center text-[8px] hover:border-white">
                                    ✓
                                  </div>
                                  <span>{isIncome ? "Receber" : "Pagar"}</span>
                                </button>
                              )}

                              {/* Edit button */}
                              <button
                                onClick={() => startEdit(ex)}
                                disabled={isPaid}
                                className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 disabled:opacity-30 disabled:pointer-events-none rounded-xl transition-all cursor-pointer"
                                title="Editar Item"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>

                              {/* Delete button */}
                              <button
                                onClick={() => setExpenseToDelete(ex)}
                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                                title="Excluir Item"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Edit Sidebar panel */}
        <div className="space-y-4">
          {editingExpenseId ? (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-5 rounded-2xl border border-teal-500 ring-1 ring-teal-500/10 shadow-sm text-left space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Pencil className="w-4 h-4 text-teal-600" />
                  Editar Conta Fixa
                </span>
                <button
                  onClick={() => setEditingExpenseId(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-3.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Descrição</label>
                  <input
                    type="text"
                    required
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>

                {/* Type Selector inside Edit */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tipo de Lançamento</label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => {
                        setEditType("expense");
                        setEditCategory("");
                        setEditSubcategory("");
                      }}
                      className={`py-1 rounded text-[10px] font-bold transition-all ${
                        editType === "expense"
                          ? "bg-rose-500 text-white shadow-xs"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Despesa
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditType("income");
                        setEditCategory("");
                        setEditSubcategory("");
                      }}
                      className={`py-1 rounded text-[10px] font-bold transition-all ${
                        editType === "income"
                          ? "bg-emerald-500 text-white shadow-xs"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Receita
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Valor (R$)</label>
                    <input
                      type="number"
                      required
                      step="0.01"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 bg-white font-mono focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Dia de Lançamento</label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="31"
                      value={editDueDate}
                      onChange={(e) => setEditDueDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Categoria</label>
                    <select
                      value={editCategory}
                      onChange={(e) => handleEditCategoryChange(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer"
                      required
                    >
                      <option value="">Selecione...</option>
                      {categories
                        .filter((c) => {
                          const cType = c.type || "expense";
                          return editType === "income" ? cType === "income" : cType === "expense";
                        })
                        .map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Subcategoria</label>
                    <select
                      value={editSubcategory}
                      onChange={(e) => setEditSubcategory(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer disabled:bg-slate-50 disabled:text-slate-400"
                      disabled={!editCategory}
                    >
                      <option value="">Selecione...</option>
                      {editSubcategories.map((sub) => (
                        <option key={sub} value={sub}>
                          {sub}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Duration Limit (Months) */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Duração (Nº de Meses) <span className="text-[9px] text-slate-400 font-normal lowercase">(deixe vazio se infinito)</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Contínuo"
                    value={editDurationMonths}
                    onChange={(e) => setEditDurationMonths(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>

                {/* AutoPay / Débito Automático */}
                <div className="bg-slate-50 border border-slate-200/60 p-2.5 rounded-xl flex items-start gap-2.5 select-none">
                  <input
                    type="checkbox"
                    id="editAutoPay"
                    checked={editAutoPay}
                    onChange={(e) => setEditAutoPay(e.target.checked)}
                    className="mt-0.5 w-3.5 h-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                  />
                  <label htmlFor="editAutoPay" className="cursor-pointer space-y-0.5">
                    <span className="block text-[10px] font-bold text-slate-700">
                      {editType === "income" ? "Recebimento Automático (Crédito)" : "Pago Automático (Débito Automático)"}
                    </span>
                    <span className="block text-[9px] text-slate-500 leading-normal">
                      {editType === "income"
                        ? "Será recebida automaticamente ao iniciar o mês."
                        : "Será paga automaticamente ao iniciar o mês."}
                    </span>
                  </label>
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="submit"
                    className="flex-1 bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-bold py-2 rounded-lg transition-all cursor-pointer shadow-xs"
                  >
                    Salvar
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingExpenseId(null)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-bold py-2 rounded-lg transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </motion.div>
          ) : (
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-3xl shadow-md text-left space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-teal-400" />
                <h4 className="font-display font-extrabold text-sm tracking-tight">O que são Gastos Mensais?</h4>
              </div>
              <p className="text-slate-300 text-xs leading-relaxed">
                São contas recorrentes de todo mês. Ao invés de digitá-las uma a uma na Planilha de Gastos, você as cadastra aqui uma única vez.
              </p>
              <div className="space-y-3 pt-2 text-[11px] text-slate-300">
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-teal-500/10 text-teal-400 flex items-center justify-center font-bold flex-shrink-0">1</div>
                  <p>Visualize as contas do mês atual e o status de pagamento.</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-teal-500/10 text-teal-400 flex items-center justify-center font-bold flex-shrink-0">2</div>
                  <p>Clique em <strong>"Pagar"</strong> para lançá-la instantaneamente na Planilha com a data de hoje.</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-teal-500/10 text-teal-400 flex items-center justify-center font-bold flex-shrink-0">3</div>
                  <p>O app cuida de atualizar o saldo e o painel de forma segura e totalmente local.</p>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Elegant Custom Deletion Confirmation Modal */}
      <AnimatePresence>
        {expenseToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setExpenseToDelete(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", duration: 0.3 }}
              className="relative w-full max-w-md bg-white rounded-3xl border border-slate-100 shadow-2xl overflow-hidden p-6 text-left space-y-4"
            >
              <div className="flex items-start gap-3.5">
                <div className="p-3 bg-rose-50 rounded-2xl text-rose-600 shrink-0">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-display font-extrabold text-base text-slate-800 leading-tight">
                    Confirmar Exclusão
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Você está prestes a excluir permanentemente o compromisso de gasto mensal:
                  </p>
                  <div className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-xs font-bold text-slate-800">{expenseToDelete.description}</p>
                    <p className="text-[11px] font-mono font-bold text-slate-500 mt-0.5">
                      {currencyFormatter(expenseToDelete.amount)} • Dia {expenseToDelete.dueDate} de todo mês
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-slate-400 leading-normal">
                Nota: Esta ação removerá o compromisso da sua lista de gastos mensais. Os lançamentos de pagamentos já efetuados na Planilha de Gastos continuarão preservados.
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    onDeleteRecurringExpense(expenseToDelete.id);
                    setExpenseToDelete(null);
                  }}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-sm cursor-pointer text-center"
                >
                  Confirmar Exclusão
                </button>
                <button
                  onClick={() => setExpenseToDelete(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold py-2.5 rounded-xl text-xs transition-all cursor-pointer text-center"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
