export type TransactionType = 'expense' | 'income';

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
  subcategory: string;
  subSubcategory?: string; // Specific for Mercado/Supermarket items
  paymentMethod?: string;
  notes?: string;
}

export interface Category {
  id: string;
  name: string; // e.g. 'Carro', 'Alimentação'
  subcategories: string[];
  color: string; // Tailwind color name like 'amber', 'emerald', 'indigo'
  icon: string; // Lucide icon name
  isCustom?: boolean;
  type?: 'expense' | 'income' | 'both';
}

export interface RecurringExpense {
  id: string;
  description: string;
  amount: number;
  dueDate: number; // Day of the month (1-31)
  category: string;
  subcategory: string;
  paidMonths: string[]; // list of year-month strings, e.g. ["2026-07"]
  autoPay?: boolean;
  type?: 'expense' | 'income';
  durationMonths?: number;
}

export interface ParsedItem {
  name: string;
  price: number;
  quantity: number;
  total: number;
  subSubcategory: string; // Alimentação, Limpeza, Higiene, Outros, etc.
  selected: boolean;
}

export interface ParsedReceipt {
  marketName: string;
  date: string;
  totalAmount: number;
  items: ParsedItem[];
}

export interface MarketPurchase {
  id: string;
  transactionId: string;
  marketName: string;
  date: string;
  totalAmount: number;
  items: ParsedItem[];
}

