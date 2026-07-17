import React, { useState, useMemo } from "react";
import { MarketPurchase, ParsedItem } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { 
  Store, 
  Calendar, 
  ChevronDown, 
  ChevronUp, 
  Trash2, 
  Search, 
  FileText, 
  Filter, 
  ShoppingCart, 
  Tag, 
  Info,
  Layers,
  ArrowUpDown,
  TrendingDown
} from "lucide-react";

interface MarketPurchasesViewProps {
  purchases: MarketPurchase[];
  onDeletePurchase: (id: string) => void;
}

export default function MarketPurchasesView({ purchases, onDeletePurchase }: MarketPurchasesViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSubSub, setSelectedSubSub] = useState<string>("all");
  const [expandedPurchaseIds, setExpandedPurchaseIds] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"date" | "amount">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const toggleExpand = (id: string) => {
    if (expandedPurchaseIds.includes(id)) {
      setExpandedPurchaseIds(expandedPurchaseIds.filter((pId) => pId !== id));
    } else {
      setExpandedPurchaseIds([...expandedPurchaseIds, id]);
    }
  };

  const toggleAllExpand = () => {
    if (expandedPurchaseIds.length === purchases.length) {
      setExpandedPurchaseIds([]);
    } else {
      setExpandedPurchaseIds(purchases.map(p => p.id));
    }
  };

  // List of sub-subcategories for filtering
  const subSubcategories = ["Alimentação", "Produtos de Limpeza", "Higiene Pessoal", "Bebidas", "Outros"];

  // Colors for badges
  const getSubSubColorClass = (subSub: string) => {
    switch (subSub) {
      case "Alimentação":
        return "bg-emerald-50 text-emerald-700 border-emerald-150";
      case "Produtos de Limpeza":
        return "bg-blue-50 text-blue-700 border-blue-150";
      case "Higiene Pessoal":
        return "bg-purple-50 text-purple-700 border-purple-150";
      case "Bebidas":
        return "bg-amber-50 text-amber-700 border-amber-150";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200/60";
    }
  };

  // Computed metrics
  const stats = useMemo(() => {
    let totalSpent = 0;
    let totalItemsCount = 0;
    const categoryTotals: Record<string, number> = {
      "Alimentação": 0,
      "Produtos de Limpeza": 0,
      "Higiene Pessoal": 0,
      "Bebidas": 0,
      "Outros": 0
    };

    purchases.forEach((p) => {
      totalSpent += p.totalAmount;
      p.items.forEach((item) => {
        totalItemsCount += item.quantity;
        const cat = item.subSubcategory || "Outros";
        if (categoryTotals[cat] !== undefined) {
          categoryTotals[cat] += item.total;
        } else {
          categoryTotals["Outros"] += item.total;
        }
      });
    });

    return {
      totalSpent,
      totalPurchases: purchases.length,
      totalItemsCount: Math.round(totalItemsCount),
      categoryTotals
    };
  }, [purchases]);

  // Filtered and sorted purchases
  const filteredPurchases = useMemo(() => {
    return purchases
      .map((p) => {
        // Filter items within the purchase
        const filteredItems = p.items.filter((item) => {
          const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                p.marketName.toLowerCase().includes(searchTerm.toLowerCase());
          const matchesCategory = selectedSubSub === "all" || item.subSubcategory === selectedSubSub;
          return matchesSearch && matchesCategory;
        });

        const filteredSum = filteredItems.reduce((sum, item) => sum + item.total, 0);

        return {
          ...p,
          filteredItems,
          filteredSum
        };
      })
      .filter((p) => p.filteredItems.length > 0)
      .sort((a, b) => {
        let valA: any = a[sortBy === "date" ? "date" : "totalAmount"];
        let valB: any = b[sortBy === "date" ? "date" : "totalAmount"];

        if (sortBy === "date") {
          valA = new Date(valA).getTime();
          valB = new Date(valB).getTime();
        }

        if (sortOrder === "desc") {
          return valB - valA;
        } else {
          return valA - valB;
        }
      });
  }, [purchases, searchTerm, selectedSubSub, sortBy, sortOrder]);

  const currencyFormatter = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  const handleSortToggle = (type: "date" | "amount") => {
    if (sortBy === type) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(type);
      setSortOrder("desc");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 w-48 h-48 bg-rose-500/5 rounded-full blur-2xl pointer-events-none" />
        
        <div className="space-y-1.5 relative z-10">
          <span className="text-[10px] uppercase font-bold tracking-widest text-teal-400 bg-teal-950 border border-teal-850 px-2.5 py-0.5 rounded-full">Detalhado</span>
          <h1 className="text-2xl font-display font-black tracking-tight text-white flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-teal-400" /> Itens de Mercado
          </h1>
          <p className="text-xs text-slate-400 leading-normal max-w-lg">
            Visualize os cupons fiscais completos importados pela IA. Os lançamentos individuais estão arquivados aqui, mantendo sua planilha e tela de lançamentos limpas e consolidadas.
          </p>
        </div>
      </div>

      {/* Metrics Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Total Groceries spent */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-teal-50 text-teal-600 border border-teal-100/50">
            <TrendingDown className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Investimento Total em Mercado</span>
            <span className="text-xl font-display font-black text-slate-800 mt-0.5 block leading-none">
              {currencyFormatter(stats.totalSpent)}
            </span>
            <span className="text-[10px] text-slate-400 block mt-1">
              Soma de {stats.totalPurchases} notas arquivadas
            </span>
          </div>
        </div>

        {/* Total products/items quantity */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100/50">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Unidades Adquiridas</span>
            <span className="text-xl font-display font-black text-slate-800 mt-0.5 block leading-none">
              {stats.totalItemsCount} <span className="text-xs text-slate-400 font-normal">itens</span>
            </span>
            <span className="text-[10px] text-slate-400 block mt-1">
              Consumo mapeado pelo scanner inteligente
            </span>
          </div>
        </div>

        {/* Quick Tips */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-center text-xs text-slate-500 leading-relaxed space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-teal-500" /> Como Funciona?
          </span>
          <p className="text-[11px] text-slate-500">
            Ao ler uma nota Carioca, a IA analisa todos os produtos. No fluxo principal é gerada apenas uma despesa única com o total da nota. Toda a sua itemização fica arquivada com segurança nesta aba.
          </p>
        </div>
      </div>

      {/* Main interactive grid: Left filters & Right receipts list */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left filters & breakdown card */}
        <div className="lg:col-span-1 space-y-4">
          {/* Controls card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-50 pb-2.5">
              <Filter className="w-4 h-4 text-teal-600" /> Filtros e Busca
            </h3>

            {/* Search Input */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Buscar Produto/Mercado</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ex: Arroz, Heineken, Zona Sul..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8.5 pr-3 py-1.5 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              </div>
            </div>

            {/* Sub-subcategory Filter */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Classificação do Item</label>
              <select
                value={selectedSubSub}
                onChange={(e) => setSelectedSubSub(e.target.value)}
                className="w-full border border-slate-200 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 rounded-xl text-xs font-semibold text-slate-700 bg-white cursor-pointer"
              >
                <option value="all">Todas as Categorias</option>
                {subSubcategories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Sorting controls */}
            <div className="space-y-2 pt-2 border-t border-slate-50">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Ordenar Lançamentos</span>
              <div className="flex gap-2">
                <button
                  onClick={() => handleSortToggle("date")}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all flex items-center justify-center gap-1 ${
                    sortBy === "date"
                      ? "bg-teal-50 border-teal-200 text-teal-700 font-extrabold"
                      : "bg-white border-slate-250 text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Calendar className="w-3 h-3" /> Data {sortBy === "date" && (sortOrder === "desc" ? "↓" : "↑")}
                </button>
                <button
                  onClick={() => handleSortToggle("amount")}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all flex items-center justify-center gap-1 ${
                    sortBy === "amount"
                      ? "bg-teal-50 border-teal-200 text-teal-700 font-extrabold"
                      : "bg-white border-slate-250 text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Tag className="w-3 h-3" /> Valor {sortBy === "amount" && (sortOrder === "desc" ? "↓" : "↑")}
                </button>
              </div>
            </div>
          </div>

          {/* Sub-subcategory spend distribution list */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4.5">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-50 pb-2.5">
              <Layers className="w-4 h-4 text-teal-600" /> Distribuição de Gastos
            </h3>
            
            <div className="space-y-3">
              {Object.entries(stats.categoryTotals).map(([cat, val]) => {
                const total = val as number;
                const percentage = stats.totalSpent > 0 ? Math.round((total / stats.totalSpent) * 100) : 0;
                
                return (
                  <div key={cat} className="space-y-1">
                    <div className="flex justify-between items-center text-[11px] font-semibold">
                      <span className="text-slate-600">{cat}</span>
                      <span className="text-slate-800 font-mono font-bold">{currencyFormatter(total)}</span>
                    </div>
                    <div className="w-full bg-slate-50 h-2 rounded-full overflow-hidden border border-slate-100">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          cat === "Alimentação" ? "bg-emerald-500" :
                          cat === "Produtos de Limpeza" ? "bg-blue-500" :
                          cat === "Higiene Pessoal" ? "bg-purple-500" :
                          cat === "Bebidas" ? "bg-amber-500" : "bg-slate-400"
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[9px] text-slate-400">
                      <span>{percentage}% do total de mercado</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right receipts list */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Cupons e Notas ({filteredPurchases.length})
            </span>
            {purchases.length > 0 && (
              <button
                onClick={toggleAllExpand}
                className="text-xs font-bold text-teal-600 hover:text-teal-700 transition-all px-3 py-1 bg-teal-50 hover:bg-teal-100 border border-teal-150 rounded-xl cursor-pointer"
              >
                {expandedPurchaseIds.length === purchases.length ? "Recolher Todos" : "Expandir Todos"}
              </button>
            )}
          </div>

          {filteredPurchases.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-3xl border border-dashed border-slate-200 text-slate-400 space-y-4">
              <div className="p-4 bg-slate-50 rounded-full inline-block text-slate-300">
                <ShoppingCart className="w-12 h-12" />
              </div>
              <div className="space-y-1.5 max-w-sm mx-auto">
                <p className="text-sm font-semibold text-slate-700">Nenhum item ou nota fiscal encontrado.</p>
                <p className="text-xs text-slate-400 leading-normal">
                  {purchases.length === 0 
                    ? "As compras detalhadas são criadas automaticamente ao importar recibos usando o 'Scanner Inteligente'. Experimente enviar uma imagem ou link da nota carioca!"
                    : "Nenhuma compra atende aos filtros de busca ou classificação selecionados. Limpe os filtros para visualizar novamente."}
                </p>
              </div>
              {purchases.length > 0 && (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setSelectedSubSub("all");
                  }}
                  className="bg-teal-600 hover:bg-teal-750 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-sm"
                >
                  Limpar Filtros
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPurchases.map((p) => {
                const isExpanded = expandedPurchaseIds.includes(p.id);
                const showItemCount = p.filteredItems.length;
                const matchesCountMsg = p.items.length === showItemCount 
                  ? `${p.items.length} itens` 
                  : `${showItemCount} de ${p.items.length} itens correspondentes`;

                return (
                  <motion.div
                    key={p.id}
                    layout="position"
                    className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden transition-all duration-200"
                  >
                    {/* Receipt Card Header */}
                    <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-50">
                      <div className="flex items-start gap-3.5">
                        <div className="p-3 bg-slate-100 text-slate-600 border border-slate-200/50 rounded-xl">
                          <Store className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-slate-800 leading-none">
                            {p.marketName}
                          </h4>
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="text-slate-400 font-medium flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" /> {formatDate(p.date)}
                            </span>
                            <span className="w-1 h-1 bg-slate-200 rounded-full" />
                            <span className="text-slate-500 font-semibold bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                              {matchesCountMsg}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right aligned values and buttons */}
                      <div className="flex items-center justify-between sm:justify-end gap-5">
                        <div className="text-left sm:text-right">
                          <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Total Selecionado</span>
                          <span className="text-base font-black font-mono text-slate-800">
                            {currencyFormatter(p.filteredSum)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {/* Toggle Expand details button */}
                          <button
                            onClick={() => toggleExpand(p.id)}
                            className={`p-2 rounded-xl border transition-all cursor-pointer ${
                              isExpanded 
                                ? "bg-teal-50 border-teal-100 text-teal-600" 
                                : "bg-white border-slate-200/80 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                            }`}
                            title={isExpanded ? "Esconder Itens" : "Visualizar Itens Detalhados"}
                          >
                            {isExpanded ? (
                              <div className="flex items-center gap-1 text-[11px] font-bold">
                                <span>Ocultar</span>
                                <ChevronUp className="w-4 h-4" />
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-[11px] font-bold">
                                <span>Ver Itens</span>
                                <ChevronDown className="w-4 h-4" />
                              </div>
                            )}
                          </button>

                          {/* Delete Receipt button */}
                          <button
                            onClick={() => {
                              if (window.confirm("Deseja mesmo remover esta nota detalhada do histórico de mercado? Isso NÃO apagará o lançamento na planilha principal.")) {
                                onDeletePurchase(p.id);
                              }
                            }}
                            className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200/80 hover:border-rose-100 rounded-xl transition-all cursor-pointer"
                            title="Remover Nota Detalhada"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Receipt Card Body - Detailed Itemized list of products */}
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden bg-slate-50/50 border-t border-slate-50"
                        >
                          <div className="p-4 sm:p-5">
                            <div className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-xs">
                              <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                  <thead>
                                    <tr className="bg-slate-50/70 border-b border-slate-100 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                      <th className="px-4 py-3">Produto / Item</th>
                                      <th className="px-4 py-3 w-40">Classificação</th>
                                      <th className="px-4 py-3 w-28 text-right">Preço Unitário</th>
                                      <th className="px-4 py-3 w-24 text-center">Quant.</th>
                                      <th className="px-4 py-3 w-32 text-right">Subtotal</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                                    {p.filteredItems.map((item, idx) => (
                                      <tr key={idx} className="hover:bg-slate-50/40 transition-colors">
                                        {/* Product Name */}
                                        <td className="px-4 py-3 font-semibold text-slate-800">
                                          {item.name}
                                        </td>
                                        
                                        {/* SubSubcategory badge */}
                                        <td className="px-4 py-3">
                                          <span className={`text-[8.5px] px-2 py-0.5 rounded-md font-bold tracking-wider border ${getSubSubColorClass(item.subSubcategory)}`}>
                                            {item.subSubcategory || "Outros"}
                                          </span>
                                        </td>

                                        {/* Unit price */}
                                        <td className="px-4 py-3 text-right font-mono font-medium text-slate-500">
                                          {currencyFormatter(item.price)}
                                        </td>

                                        {/* Quantity */}
                                        <td className="px-4 py-3 text-center font-mono font-bold text-slate-700">
                                          {item.quantity}
                                        </td>

                                        {/* Total Subtotal */}
                                        <td className="px-4 py-3 text-right font-mono font-black text-slate-800">
                                          {currencyFormatter(item.total)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
