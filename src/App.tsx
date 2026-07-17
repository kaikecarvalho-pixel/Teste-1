import { useState, useEffect, useMemo } from "react";
import { Transaction, Category, RecurringExpense, MarketPurchase } from "./types";
import { 
  loadTransactions, 
  saveTransactions, 
  loadCategories, 
  saveCategories,
  DEFAULT_TRANSACTIONS,
  DEFAULT_CATEGORIES,
  loadRecurringExpenses,
  saveRecurringExpenses,
  DEFAULT_RECURRING_EXPENSES
} from "./data";
import DashboardView from "./components/DashboardView";
import SpreadsheetView from "./components/SpreadsheetView";
import ScannerView from "./components/ScannerView";
import CategoriesView from "./components/CategoriesView";
import RecurringExpensesView from "./components/RecurringExpensesView";
import MarketPurchasesView from "./components/MarketPurchasesView";
import { motion, AnimatePresence } from "motion/react";
import { 
  LayoutDashboard, 
  TableProperties, 
  QrCode, 
  Settings, 
  Wallet, 
  Sparkles,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Menu,
  X,
  CalendarDays,
  AlertCircle,
  CheckCircle2,
  ShoppingCart
} from "lucide-react";

type Tab = "dashboard" | "spreadsheet" | "scanner" | "categories" | "recurring" | "market";

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [marketPurchases, setMarketPurchases] = useState<MarketPurchase[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showResetSuccess, setShowResetSuccess] = useState(false);

  const saveMarketPurchases = (updated: MarketPurchase[]) => {
    localStorage.setItem("gasp_market_purchases", JSON.stringify(updated));
  };

  const handleDeleteMarketPurchase = (purchaseId: string) => {
    const updated = marketPurchases.filter((p) => p.id !== purchaseId);
    setMarketPurchases(updated);
    saveMarketPurchases(updated);
  };

  // Load initial data on mount
  useEffect(() => {
    let t = loadTransactions();
    const hasWiped = localStorage.getItem("gasp_has_wiped_initial_v2");
    if (!hasWiped) {
      t = [];
      saveTransactions([]);
      localStorage.setItem("gasp_has_wiped_initial_v2", "true");
    }
    setTransactions(t);
    setCategories(loadCategories());
    setRecurringExpenses(loadRecurringExpenses());

    // Load market purchases from localStorage
    const storedMarket = localStorage.getItem("gasp_market_purchases");
    if (storedMarket) {
      try {
        setMarketPurchases(JSON.parse(storedMarket));
      } catch (e) {
        console.error(e);
      }
    } else {
      // Seed a beautiful default supermarket receipt with full itemized items
      const todayStr = new Date().toISOString().split("T")[0];
      const initialPurchases: MarketPurchase[] = [
        {
          id: "mp_initial_1",
          transactionId: "t_initial_market_1",
          marketName: "Zona Sul Supermercados",
          date: todayStr,
          totalAmount: 172.70,
          items: [
            { name: "Filet Mignon Bovino Kg", price: 89.90, quantity: 1, total: 89.90, subSubcategory: "Alimentação", selected: true },
            { name: "Pack Cerveja Stella Artois 6 un", price: 35.40, quantity: 1, total: 35.40, subSubcategory: "Bebidas", selected: true },
            { name: "Sabão em Pó OMO 1.6Kg", price: 24.90, quantity: 1, total: 24.90, subSubcategory: "Produtos de Limpeza", selected: true },
            { name: "Shampoo Anticaspa Head & Shoulders", price: 22.50, quantity: 1, total: 22.50, subSubcategory: "Higiene Pessoal", selected: true }
          ]
        }
      ];
      setMarketPurchases(initialPurchases);
      localStorage.setItem("gasp_market_purchases", JSON.stringify(initialPurchases));

      // Sync parent transaction to spreadsheet if empty
      if (t.length === 0) {
        const initialParentT: Transaction = {
          id: "t_initial_market_1",
          date: todayStr,
          description: "Compra Mercado - Zona Sul Supermercados",
          amount: 172.70,
          type: "expense",
          category: "Alimentação",
          subcategory: "Mercado",
          paymentMethod: "Cartão de Crédito",
          notes: "Compra agrupada contendo 4 itens. Detalhes completos disponíveis na aba Itens de Mercado."
        };
        saveTransactions([initialParentT]);
        setTransactions([initialParentT]);
      }
    }
  }, []);

  // Auto-pay recurring items with autoPay: true for the current month
  useEffect(() => {
    if (recurringExpenses.length === 0) return;

    const today = new Date();
    const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

    const pendingAutoPays = recurringExpenses.filter((ex) => {
      const alreadyPaidThisMonth = ex.paidMonths.includes(currentMonthStr);
      if (alreadyPaidThisMonth) return false;
      if (!ex.autoPay) return false;
      if (ex.durationMonths && ex.durationMonths > 0) {
        if (ex.paidMonths.length >= ex.durationMonths) {
          return false;
        }
      }
      return true;
    });

    if (pendingAutoPays.length === 0) return;

    const todayStr = today.toISOString().split("T")[0];
    const newTransactions = [...transactions];
    const updatedExpenses = recurringExpenses.map((ex) => {
      const alreadyPaidThisMonth = ex.paidMonths.includes(currentMonthStr);
      const isAutoPayEnabled = ex.autoPay;
      const isLimitReached = ex.durationMonths && ex.durationMonths > 0 && ex.paidMonths.length >= ex.durationMonths;

      if (isAutoPayEnabled && !alreadyPaidThisMonth && !isLimitReached) {
        const txId = `rec_t_${ex.id}_${currentMonthStr}`;
        const itemType = ex.type || "expense";
        const prefix = itemType === "income" ? "[Crédito Automático]" : "[Débito Automático]";
        const method = itemType === "income" ? "Transferência" : "Débito Automático";

        if (!newTransactions.some((t) => t.id === txId)) {
          newTransactions.unshift({
            id: txId,
            date: todayStr,
            description: `${prefix} ${ex.description}`,
            amount: ex.amount,
            type: itemType,
            category: ex.category,
            subcategory: ex.subcategory,
            paymentMethod: method
          });
        }
        return {
          ...ex,
          paidMonths: [...ex.paidMonths, currentMonthStr]
        };
      }
      return ex;
    });

    setRecurringExpenses(updatedExpenses);
    saveRecurringExpenses(updatedExpenses);
    setTransactions(newTransactions);
    saveTransactions(newTransactions);
  }, [recurringExpenses, transactions]);

  // Sync state to localStorage on modification
  const handleAddTransaction = (newT: Omit<Transaction, "id">) => {
    const transaction: Transaction = {
      ...newT,
      id: `manual_t_${Date.now()}`
    };
    const updated = [transaction, ...transactions];
    setTransactions(updated);
    saveTransactions(updated);
  };

  const handleUpdateTransaction = (updatedT: Transaction) => {
    const updated = transactions.map((t) => (t.id === updatedT.id ? updatedT : t));
    setTransactions(updated);
    saveTransactions(updated);
  };

  const handleDeleteTransaction = (id: string) => {
    const updated = transactions.filter((t) => t.id !== id);
    setTransactions(updated);
    saveTransactions(updated);
  };

  const handleImportTransactions = (newTransList: Transaction[], marketPurchase?: MarketPurchase) => {
    const updated = [...newTransList, ...transactions];
    setTransactions(updated);
    saveTransactions(updated);

    if (marketPurchase) {
      const updatedPurchases = [marketPurchase, ...marketPurchases];
      setMarketPurchases(updatedPurchases);
      saveMarketPurchases(updatedPurchases);
    }
  };

  const handleAddCategory = (newCat: Omit<Category, "id">) => {
    const category: Category = {
      ...newCat,
      id: `custom_cat_${Date.now()}`
    };
    const updated = [...categories, category];
    setCategories(updated);
    saveCategories(updated);
  };

  const handleDeleteCategory = (catId: string) => {
    const updated = categories.filter((c) => c.id !== catId);
    setCategories(updated);
    saveCategories(updated);
  };

  const handleUpdateCategory = (updatedCat: Category) => {
    const updated = categories.map((c) => (c.id === updatedCat.id ? updatedCat : c));
    setCategories(updated);
    saveCategories(updated);
  };

  const handleAddSubcategory = (catId: string, subName: string) => {
    const updated = categories.map((c) => {
      if (c.id === catId) {
        if (c.subcategories.includes(subName)) return c;
        return {
          ...c,
          subcategories: [...c.subcategories, subName]
        };
      }
      return c;
    });
    setCategories(updated);
    saveCategories(updated);
  };

  const handleDeleteSubcategory = (catId: string, subName: string) => {
    const updated = categories.map((c) => {
      if (c.id === catId) {
        return {
          ...c,
          subcategories: c.subcategories.filter((sub) => sub !== subName)
        };
      }
      return c;
    });
    setCategories(updated);
    saveCategories(updated);
  };

  const handleAddRecurringExpense = (newEx: Omit<RecurringExpense, "id" | "paidMonths">) => {
    const expense: RecurringExpense = {
      ...newEx,
      id: `manual_rec_${Date.now()}`,
      paidMonths: []
    };
    const updated = [...recurringExpenses, expense];
    setRecurringExpenses(updated);
    saveRecurringExpenses(updated);
  };

  const handleUpdateRecurringExpense = (updatedEx: RecurringExpense) => {
    const updated = recurringExpenses.map((ex) => (ex.id === updatedEx.id ? updatedEx : ex));
    setRecurringExpenses(updated);
    saveRecurringExpenses(updated);
  };

  const handleDeleteRecurringExpense = (id: string) => {
    const updated = recurringExpenses.filter((ex) => ex.id !== id);
    setRecurringExpenses(updated);
    saveRecurringExpenses(updated);
  };

  const handlePayRecurringExpense = (expenseId: string, monthStr: string) => {
    const updated = recurringExpenses.map((ex) => {
      if (ex.id === expenseId) {
        const isPaid = ex.paidMonths.includes(monthStr);
        let updatedPaidMonths = [...ex.paidMonths];
        
        if (isPaid) {
          // Mark as unpaid: remove month from paid list, and delete the generated transaction
          updatedPaidMonths = updatedPaidMonths.filter((m) => m !== monthStr);
          const targetTxId = `rec_t_${ex.id}_${monthStr}`;
          const updatedTransactions = transactions.filter((t) => t.id !== targetTxId);
          setTransactions(updatedTransactions);
          saveTransactions(updatedTransactions);
        } else {
          // Mark as paid: add month to list, and generate a transaction
          updatedPaidMonths.push(monthStr);
          
          const todayStr = new Date().toISOString().split("T")[0];
          const itemType = ex.type || "expense";
          const prefix = itemType === "income" ? "[Receita Fixa]" : "[Gasto Fixo]";
          const method = itemType === "income" ? "Transferência" : "Débito Automático";

          const newTx: Transaction = {
            id: `rec_t_${ex.id}_${monthStr}`,
            date: todayStr,
            description: `${prefix} ${ex.description}`,
            amount: ex.amount,
            type: itemType,
            category: ex.category,
            subcategory: ex.subcategory,
            paymentMethod: method
          };
          const updatedTransactions = [newTx, ...transactions];
          setTransactions(updatedTransactions);
          saveTransactions(updatedTransactions);
        }
        
        return {
          ...ex,
          paidMonths: updatedPaidMonths
        };
      }
      return ex;
    });
    
    setRecurringExpenses(updated);
    saveRecurringExpenses(updated);
  };

  // Reset helper to wipe custom entries and restore beautiful seeding data
  const handleResetDatabase = () => {
    setShowResetModal(true);
  };

  const confirmResetDatabase = () => {
    localStorage.removeItem("gasp_transactions");
    localStorage.removeItem("gasp_categories");
    localStorage.removeItem("gasp_recurring_expenses");
    localStorage.removeItem("gasp_market_purchases");
    setTransactions(DEFAULT_TRANSACTIONS);
    setCategories(DEFAULT_CATEGORIES);
    setRecurringExpenses(DEFAULT_RECURRING_EXPENSES);
    setMarketPurchases([]);
    saveTransactions(DEFAULT_TRANSACTIONS);
    saveCategories(DEFAULT_CATEGORIES);
    saveRecurringExpenses(DEFAULT_RECURRING_EXPENSES);
    setActiveTab("dashboard");
    setShowResetModal(false);
    setShowResetSuccess(true);
  };

  // High level financial metrics for left sidebar recap
  const summary = useMemo(() => {
    let income = 0;
    let expense = 0;
    transactions.forEach((t) => {
      if (t.type === "income") income += t.amount;
      else expense += t.amount;
    });
    return {
      balance: income - expense,
      income,
      expense
    };
  }, [transactions]);

  const currencyFormatter = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row font-sans" id="app-root-shell">
      
      {/* 1. TOP MOBILE HEADER PANEL (no-print) */}
      <header className="lg:hidden bg-slate-900 text-white px-4 py-4 flex items-center justify-between shadow-md no-print z-50">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-teal-600 text-white">
            <Wallet className="w-5 h-5" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight">Finanças Carioca</span>
        </div>
        
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-slate-300 hover:text-white rounded-lg focus:outline-none"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {/* 2. PERSISTENT MOBILE DROPDOWN DRAWER (no-print) */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="lg:hidden absolute top-[68px] inset-x-0 bg-slate-900 text-white border-b border-slate-800 shadow-xl z-40 p-5 space-y-4 no-print"
          >
            {/* Quick stats in mobile menu */}
            <div className="grid grid-cols-2 gap-3 pb-4 border-b border-slate-800">
              <div className="p-2.5 rounded-xl bg-slate-800/60">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Saldo</span>
                <span className={`text-sm font-semibold ${summary.balance >= 0 ? "text-teal-400" : "text-rose-400"}`}>
                  {currencyFormatter(summary.balance)}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/60">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Despesas</span>
                <span className="text-sm font-semibold text-rose-400">
                  {currencyFormatter(summary.expense)}
                </span>
              </div>
            </div>

            {/* Menu options */}
            <nav className="flex flex-col gap-2">
              <button
                onClick={() => { setActiveTab("dashboard"); setIsMobileMenuOpen(false); }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold ${
                  activeTab === "dashboard" ? "bg-teal-600 text-white" : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                <LayoutDashboard className="w-5 h-5" />
                Painel Geral
              </button>

              <button
                onClick={() => { setActiveTab("spreadsheet"); setIsMobileMenuOpen(false); }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold ${
                  activeTab === "spreadsheet" ? "bg-teal-600 text-white" : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                <TableProperties className="w-5 h-5" />
                Planilha de Gastos
              </button>

              <button
                onClick={() => { setActiveTab("recurring"); setIsMobileMenuOpen(false); }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold ${
                  activeTab === "recurring" ? "bg-teal-600 text-white" : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                <CalendarDays className="w-5 h-5" />
                Gastos Mensais
              </button>

              <button
                onClick={() => { setActiveTab("scanner"); setIsMobileMenuOpen(false); }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold ${
                  activeTab === "scanner" ? "bg-teal-600 text-white" : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                <QrCode className="w-5 h-5" />
                Scanner Inteligente
                <span className="text-[9px] font-bold bg-teal-500/20 text-teal-400 px-1.5 py-0.5 rounded-full uppercase ml-auto">IA</span>
              </button>

              <button
                onClick={() => { setActiveTab("market"); setIsMobileMenuOpen(false); }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold ${
                  activeTab === "market" ? "bg-teal-600 text-white" : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                <ShoppingCart className="w-5 h-5" />
                Itens de Mercado
              </button>

              <button
                onClick={() => { setActiveTab("categories"); setIsMobileMenuOpen(false); }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold ${
                  activeTab === "categories" ? "bg-teal-600 text-white" : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                <Settings className="w-5 h-5" />
                Categorias
              </button>
            </nav>

            <button
              onClick={() => { handleResetDatabase(); setIsMobileMenuOpen(false); }}
              className="w-full flex items-center justify-center gap-2 border border-slate-800 text-slate-400 hover:text-white px-4 py-3 rounded-xl text-xs font-semibold"
            >
              <RefreshCw className="w-4 h-4" /> Resetar Dados
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. DESKTOP PERMANENT LEFT SIDEBAR PANEL (no-print) */}
      <aside className="hidden lg:flex lg:flex-col lg:w-72 bg-slate-900 text-white border-r border-slate-800 p-6 flex-shrink-0 justify-between no-print shadow-xl">
        
        {/* Branding header */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-800/60 pb-5">
            <div className="p-2 rounded-xl bg-teal-600 text-white shadow-md shadow-teal-600/10">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-display font-extrabold text-lg tracking-tight leading-none">Finanças</h1>
              <span className="text-xs text-slate-400 font-medium">Controle de Gastos</span>
            </div>
          </div>

          {/* User Profile Balance summary */}
          <div className="bg-slate-800/40 border border-slate-800 p-4 rounded-2xl space-y-3.5">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Saldo em Conta</span>
              <h2 className={`text-xl font-display font-extrabold tracking-tight mt-0.5 ${
                summary.balance >= 0 ? "text-teal-400" : "text-rose-400"
              }`}>
                {currencyFormatter(summary.balance)}
              </h2>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-xs border-t border-slate-800/60 pt-3">
              <div>
                <span className="text-[9px] text-slate-400 uppercase font-semibold flex items-center gap-0.5">
                  <TrendingUp className="w-3 h-3 text-teal-400" /> Receitas
                </span>
                <span className="font-mono font-bold text-teal-400 mt-0.5 block truncate">
                  {currencyFormatter(summary.income)}
                </span>
              </div>
              <div>
                <span className="text-[9px] text-slate-400 uppercase font-semibold flex items-center gap-0.5">
                  <TrendingDown className="w-3 h-3 text-rose-400" /> Despesas
                </span>
                <span className="font-mono font-bold text-rose-400 mt-0.5 block truncate">
                  {currencyFormatter(summary.expense)}
                </span>
              </div>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="flex flex-col gap-1.5 pt-2">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all text-left relative cursor-pointer ${
                activeTab === "dashboard" 
                  ? "bg-teal-600 text-white shadow-lg shadow-teal-600/10" 
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
              Painel Geral
              {activeTab === "dashboard" && (
                <motion.div layoutId="activeNavIndicator" className="absolute right-3 w-1.5 h-1.5 rounded-full bg-white" />
              )}
            </button>

            <button
              onClick={() => setActiveTab("spreadsheet")}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all text-left relative cursor-pointer ${
                activeTab === "spreadsheet" 
                  ? "bg-teal-600 text-white shadow-lg shadow-teal-600/10" 
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <TableProperties className="w-5 h-5 flex-shrink-0" />
              Planilha de Gastos
              {activeTab === "spreadsheet" && (
                <motion.div layoutId="activeNavIndicator" className="absolute right-3 w-1.5 h-1.5 rounded-full bg-white" />
              )}
            </button>

            <button
              onClick={() => setActiveTab("recurring")}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all text-left relative cursor-pointer ${
                activeTab === "recurring" 
                  ? "bg-teal-600 text-white shadow-lg shadow-teal-600/10" 
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <CalendarDays className="w-5 h-5 flex-shrink-0" />
              Gastos Mensais
              {activeTab === "recurring" && (
                <motion.div layoutId="activeNavIndicator" className="absolute right-3 w-1.5 h-1.5 rounded-full bg-white" />
              )}
            </button>

            <button
              onClick={() => setActiveTab("scanner")}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all text-left relative cursor-pointer ${
                activeTab === "scanner" 
                  ? "bg-teal-600 text-white shadow-lg shadow-teal-600/10" 
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <QrCode className="w-5 h-5 flex-shrink-0" />
              Scanner Inteligente
              <span className="text-[9px] font-bold bg-teal-500/20 text-teal-400 border border-teal-500/30 px-1.5 py-0.5 rounded-md uppercase ml-auto">IA</span>
              {activeTab === "scanner" && (
                <motion.div layoutId="activeNavIndicator" className="absolute right-3 w-1.5 h-1.5 rounded-full bg-white" />
              )}
            </button>

            <button
              onClick={() => setActiveTab("market")}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all text-left relative cursor-pointer ${
                activeTab === "market" 
                  ? "bg-teal-600 text-white shadow-lg shadow-teal-600/10" 
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <ShoppingCart className="w-5 h-5 flex-shrink-0" />
              Itens de Mercado
              {activeTab === "market" && (
                <motion.div layoutId="activeNavIndicator" className="absolute right-3 w-1.5 h-1.5 rounded-full bg-white" />
              )}
            </button>

            <button
              onClick={() => setActiveTab("categories")}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all text-left relative cursor-pointer ${
                activeTab === "categories" 
                  ? "bg-teal-600 text-white shadow-lg shadow-teal-600/10" 
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <Settings className="w-5 h-5 flex-shrink-0" />
              Categorias
              {activeTab === "categories" && (
                <motion.div layoutId="activeNavIndicator" className="absolute right-3 w-1.5 h-1.5 rounded-full bg-white" />
              )}
            </button>
          </nav>
        </div>

        {/* Database seed reset button */}
        <div className="pt-6 border-t border-slate-800/60 space-y-3">
          <div className="flex items-center gap-2 bg-slate-800/20 border border-slate-800/40 p-3 rounded-xl text-[10px] text-slate-400 leading-normal">
            <Sparkles className="w-4 h-4 text-teal-400 flex-shrink-0 animate-pulse" />
            <span>Processamento local seguro no seu navegador.</span>
          </div>
          <button
            onClick={handleResetDatabase}
            className="w-full flex items-center justify-center gap-2 text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 px-4 py-2.5 rounded-xl text-xs font-semibold border border-transparent hover:border-rose-900/40 transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Resetar Dados
          </button>
        </div>
      </aside>

      {/* 4. MAIN WORKSPACE SCENARIO VIEWPORTS */}
      <main className="flex-1 p-4 lg:p-8 overflow-y-auto max-w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18 }}
            className="h-full"
          >
            {activeTab === "dashboard" && (
              <DashboardView 
                transactions={transactions} 
                categories={categories} 
              />
            )}

            {activeTab === "spreadsheet" && (
              <SpreadsheetView
                transactions={transactions}
                categories={categories}
                onAddTransaction={handleAddTransaction}
                onUpdateTransaction={handleUpdateTransaction}
                onDeleteTransaction={handleDeleteTransaction}
              />
            )}

            {activeTab === "scanner" && (
              <ScannerView 
                onImportTransactions={handleImportTransactions} 
              />
            )}

            {activeTab === "market" && (
              <MarketPurchasesView
                purchases={marketPurchases}
                onDeletePurchase={handleDeleteMarketPurchase}
              />
            )}

            {activeTab === "categories" && (
              <CategoriesView
                categories={categories}
                onAddCategory={handleAddCategory}
                onAddSubcategory={handleAddSubcategory}
                onDeleteCategory={handleDeleteCategory}
                onDeleteSubcategory={handleDeleteSubcategory}
                onUpdateCategory={handleUpdateCategory}
              />
            )}

            {activeTab === "recurring" && (
              <RecurringExpensesView
                expenses={recurringExpenses}
                categories={categories}
                transactions={transactions}
                onAddRecurringExpense={handleAddRecurringExpense}
                onUpdateRecurringExpense={handleUpdateRecurringExpense}
                onDeleteRecurringExpense={handleDeleteRecurringExpense}
                onPayRecurringExpense={handlePayRecurringExpense}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Elegant Custom Deletion Confirmation Modal */}
      <AnimatePresence>
        {showResetModal && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowResetModal(false)}
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
                    Resetar Banco de Dados?
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Você está prestes a apagar todos os seus lançamentos customizados, categorias customizadas e configurações. Esta ação é irreversível.
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-2xl">
                <p className="text-xs font-semibold text-slate-700 leading-normal">
                  O que acontecerá:
                </p>
                <ul className="list-disc pl-4 mt-1.5 text-[11px] text-slate-500 space-y-1">
                  <li>Todos os lançamentos customizados serão removidos</li>
                  <li>As categorias padrão serão restauradas</li>
                  <li>Os dados de simulação padrão serão recarregados</li>
                </ul>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={confirmResetDatabase}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-sm cursor-pointer text-center"
                >
                  Confirmar e Reiniciar
                </button>
                <button
                  onClick={() => setShowResetModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold py-2.5 rounded-xl text-xs transition-all cursor-pointer text-center"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Elegant Custom Success Alert */}
      <AnimatePresence>
        {showResetSuccess && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowResetSuccess(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
            />

            {/* Success Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", duration: 0.3 }}
              className="relative w-full max-w-sm bg-white rounded-3xl border border-slate-100 shadow-2xl overflow-hidden p-6 text-center space-y-4"
            >
              <div className="mx-auto p-3 bg-emerald-50 rounded-full text-emerald-600 w-fit">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="font-display font-extrabold text-base text-slate-800 leading-tight">
                  Banco de Dados Restaurado!
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Todos os dados de simulação padrão foram recarregados com sucesso.
                </p>
              </div>

              <button
                onClick={() => setShowResetSuccess(false)}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl text-xs transition-all cursor-pointer text-center"
              >
                Entendido
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
