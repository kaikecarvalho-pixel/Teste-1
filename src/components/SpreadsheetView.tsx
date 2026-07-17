import React, { useState, useMemo, useEffect } from "react";
import { Transaction, Category, TransactionType } from "../types";
import { MERCADO_SUB_SUBCATEGORIES } from "../data";
import { motion, AnimatePresence } from "motion/react";
import { 
  Search, 
  Plus, 
  Trash2, 
  Edit, 
  Check, 
  X, 
  FileSpreadsheet, 
  FileText, 
  Calendar, 
  Tag, 
  FilterX,
  CreditCard,
  Coins,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Loader2,
  AlertCircle
} from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { googleSignIn, logout as firebaseLogout, initAuth } from "../lib/firebase";

// Helper functions for Google Sheets API calls
const getFirstSheetName = async (token: string, spreadsheetId: string): Promise<{ name: string; id: number }> => {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Erro ao obter informações da planilha.");
  }
  const data = await res.json();
  const sheets = data.sheets || [];
  if (sheets.length > 0) {
    return {
      name: sheets[0].properties.title || "Sheet1",
      id: sheets[0].properties.sheetId || 0
    };
  }
  return { name: "Sheet1", id: 0 };
};

const createSpreadsheet = async (token: string, title: string): Promise<string> => {
  const res = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: {
        title: title,
      },
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Erro ao criar planilha.");
  }
  const data = await res.json();
  return data.spreadsheetId;
};

