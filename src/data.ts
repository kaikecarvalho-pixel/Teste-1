import { Category, Transaction, RecurringExpense } from "./types";

export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: "cat_1",
    name: "Alimentação",
    subcategories: ["Mercado", "Restaurante", "Delivery", "Lanches/Cafeteria"],
    color: "emerald", // Tailwind colors used dynamically
    icon: "Utensils",
    type: "expense",
  },
  {
    id: "cat_2",
    name: "Carro",
    subcategories: ["Seguro", "Manutenções", "Melhorias", "Produtos de limpeza", "Lavagem", "Combustível", "IPVA/Taxas"],
    color: "amber",
    icon: "Car",
    type: "expense",
  },
  {
    id: "cat_3",
    name: "Habitação",
    subcategories: ["Aluguel/Financiamento", "Condomínio", "Água/Luz/Gás", "Internet/TV", "Decoração/Reformas", "Outros"],
    color: "blue",
    icon: "Home",
    type: "expense",
  },
  {
    id: "cat_4",
    name: "Saúde",
    subcategories: ["Plano de Saúde", "Farmácia", "Dentista", "Exames/Consultas", "Outros"],
    color: "rose",
    icon: "HeartPulse",
    type: "expense",
  },
  {
    id: "cat_5",
    name: "Lazer & Estilo",
    subcategories: ["Viagens", "Cinema/Shows", "Assinaturas (Netflix, etc)", "Roupas/Compras", "Eventos", "Outros"],
    color: "violet",
    icon: "Sparkles",
    type: "expense",
  },
  {
    id: "cat_6",
    name: "Educação",
    subcategories: ["Mensalidade Escolar/Faculdade", "Cursos & Eventos", "Livros & Material"],
    color: "indigo",
    icon: "GraduationCap",
    type: "expense",
  },
  {
    id: "cat_7",
    name: "Rendimentos (Entradas)",
    subcategories: ["Salário", "Investimentos", "Freelance", "Transferências", "Outros"],
    color: "teal",
    icon: "TrendingUp",
    type: "income",
  }
];

export const MERCADO_SUB_SUBCATEGORIES = [
  "Alimentação",
  "Produtos de Limpeza",
  "Higiene Pessoal",
  "Bebidas",
  "Outros"
];

// Helper to get formatted date relative to current year/month
const getDateOffset = (daysAgo: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split("T")[0];
};

export const DEFAULT_TRANSACTIONS: Transaction[] = [];

// LocalStorage helpers
export const loadTransactions = (): Transaction[] => {
  if (typeof window === "undefined") return DEFAULT_TRANSACTIONS;
  const stored = localStorage.getItem("gasp_transactions");
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error("Error parsing stored transactions", e);
    }
  }
  // Initialize with defaults if empty
  localStorage.setItem("gasp_transactions", JSON.stringify(DEFAULT_TRANSACTIONS));
  return DEFAULT_TRANSACTIONS;
};

export const saveTransactions = (transactions: Transaction[]) => {
  if (typeof window !== "undefined") {
    localStorage.setItem("gasp_transactions", JSON.stringify(transactions));
  }
};

export const loadCategories = (): Category[] => {
  if (typeof window === "undefined") return DEFAULT_CATEGORIES;
  const stored = localStorage.getItem("gasp_categories");
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error("Error parsing stored categories", e);
    }
  }
  localStorage.setItem("gasp_categories", JSON.stringify(DEFAULT_CATEGORIES));
  return DEFAULT_CATEGORIES;
};

export const saveCategories = (categories: Category[]) => {
  if (typeof window !== "undefined") {
    localStorage.setItem("gasp_categories", JSON.stringify(categories));
  }
};

export const DEFAULT_RECURRING_EXPENSES: RecurringExpense[] = [
  {
    id: "rec_1",
    description: "Aluguel da Casa",
    amount: 2200.00,
    dueDate: 5,
    category: "Habitação",
    subcategory: "Aluguel/Financiamento",
    paidMonths: [],
    autoPay: false
  },
  {
    id: "rec_2",
    description: "Taxa do Condomínio",
    amount: 450.00,
    dueDate: 5,
    category: "Habitação",
    subcategory: "Condomínio",
    paidMonths: [],
    autoPay: false
  },
  {
    id: "rec_3",
    description: "Conta de Energia (Light)",
    amount: 185.30,
    dueDate: 10,
    category: "Habitação",
    subcategory: "Água/Luz/Gás",
    paidMonths: [],
    autoPay: true
  },
  {
    id: "rec_4",
    description: "Internet de Alta Velocidade",
    amount: 119.90,
    dueDate: 15,
    category: "Habitação",
    subcategory: "Internet/TV",
    paidMonths: [],
    autoPay: false
  },
  {
    id: "rec_5",
    description: "Plano de Saúde Familiar",
    amount: 620.00,
    dueDate: 10,
    category: "Saúde",
    subcategory: "Plano de Saúde",
    paidMonths: [],
    autoPay: false
  },
  {
    id: "rec_6",
    description: "Assinatura Netflix",
    amount: 55.90,
    dueDate: 22,
    category: "Lazer & Estilo",
    subcategory: "Assinaturas (Netflix, etc)",
    paidMonths: [],
    autoPay: true
  }
];

export const loadRecurringExpenses = (): RecurringExpense[] => {
  if (typeof window === "undefined") return DEFAULT_RECURRING_EXPENSES;
  const stored = localStorage.getItem("gasp_recurring_expenses");
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error("Error parsing stored recurring expenses", e);
    }
  }
  localStorage.setItem("gasp_recurring_expenses", JSON.stringify(DEFAULT_RECURRING_EXPENSES));
  return DEFAULT_RECURRING_EXPENSES;
};

export const saveRecurringExpenses = (expenses: RecurringExpense[]) => {
  if (typeof window !== "undefined") {
    localStorage.setItem("gasp_recurring_expenses", JSON.stringify(expenses));
  }
};