const syncSpreadsheetValues = async (token: string, spreadsheetId: string, transactionsList: Transaction[]) => {
  // Dynamically resolve first sheet name and ID to support all regional Google Accounts
  const { name: sheetName, id: sheetId } = await getFirstSheetName(token, spreadsheetId);

  const headers = [
    "Data", 
    "Tipo", 
    "Descrição", 
    "Categoria", 
    "Subcategoria", 
    "Subsubcategoria (Mercado)", 
    "Valor (R$)", 
    "Forma de Pagamento", 
    "Notas"
  ];
  const rows = transactionsList.map((t) => [
    t.date,
    t.type === "income" ? "Receita" : "Despesa",
    t.description,
    t.category,
    t.subcategory,
    t.subSubcategory || "",
    t.amount,
    t.paymentMethod || "",
    t.notes || ""
  ]);

  const values = [headers, ...rows];

  // 1. Clear any leftover values first
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A1:Z10000:clear`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    }
  });

  // 2. Put new values
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A1?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values,
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Erro ao atualizar valores na planilha.");
  }

  // 3. Format sheets header beautifully (Teal theme with white text) and freeze header
  try {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: sheetId,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: 9
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: {
                    red: 0.09,  // Dark teal background
                    green: 0.47,
                    blue: 0.44
                  },
                  textFormat: {
                    foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 },
                    bold: true,
                    fontSize: 10
                  },
                  horizontalAlignment: "CENTER"
                }
              },
              fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)"
            }
          },
          {
            updateSheetProperties: {
              properties: {
                sheetId: sheetId,
                gridProperties: {
                  frozenRowCount: 1
                }
              },
              fields: "gridProperties.frozenRowCount"
            }
          }
        ]
      })
    });
  } catch (e) {
    console.warn("Formatting failed, skipping gracefully:", e);
  }
};

interface SpreadsheetViewProps {
  transactions: Transaction[];
  categories: Category[];
  onAddTransaction: (t: Omit<Transaction, "id">) => void;
  onUpdateTransaction: (t: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
}

export default function SpreadsheetView({
  transactions,
  categories,
  onAddTransaction,
  onUpdateTransaction,
  onDeleteTransaction,
}: SpreadsheetViewProps) {
  // Filters state
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [subCatFilter, setSubCatFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<"all" | TransactionType>("all");
  const [timePeriod, setTimePeriod] = useState<"all" | "week" | "month" | "year">("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  const [showUnlinkModal, setShowUnlinkModal] = useState(false);

  // Google Sheets state and logic
  const [user, setUser] = useState<any>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isSheetsPanelOpen, setIsSheetsPanelOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(() => {
    return localStorage.getItem("gasp_google_spreadsheet_id");
  });
  const [spreadsheetName, setSpreadsheetName] = useState<string>(() => {
    return localStorage.getItem("gasp_google_spreadsheet_name") || "Gasp - Controle Financeiro";
  });
  const [autoSync, setAutoSync] = useState<boolean>(() => {
    const saved = localStorage.getItem("gasp_google_sheets_autosync");
    return saved !== null ? saved === "true" : true;
  });
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => {
    return localStorage.getItem("gasp_google_sheets_last_sync");
  });

  // Track authentication state
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setUser(user);
        setAccessToken(token);
      },
      () => {
        setUser(null);
        setAccessToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleConnectGoogle = async () => {
    setIsConnecting(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setAccessToken(res.accessToken);
      }
    } catch (e: any) {
      alert(`Erro de conexão: ${e.message || e}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    try {
      await firebaseLogout();
      setUser(null);
      setAccessToken(null);
    } catch (e: any) {
      alert(`Erro ao desconectar: ${e.message || e}`);
    }
  };

  const handleSyncSpreadsheet = async (targetToken?: string, targetId?: string) => {
    const tokenToUse = targetToken || accessToken;
    const idToUse = targetId || spreadsheetId;

    if (!tokenToUse) {
      // In-memory token might have cleared, trigger quick popup sign-in
      setIsConnecting(true);
      try {
        const res = await googleSignIn();
        if (res) {
          setUser(res.user);
          setAccessToken(res.accessToken);
          // Retry sync
          setIsSyncing(true);
          await syncSpreadsheetValues(res.accessToken, idToUse || spreadsheetId || "", transactions);
          const nowStr = new Date().toLocaleString("pt-BR");
          setLastSyncTime(nowStr);
          localStorage.setItem("gasp_google_sheets_last_sync", nowStr);
        }
      } catch (error: any) {
        console.error("Auth and sync error:", error);
        alert("Para sincronizar, conecte com o Google novamente.");
      } finally {
        setIsConnecting(false);
        setIsSyncing(false);
      }
      return;
    }

    if (!idToUse) {
      alert("Por favor, crie ou vincule uma planilha do Google Sheets primeiro.");
      return;
    }

    setIsSyncing(true);
    try {
      await syncSpreadsheetValues(tokenToUse, idToUse, transactions);
      const nowStr = new Date().toLocaleString("pt-BR");
      setLastSyncTime(nowStr);
      localStorage.setItem("gasp_google_sheets_last_sync", nowStr);
    } catch (error: any) {
      console.error("Sync error:", error);
      alert(`Falha na sincronização: ${error.message || error}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Debounced auto-sync when transactions update
  useEffect(() => {
    if (!autoSync || !accessToken || !spreadsheetId) return;

    const timer = setTimeout(() => {
      handleSyncSpreadsheet(accessToken, spreadsheetId);
    }, 2000); // 2 second debounce

    return () => clearTimeout(timer);
  }, [transactions, autoSync, accessToken, spreadsheetId]);

  const handleCreateNewSpreadsheet = async () => {
    if (!accessToken) {
      setIsConnecting(true);
      try {
        const res = await googleSignIn();
        if (res) {
          setUser(res.user);
          setAccessToken(res.accessToken);
          // continue creation
          setIsSyncing(true);
          const defaultTitle = `Gasp - Controle Financeiro (${new Date().toLocaleDateString("pt-BR")})`;
          const id = await createSpreadsheet(res.accessToken, defaultTitle);
          setSpreadsheetId(id);
          setSpreadsheetName(defaultTitle);
          localStorage.setItem("gasp_google_spreadsheet_id", id);
          localStorage.setItem("gasp_google_spreadsheet_name", defaultTitle);

          await syncSpreadsheetValues(res.accessToken, id, transactions);
          const nowStr = new Date().toLocaleString("pt-BR");
          setLastSyncTime(nowStr);
          localStorage.setItem("gasp_google_sheets_last_sync", nowStr);
        }
      } catch (e: any) {
        alert(`Erro de conexão ao criar planilha: ${e.message || e}`);
      } finally {
        setIsConnecting(false);
        setIsSyncing(false);
      }
      return;
    }

    setIsSyncing(true);
    try {
      const defaultTitle = `Gasp - Controle Financeiro (${new Date().toLocaleDateString("pt-BR")})`;
      const id = await createSpreadsheet(accessToken, defaultTitle);
      
      setSpreadsheetId(id);
      setSpreadsheetName(defaultTitle);
      localStorage.setItem("gasp_google_spreadsheet_id", id);
      localStorage.setItem("gasp_google_spreadsheet_name", defaultTitle);

      await syncSpreadsheetValues(accessToken, id, transactions);
      const nowStr = new Date().toLocaleString("pt-BR");
      setLastSyncTime(nowStr);
      localStorage.setItem("gasp_google_sheets_last_sync", nowStr);
    } catch (error: any) {
      console.error("Error creating spreadsheet:", error);
      alert(`Falha ao criar planilha: ${error.message || error}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLinkExistingSpreadsheet = (id: string) => {
    if (!id.trim()) return;
    let cleanId = id.trim();
    if (cleanId.includes("docs.google.com/spreadsheets")) {
      const match = cleanId.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match) cleanId = match[1];
    }

    setSpreadsheetId(cleanId);
    setSpreadsheetName("Planilha Vinculada");
    localStorage.setItem("gasp_google_spreadsheet_id", cleanId);
    localStorage.setItem("gasp_google_spreadsheet_name", "Planilha Vinculada");
    
    if (accessToken) {
      handleSyncSpreadsheet(accessToken, cleanId);
    }
  };

  const handleUnlinkSpreadsheet = () => {
    setShowUnlinkModal(true);
  };

  const confirmUnlinkSpreadsheet = () => {
    setSpreadsheetId(null);
    localStorage.removeItem("gasp_google_spreadsheet_id");
    localStorage.removeItem("gasp_google_spreadsheet_name");
    localStorage.removeItem("gasp_google_sheets_last_sync");
    setLastSyncTime(null);
    setShowUnlinkModal(false);
  };

  // New manual transaction form state
  const [newDesc, setNewDesc] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newType, setNewType] = useState<TransactionType>("expense");
  const [newCat, setNewCat] = useState("");
  const [newSubCat, setNewSubCat] = useState("");
  const [newSubSubCat, setNewSubSubCat] = useState("");
  const [newDate, setNewDate] = useState(new Date().toISOString().split("T")[0]);
  const [newPayment, setNewPayment] = useState("Cartão de Crédito");
  const [newNotes, setNewNotes] = useState("");

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editType, setEditType] = useState<TransactionType>("expense");
  const [editCat, setEditCat] = useState("");
  const [editSubCat, setEditSubCat] = useState("");
  const [editSubSubCat, setEditSubSubCat] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editPayment, setEditPayment] = useState("");

  // Cascading categories for Add Form
  const formSubcategories = useMemo(() => {
    if (!newCat) return [];
    const catObj = categories.find((c) => c.name === newCat);
    return catObj ? catObj.subcategories : [];
  }, [newCat, categories]);

  // Set default subcategory on category change
  const handleFormCategoryChange = (catName: string) => {
    setNewCat(catName);
    const catObj = categories.find((c) => c.name === catName);
    if (catObj && catObj.subcategories.length > 0) {
      setNewSubCat(catObj.subcategories[0]);
      if (catObj.subcategories[0] === "Mercado") {
        setNewSubSubCat(MERCADO_SUB_SUBCATEGORIES[0]);
      } else {
        setNewSubSubCat("");
      }
    } else {
      setNewSubCat("");
      setNewSubSubCat("");
    }
  };

  const handleFormSubcategoryChange = (subCatName: string) => {
    setNewSubCat(subCatName);
    if (subCatName === "Mercado") {
      setNewSubSubCat(MERCADO_SUB_SUBCATEGORIES[0]);
    } else {
      setNewSubSubCat("");
    }
  };

  const handleTypeChange = (type: TransactionType) => {
    setNewType(type);
    
    // Find first category matching this type
    const matched = categories.find((c) => {
      const catType = c.type || (c.name === "Rendimentos (Entradas)" ? "income" : "expense");
      return type === "income"
        ? (catType === "income" || catType === "both")
        : (catType === "expense" || catType === "both");
    });
    
    if (matched) {
      handleFormCategoryChange(matched.name);
    } else {
      setNewCat("");
      setNewSubCat("");
      setNewSubSubCat("");
    }
  };

  const handleEditTypeChange = (type: TransactionType) => {
    setEditType(type);
    
    // Find first category matching this type
    const matched = categories.find((c) => {
      const catType = c.type || (c.name === "Rendimentos (Entradas)" ? "income" : "expense");
      return type === "income"
        ? (catType === "income" || catType === "both")
        : (catType === "expense" || catType === "both");
    });
    
    if (matched) {
      setEditCat(matched.name);
      if (matched.subcategories.length > 0) {
        setEditSubCat(matched.subcategories[0]);
        if (matched.subcategories[0] === "Mercado") {
          setEditSubSubCat(MERCADO_SUB_SUBCATEGORIES[0]);
        } else {
          setEditSubSubCat("");
        }
      } else {
        setEditSubCat("");
        setEditSubSubCat("");
      }
    } else {
      setEditCat("");
      setEditSubCat("");
      setEditSubSubCat("");
    }
  };

  // Inline Editing cascading lists
  const editSubcategories = useMemo(() => {
    if (!editCat) return [];
    const catObj = categories.find((c) => c.name === editCat);
    return catObj ? catObj.subcategories : [];
  }, [editCat, categories]);

  const handleEditCategoryChange = (catName: string) => {
    setEditCat(catName);
    const catObj = categories.find((c) => c.name === catName);
    if (catObj && catObj.subcategories.length > 0) {
      setEditSubCat(catObj.subcategories[0]);
      if (catObj.subcategories[0] === "Mercado") {
        setEditSubSubCat(MERCADO_SUB_SUBCATEGORIES[0]);
      } else {
        setEditSubSubCat("");
      }
    } else {
      setEditSubCat("");
      setEditSubSubCat("");
    }
  };

  // Start inline editing
  const startEditing = (t: Transaction) => {
    setEditingId(t.id);
    setEditDesc(t.description);
    setEditAmount(t.amount.toString());
    setEditType(t.type);
    setEditCat(t.category);
    setEditSubCat(t.subcategory);
    setEditSubSubCat(t.subSubcategory || "");
    setEditDate(t.date);
    setEditPayment(t.paymentMethod || "Pix");
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const saveRowEdit = (id: string) => {
    const val = parseFloat(editAmount);
    if (!editDesc || isNaN(val) || val <= 0) {
      alert("Por favor insira uma descrição e um valor válido maior que zero.");
      return;
    }
    onUpdateTransaction({
      id,
      description: editDesc,
      amount: val,
      type: editType,
      category: editCat,
      subcategory: editSubCat,
      subSubcategory: editSubCat === "Mercado" ? editSubSubCat : undefined,
      date: editDate,
      paymentMethod: editPayment,
    });
    setEditingId(null);
  };

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      // 1. Search text filter
      const matchesSearch =
        t.description.toLowerCase().includes(search.toLowerCase()) ||
        t.category.toLowerCase().includes(search.toLowerCase()) ||
        t.subcategory.toLowerCase().includes(search.toLowerCase()) ||
        (t.subSubcategory && t.subSubcategory.toLowerCase().includes(search.toLowerCase())) ||
        (t.paymentMethod && t.paymentMethod.toLowerCase().includes(search.toLowerCase()));

      // 2. Category filter
      const matchesCat = catFilter === "all" || t.category === catFilter;

      // 3. Subcategory filter
      const matchesSubCat = subCatFilter === "all" || t.subcategory === subCatFilter;

      // 4. Type filter
      const matchesType = typeFilter === "all" || t.type === typeFilter;

      // 5. Time period filter
      let matchesTime = true;
      if (timePeriod !== "all") {
        const transDate = new Date(t.date);
        const today = new Date();
        const diffTime = Math.abs(today.getTime() - transDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (timePeriod === "week") {
          matchesTime = diffDays <= 7;
        } else if (timePeriod === "month") {
          matchesTime = diffDays <= 30;
        } else if (timePeriod === "year") {
          matchesTime = diffDays <= 365;
        }
      }

      return matchesSearch && matchesCat && matchesSubCat && matchesType && matchesTime;
    }).sort((a, b) => b.date.localeCompare(a.date)); // Newest first
  }, [transactions, search, catFilter, subCatFilter, typeFilter, timePeriod]);

  // Subcategories available for active category filter
  const filterSubcategories = useMemo(() => {
    if (catFilter === "all") return [];
    const catObj = categories.find((c) => c.name === catFilter);
    return catObj ? catObj.subcategories : [];
  }, [catFilter, categories]);

  // Sum total filtered balances for context
  const filteredSummary = useMemo(() => {
    let income = 0;
    let expense = 0;
    filteredTransactions.forEach((t) => {
      if (t.type === "income") income += t.amount;
      else expense += t.amount;
    });
    return { income, expense, balance: income - expense };
  }, [filteredTransactions]);

  // Handle transaction submission
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(newAmount);
    if (!newDesc || isNaN(amt) || amt <= 0) {
      alert("Por favor insira uma descrição e um valor numérico válido.");
      return;
    }
    
    // Choose selected category or first available if empty
    let catToSave = newCat;
    let subToSave = newSubCat;
    if (!catToSave && categories.length > 0) {
      catToSave = categories[0].name;
      subToSave = categories[0].subcategories[0] || "";
    }

    onAddTransaction({
      description: newDesc,
      amount: amt,
      type: newType,
      category: catToSave,
      subcategory: subToSave,
      subSubcategory: subToSave === "Mercado" ? newSubSubCat : undefined,
      date: newDate,
      paymentMethod: newPayment,
      notes: newNotes,
    });

    // Reset Form
    setNewDesc("");
    setNewAmount("");
    setNewNotes("");
    setIsFormOpen(false);
  };

  // Clear all filters
  const clearFilters = () => {
    setSearch("");
    setCatFilter("all");
    setSubCatFilter("all");
    setTypeFilter("all");
    setTimePeriod("all");
  };

  // Export spreadsheet to Excel-compatible UTF-8 Semicolon CSV
  const exportExcel = () => {
    const headers = ["Data", "Tipo", "Descrição", "Categoria", "Subcategoria", "Sub-Subcategoria (Mercado)", "Valor (R$)", "Forma de Pagamento"];
    const rows = filteredTransactions.map((t) => [
      t.date,
      t.type === "income" ? "Receita" : "Despesa",
      t.description.replace(/"/g, '""'),
      t.category,
      t.subcategory,
      t.subSubcategory || "",
      t.amount.toFixed(2),
      t.paymentMethod || "",
    ]);

    // Microsoft Excel needs semicolon ";" as columns delimiter for pt-BR systems 
    // and a UTF-8 BOM prefix (\uFEFF) to read brazilian accent characters correctly.
    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map((r) => r.map((cell) => `"${cell}"`).join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Controle_de_Gastos_Relatorio_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Elegant Vector PDF Export
  const exportPDF = () => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    // Title
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(15, 118, 110); // teal-700
    doc.text("Gasp - Controle Financeiro", 14, 20);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(`Relatório de Lançamentos - Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}`, 14, 26);

    // Add divider
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.5);
    doc.line(14, 29, 196, 29);

    // Filters info
    let filterText = "Filtros aplicados: ";
    const activeFilters = [];
    if (catFilter !== "all") activeFilters.push(`Categoria: ${catFilter}`);
    if (subCatFilter !== "all") activeFilters.push(`Subcategoria: ${subCatFilter}`);
    if (typeFilter !== "all") activeFilters.push(`Tipo: ${typeFilter === "income" ? "Receitas" : "Despesas"}`);
    if (timePeriod !== "all") {
      const periodMap = { week: "Últimos 7 dias", month: "Últimos 30 dias", year: "Último ano" };
      activeFilters.push(`Período: ${periodMap[timePeriod as keyof typeof periodMap]}`);
    }
    if (search) activeFilters.push(`Busca: "${search}"`);
    filterText += activeFilters.length > 0 ? activeFilters.join(" | ") : "Nenhum (Todos os lançamentos)";

    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(filterText, 14, 34);

    // Summary box
    doc.setFillColor(248, 250, 252); // slate-50
    doc.roundedRect(14, 38, 182, 18, 2, 2, "F");

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105); // slate-600
    doc.text("Resumo do Período", 18, 43);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("Total Receitas:", 18, 50);
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(13, 148, 136); // teal-600
    doc.text(currencyFormatter(filteredSummary.income), 40, 50);

    doc.setFont("Helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text("Total Despesas:", 85, 50);
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(225, 29, 72); // rose-600
    doc.text(currencyFormatter(filteredSummary.expense), 110, 50);

    doc.setFont("Helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text("Saldo Líquido:", 145, 50);
    doc.setFont("Helvetica", "bold");
    const isPositive = filteredSummary.balance >= 0;
    doc.setTextColor(isPositive ? 15 : 220, isPositive ? 118 : 38, isPositive ? 110 : 38);
    doc.text(currencyFormatter(filteredSummary.balance), 167, 50);

    // Table using jspdf-autotable
    const tableHeaders = [["Data", "Tipo", "Descrição", "Categoria", "Subcategoria", "Valor"]];
    const tableRows = filteredTransactions.map((t) => [
      t.date,
      t.type === "income" ? "Receita" : "Despesa",
      t.description,
      t.category,
      t.subcategory,
      currencyFormatter(t.amount)
    ]);

    autoTable(doc, {
      startY: 60,
      head: tableHeaders,
      body: tableRows,
      theme: "striped",
      headStyles: {
        fillColor: [15, 118, 110], // teal-700
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: "bold"
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [51, 65, 85] // slate-700
      },
      columnStyles: {
        0: { cellWidth: 24 }, // Date
        1: { cellWidth: 20 }, // Type
        2: { cellWidth: "auto" }, // Description
        3: { cellWidth: 32 }, // Category
        4: { cellWidth: 32 }, // Subcategory
        5: { cellWidth: 28, halign: "right" } // Value
      },
      didDrawPage: (data) => {
        // Footer text
        const totalPages = doc.getNumberOfPages();
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184); // slate-400
        doc.text(
          `Página ${data.pageNumber} de ${totalPages}`,
          doc.internal.pageSize.width - 25,
          doc.internal.pageSize.height - 10
        );
        doc.text(
          "Gasp - Controle Financeiro Inteligente",
          14,
          doc.internal.pageSize.height - 10
        );
      }
    });

    doc.save(`Relatorio_Financeiro_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const currencyFormatter = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div className="space-y-6" id="spreadsheet-view-container">
      
      {/* Dynamic Summary Panel for Print View only */}
      <div className="print-only bg-white border border-slate-200 p-6 rounded-lg mb-4 text-slate-800">
        <h1 className="text-2xl font-bold font-display">Relatório de Controle de Gastos</h1>
        <p className="text-xs text-slate-500">Gerado automaticamente em {new Date().toLocaleDateString("pt-BR")} às {new Date().toLocaleTimeString("pt-BR")}</p>
        
        <div className="grid grid-cols-3 gap-4 mt-6 p-4 bg-slate-50 rounded-lg border border-slate-100">
          <div>
            <span className="text-xs text-slate-500 uppercase tracking-wider block">Total Receitas</span>
            <span className="text-lg font-bold text-teal-600">{currencyFormatter(filteredSummary.income)}</span>
          </div>
          <div>
            <span className="text-xs text-slate-500 uppercase tracking-wider block">Total Despesas</span>
            <span className="text-lg font-bold text-rose-600">{currencyFormatter(filteredSummary.expense)}</span>
          </div>
          <div>
            <span className="text-xs text-slate-500 uppercase tracking-wider block">Saldo do Período</span>
            <span className={`text-lg font-bold ${filteredSummary.balance >= 0 ? "text-teal-700" : "text-red-600"}`}>
              {currencyFormatter(filteredSummary.balance)}
            </span>
          </div>
        </div>
      </div>

      {/* Control Actions & Search Row */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm no-print">
        {/* Search Input */}
        <div className="relative w-full xl:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl bg-slate-50 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
            placeholder="Pesquisar descrição, categoria..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Action Buttons: Add expense manually + Export reports */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setIsFormOpen(!isFormOpen);
              if (!newCat && categories.length > 0) {
                handleFormCategoryChange(categories[0].name);
              }
            }}
            className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white font-medium text-sm px-4 py-2 rounded-xl shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4.5 h-4.5" />
            Lançamento Manual
            {isFormOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setIsSheetsPanelOpen(!isSheetsPanelOpen)}
            className={`flex items-center gap-1.5 border font-medium text-sm px-4 py-2 rounded-xl transition-all cursor-pointer ${
              isSheetsPanelOpen 
                ? "bg-emerald-50 border-emerald-200 text-emerald-700 font-semibold" 
                : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
            }`}
          >
            <FileSpreadsheet className="w-4.5 h-4.5 text-emerald-600" />
            Planilha Google Sheets
            {spreadsheetId && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>

          <button
            onClick={exportPDF}
            className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-medium text-sm px-4 py-2 rounded-xl transition-all cursor-pointer"
          >
            <FileText className="w-4.5 h-4.5 text-rose-600" />
            Relatório PDF
          </button>
        </div>
      </div>

      {/* Interactive Expandable Manual Launch Form */}
      <AnimatePresence>
        {isFormOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden bg-white rounded-2xl border border-slate-100 shadow-sm no-print"
          >
            <form onSubmit={handleAddSubmit} className="p-5 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h4 className="font-display font-semibold text-slate-800 flex items-center gap-2">
                  <Coins className="w-5 h-5 text-teal-500" />
                  Novo Lançamento Financeiro
                </h4>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Transaction Type Choice */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Tipo</label>
                  <div className="flex gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => handleTypeChange("expense")}
                      className={`flex-1 text-center py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        newType === "expense" ? "bg-white text-rose-600 shadow-sm" : "text-slate-500"
                      }`}
                    >
                      Despesa
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTypeChange("income")}
                      className={`flex-1 text-center py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        newType === "income" ? "bg-white text-teal-600 shadow-sm" : "text-slate-500"
                      }`}
                    >
                      Receita
                    </button>
                  </div>
                </div>

                {/* 2. Value Input */}
                <div>
                  <label htmlFor="form-amount" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Valor (R$)</label>
                  <input
                    id="form-amount"
                    type="number"
                    step="0.01"
                    required
                    placeholder="0,00"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm font-semibold text-slate-800"
                  />
                </div>

                {/* 3. Description */}
                <div>
                  <label htmlFor="form-desc" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Descrição</label>
                  <input
                    id="form-desc"
                    type="text"
                    required
                    placeholder="Ex: Compra de Pão"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                  />
                </div>

                {/* 4. Date */}
                <div>
                  <label htmlFor="form-date" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Data</label>
                  <input
                    id="form-date"
                    type="date"
                    required
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 5. Category Cascading Select */}
                <div>
                  <label htmlFor="form-category" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Categoria</label>
                  <select
                    id="form-category"
                    value={newCat}
                    onChange={(e) => handleFormCategoryChange(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm cursor-pointer"
                  >
                    <option value="">Selecione...</option>
                    {categories
                      .filter((c) => {
                        const catType = c.type || (c.name === "Rendimentos (Entradas)" ? "income" : "expense");
                        return newType === "income"
                          ? (catType === "income" || catType === "both")
                          : (catType === "expense" || catType === "both");
                      })
                      .map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>

                {/* 6. Subcategory Cascading Select */}
                <div>
                  <label htmlFor="form-subcategory" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Subcategoria</label>
                  <select
                    id="form-subcategory"
                    value={newSubCat}
                    onChange={(e) => handleFormSubcategoryChange(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm cursor-pointer"
                    disabled={!newCat}
                  >
                    <option value="">Selecione...</option>
                    {formSubcategories.map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 7. Sub-Subcategory (Only for Mercado) */}
                <div>
                  <label htmlFor="form-subsubcategory" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Detalhamento Mercado
                  </label>
                  <select
                    id="form-subsubcategory"
                    value={newSubSubCat}
                    onChange={(e) => setNewSubSubCat(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm cursor-pointer disabled:bg-slate-50 disabled:text-slate-400"
                    disabled={newSubCat !== "Mercado"}
                  >
                    {newSubCat === "Mercado" ? (
                      MERCADO_SUB_SUBCATEGORIES.map((ss) => (
                        <option key={ss} value={ss}>
                          {ss}
                        </option>
                      ))
                    ) : (
                      <option value="">Indisponível</option>
                    )}
                  </select>
                </div>

                {/* 8. Payment Method */}
                <div>
                  <label htmlFor="form-payment" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Forma de Pagamento</label>
                  <select
                    id="form-payment"
                    value={newPayment}
                    onChange={(e) => setNewPayment(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm cursor-pointer"
                  >
                    <option value="Cartão de Crédito">Cartão de Crédito</option>
                    <option value="Pix">Pix</option>
                    <option value="Cartão de Débito">Cartão de Débito</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Boleto">Boleto</option>
                    <option value="Transferência">Transferência bancária</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 font-medium text-sm px-4 py-2 rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-teal-600 hover:bg-teal-700 text-white font-medium text-sm px-5 py-2 rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  Salvar Lançamento
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Google Sheets Sync Settings Panel */}
      <AnimatePresence>
        {isSheetsPanelOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden bg-white rounded-2xl border border-slate-100 shadow-sm no-print"
          >
            <div className="p-5 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-3 gap-2">
                <h4 className="font-display font-semibold text-slate-800 flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
                  Sincronização com Google Sheets
                </h4>
                <div className="flex items-center gap-2">
                  {user ? (
                    <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1 rounded-full text-xs font-medium text-emerald-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Conectado como {user.displayName || user.email}
                      <button 
                        onClick={handleDisconnectGoogle}
                        className="text-emerald-900 underline hover:text-red-600 transition-colors ml-1 cursor-pointer font-bold font-sans"
                      >
                        Sair
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleConnectGoogle}
                      disabled={isConnecting}
                      className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm transition-all cursor-pointer"
                    >
                      {isConnecting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      Conectar Google Drive e Sheets
                    </button>
                  )}
                </div>
              </div>

              {!user ? (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-700">Conecte sua conta Google</p>
                    <p className="text-xs text-slate-500">
                      Para começar a atualizar seus dados em uma planilha real no Google Sheets, você precisa primeiro autorizar o Gasp a gerenciar planilhas criadas por este app.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left Column: Spreadsheet Details */}
                  <div className="space-y-3 md:border-r md:border-slate-100 md:pr-4">
                    <div>
                      <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Planilha Ativa</span>
                      {spreadsheetId ? (
                        <div className="space-y-2">
                          <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-emerald-800 truncate">{spreadsheetName}</p>
                              <p className="text-[10px] text-emerald-600 font-mono truncate">{spreadsheetId}</p>
                            </div>
                            <div className="flex gap-1.5 shrink-0">
                              <a 
                                href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}`} 
                                target="_blank" 
                                rel="noreferrer"
                                className="p-1.5 bg-white border border-emerald-200 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-all flex items-center justify-center"
                                title="Abrir planilha no Google Sheets"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                              <button 
                                onClick={handleUnlinkSpreadsheet}
                                className="p-1.5 bg-white border border-red-200 text-red-500 hover:bg-red-50 rounded-lg transition-all flex items-center justify-center"
                                title="Desvincular Planilha"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleSyncSpreadsheet()}
                              disabled={isSyncing}
                              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm transition-all cursor-pointer"
                            >
                              {isSyncing ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <RefreshCw className="w-3.5 h-3.5" />
                              )}
                              Sincronizar Agora
                            </button>
                            {lastSyncTime && (
                              <span className="text-[10px] text-slate-400">
                                Última sincronização: {lastSyncTime}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-xs text-slate-500">Você não possui nenhuma planilha vinculada a este app.</p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={handleCreateNewSpreadsheet}
                              disabled={isSyncing}
                              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg shadow-sm transition-all cursor-pointer"
                            >
                              {isSyncing ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Plus className="w-3.5 h-3.5" />
                              )}
                              Criar Nova Planilha do zero
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Settings & Import */}
                  <div className="space-y-3">
                    <div>
                      <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Configurações de Sincronização</span>
                      <label className="flex items-start gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={autoSync}
                          onChange={(e) => {
                            setAutoSync(e.target.checked);
                            localStorage.setItem("gasp_google_sheets_autosync", e.target.checked ? "true" : "false");
                          }}
                          className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div className="space-y-0.5">
                          <p className="text-xs font-semibold text-slate-700">Sincronização Automática</p>
                          <p className="text-[10px] text-slate-500">Qualquer lançamento, alteração ou exclusão feita no app será refletida instantaneamente na sua planilha do Sheets.</p>
                        </div>
                      </label>
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Vincular Planilha Existente</span>
                      <form 
                        onSubmit={(e) => {
                          e.preventDefault();
                          const val = (e.currentTarget.elements.namedItem("spreadsheetUrl") as HTMLInputElement).value;
                          handleLinkExistingSpreadsheet(val);
                          (e.currentTarget.elements.namedItem("spreadsheetUrl") as HTMLInputElement).value = "";
                        }}
                        className="flex gap-1.5"
                      >
                        <input
                          type="text"
                          name="spreadsheetUrl"
                          placeholder="Link ou ID da Planilha Google..."
                          className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                        <button
                          type="submit"
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 cursor-pointer"
                        >
                          Vincular
                        </button>
                      </form>
                      <p className="text-[9px] text-slate-400 mt-1">Insira a URL completa da planilha existente ou o ID dela.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Advanced Filters Panel */}
      <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-2xl flex flex-col lg:flex-row flex-wrap items-end gap-3 no-print">
        {/* Category filter */}
        <div className="w-full sm:w-auto flex-1 min-w-[150px]">
          <label htmlFor="filter-cat" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Filtrar Categoria</label>
          <select
            id="filter-cat"
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer text-slate-700 font-medium"
            value={catFilter}
            onChange={(e) => {
              setCatFilter(e.target.value);
              setSubCatFilter("all"); // Reset subcategory filter on category shift
            }}
          >
            <option value="all">Todas as Categorias</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Subcategory filter */}
        <div className="w-full sm:w-auto flex-1 min-w-[150px]">
          <label htmlFor="filter-subcat" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Filtrar Subcategoria</label>
          <select
            id="filter-subcat"
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer text-slate-700 font-medium disabled:bg-slate-100 disabled:text-slate-400"
            value={subCatFilter}
            onChange={(e) => setSubCatFilter(e.target.value)}
            disabled={catFilter === "all"}
          >
            <option value="all">Todas as Subcategorias</option>
            {filterSubcategories.map((sub) => (
              <option key={sub} value={sub}>
                {sub}
              </option>
            ))}
          </select>
        </div>

        {/* Type filter */}
        <div className="w-full sm:w-auto flex-1 min-w-[120px]">
          <label htmlFor="filter-type" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Filtrar Tipo</label>
          <select
            id="filter-type"
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer text-slate-700 font-medium"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
          >
            <option value="all">Todos os Fluxos</option>
            <option value="expense">Despesas (-)</option>
            <option value="income">Receitas (+)</option>
          </select>
        </div>

        {/* Period filter */}
        <div className="w-full sm:w-auto flex-1 min-w-[120px]">
          <label htmlFor="filter-period" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Filtro de Período</label>
          <select
            id="filter-period"
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer text-slate-700 font-medium"
            value={timePeriod}
            onChange={(e) => setTimePeriod(e.target.value as any)}
          >
            <option value="all">Sempre</option>
            <option value="week">Últimos 7 dias</option>
            <option value="month">Últimos 30 dias</option>
            <option value="year">Último ano</option>
          </select>
        </div>

        {/* Clear Filter button */}
        {(catFilter !== "all" || subCatFilter !== "all" || typeFilter !== "all" || timePeriod !== "all" || search !== "") && (
          <button
            type="button"
            onClick={clearFilters}
            className="flex items-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold text-xs px-3 py-2.5 rounded-xl border border-rose-100 transition-all cursor-pointer w-full sm:w-auto justify-center"
          >
            <FilterX className="w-4.5 h-4.5" />
            Limpar Filtros
          </button>
        )}
      </div>

      {/* Spreadsheet Table Sheet */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden" id="spreadsheet-table-container">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="px-5 py-4 w-32">Data</th>
                <th className="px-4 py-4 w-28">Fluxo</th>
                <th className="px-4 py-4">Descrição</th>
                <th className="px-4 py-4 w-40">Categoria</th>
                <th className="px-4 py-4 w-40">Subcategoria</th>
                <th className="px-4 py-4 w-40">Detalhamento Mercado</th>
                <th className="px-4 py-4 w-36 text-right">Valor</th>
                <th className="px-4 py-4 w-32 no-print">Forma de Pgto</th>
                <th className="px-5 py-4 w-24 text-center no-print">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map((t) => {
                  const isEditing = editingId === t.id;

                  return (
                    <tr 
                      key={t.id} 
                      className={`hover:bg-slate-50/50 transition-colors ${
                        t.type === "income" ? "bg-teal-50/5" : "bg-white"
                      }`}
                    >
                      {/* 1. Date column */}
                      <td className="px-5 py-3">
                        {isEditing ? (
                          <input
                            type="date"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-teal-500 font-medium"
                          />
                        ) : (
                          <span className="font-mono text-xs text-slate-500 font-medium">
                            {new Date(t.date + "T00:00:00").toLocaleDateString("pt-BR")}
                          </span>
                        )}
                      </td>

                      {/* 2. Type column */}
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <select
                            value={editType}
                            onChange={(e) => handleEditTypeChange(e.target.value as any)}
                            className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white focus:outline-none cursor-pointer"
                          >
                            <option value="expense">Despesa</option>
                            <option value="income">Receita</option>
                          </select>
                        ) : (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                            t.type === "income" ? "bg-teal-50 text-teal-700" : "bg-rose-50 text-rose-700"
                          }`}>
                            {t.type === "income" ? "Receita" : "Despesa"}
                          </span>
                        )}
                      </td>

                      {/* 3. Description column */}
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editDesc}
                            onChange={(e) => setEditDesc(e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-teal-500"
                          />
                        ) : (
                          <div className="flex flex-col">
                            <span>{t.description}</span>
                            {t.notes && <span className="text-[10px] text-slate-400 font-normal">{t.notes}</span>}
                          </div>
                        )}
                      </td>

                      {/* 4. Category column */}
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <select
                            value={editCat}
                            onChange={(e) => handleEditCategoryChange(e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-slate-200 bg-white rounded focus:outline-none cursor-pointer"
                          >
                            {categories
                              .filter((c) => {
                                const catType = c.type || (c.name === "Rendimentos (Entradas)" ? "income" : "expense");
                                return editType === "income"
                                  ? (catType === "income" || catType === "both")
                                  : (catType === "expense" || catType === "both");
                              })
                              .map((c) => (
                                <option key={c.id} value={c.name}>
                                  {c.name}
                                </option>
                              ))}
                          </select>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 font-medium">
                            <Tag className="w-3 h-3 text-slate-400" />
                            {t.category}
                          </span>
                        )}
                      </td>

                      {/* 5. Subcategory column */}
                      <td className="px-4 py-3 text-slate-500">
                        {isEditing ? (
                          <select
                            value={editSubCat}
                            onChange={(e) => {
                              setEditSubCat(e.target.value);
                              if (e.target.value === "Mercado") {
                                setEditSubSubCat(MERCADO_SUB_SUBCATEGORIES[0]);
                              } else {
                                setEditSubSubCat("");
                              }
                            }}
                            className="w-full px-2 py-1 text-xs border border-slate-200 bg-white rounded focus:outline-none cursor-pointer"
                            disabled={!editCat}
                          >
                            {editSubcategories.map((sub) => (
                              <option key={sub} value={sub}>
                                {sub}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span>{t.subcategory}</span>
                        )}
                      </td>

                      {/* 6. Sub-Subcategory (Mercado) column */}
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <select
                            value={editSubSubCat}
                            onChange={(e) => setEditSubSubCat(e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-slate-200 bg-white rounded focus:outline-none cursor-pointer disabled:bg-slate-50 disabled:text-slate-400"
                            disabled={editSubCat !== "Mercado"}
                          >
                            {editSubCat === "Mercado" ? (
                              MERCADO_SUB_SUBCATEGORIES.map((ss) => (
                                <option key={ss} value={ss}>
                                  {ss}
                                </option>
                              ))
                            ) : (
                              <option value="">-</option>
                            )}
                          </select>
                        ) : (
                          t.subSubcategory ? (
                            <span className="inline-flex items-center bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md text-xs font-medium">
                              🛒 {t.subSubcategory}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )
                        )}
                      </td>

                      {/* 7. Amount column */}
                      <td className="px-4 py-3 text-right">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.01"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            className="w-24 px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none text-right font-semibold focus:ring-1 focus:ring-teal-500"
                          />
                        ) : (
                          <span className={`font-mono font-semibold ${
                            t.type === "income" ? "text-teal-600" : "text-slate-800"
                          }`}>
                            {t.type === "income" ? "+" : "-"} {currencyFormatter(t.amount)}
                          </span>
                        )}
                      </td>

                      {/* 8. Payment Method column */}
                      <td className="px-4 py-3 no-print text-xs text-slate-500">
                        {isEditing ? (
                          <select
                            value={editPayment}
                            onChange={(e) => setEditPayment(e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-slate-200 bg-white rounded focus:outline-none cursor-pointer"
                          >
                            <option value="Cartão de Crédito">Cartão de Crédito</option>
                            <option value="Pix">Pix</option>
                            <option value="Cartão de Débito">Cartão de Débito</option>
                            <option value="Dinheiro">Dinheiro</option>
                            <option value="Boleto">Boleto</option>
                            <option value="Transferência">Transferência bancária</option>
                          </select>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                            {t.paymentMethod || "Pix"}
                          </span>
                        )}
                      </td>

                      {/* 9. Actions column */}
                      <td className="px-5 py-3 text-center no-print">
                        <div className="flex items-center justify-center gap-1.5">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => saveRowEdit(t.id)}
                                className="p-1 text-teal-600 hover:bg-teal-50 rounded-full transition-all cursor-pointer"
                                title="Salvar alteração"
                              >
                                <Check className="w-4.5 h-4.5" />
                              </button>
                              <button
                                onClick={cancelEditing}
                                className="p-1 text-slate-400 hover:bg-slate-100 rounded-full transition-all cursor-pointer"
                                title="Cancelar edição"
                              >
                                <X className="w-4.5 h-4.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEditing(t)}
                                className="p-1 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-full transition-all cursor-pointer"
                                title="Editar lançamento"
                              >
                                <Edit className="w-4.5 h-4.5" />
                              </button>
                              <button
                                onClick={() => setTransactionToDelete(t)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-all cursor-pointer"
                                title="Excluir lançamento"
                              >
                                <Trash2 className="w-4.5 h-4.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-slate-400">
                    Nenhum lançamento encontrado correspondente aos filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Elegant Custom Transaction Deletion Confirmation Modal */}
      <AnimatePresence>
        {transactionToDelete && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setTransactionToDelete(null)}
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
                    Excluir Lançamento?
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Você está prestes a excluir permanentemente este lançamento do seu histórico de transações:
                  </p>
                  <div className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-xs font-bold text-slate-800">{transactionToDelete.description}</p>
                    <p className="text-[11px] font-mono font-bold text-slate-500 mt-0.5">
                      {transactionToDelete.type === "income" ? "+" : "-"} {currencyFormatter(transactionToDelete.amount)} • {new Date(transactionToDelete.date + "T00:00:00").toLocaleDateString("pt-BR")}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {transactionToDelete.category} {transactionToDelete.subcategory ? `> ${transactionToDelete.subcategory}` : ""}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    onDeleteTransaction(transactionToDelete.id);
                    setTransactionToDelete(null);
                  }}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-sm cursor-pointer text-center"
                >
                  Excluir Permanentemente
                </button>
                <button
                  onClick={() => setTransactionToDelete(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold py-2.5 rounded-xl text-xs transition-all cursor-pointer text-center"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Elegant Custom Unlink Spreadsheet Confirmation Modal */}
      <AnimatePresence>
        {showUnlinkModal && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowUnlinkModal(false)}
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
                <div className="p-3 bg-amber-50 rounded-2xl text-amber-600 shrink-0">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-display font-extrabold text-base text-slate-800 leading-tight">
                    Desvincular Planilha Google?
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Você está prestes a desvincular a planilha atual. Seus dados continuarão salvos localmente e na planilha do Google Drive, mas a sincronização automática será interrompida.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={confirmUnlinkSpreadsheet}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-sm cursor-pointer text-center"
                >
                  Confirmar Desvinculação
                </button>
                <button
                  onClick={() => setShowUnlinkModal(false)}
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
