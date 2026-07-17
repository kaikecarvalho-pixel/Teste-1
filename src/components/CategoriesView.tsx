import React, { useState } from "react";
import { Category } from "../types";
import { motion } from "motion/react";
import { 
  Tag, 
  Plus, 
  Trash2, 
  FolderPlus, 
  Grid, 
  Utensils, 
  Car, 
  Home, 
  HeartPulse, 
  Sparkles, 
  GraduationCap, 
  TrendingUp, 
  Smile, 
  Briefcase, 
  Heart,
  HelpCircle,
  Paintbrush,
  X,
  Pencil
} from "lucide-react";

interface CategoriesViewProps {
  categories: Category[];
  onAddCategory: (cat: Omit<Category, "id">) => void;
  onAddSubcategory: (catId: string, subName: string) => void;
  onDeleteCategory: (id: string) => void;
  onDeleteSubcategory: (catId: string, subName: string) => void;
  onUpdateCategory: (cat: Category) => void;
}

// Icon dictionary matching names to Lucide elements
const ICON_MAP: Record<string, any> = {
  Utensils,
  Car,
  Home,
  HeartPulse,
  Sparkles,
  GraduationCap,
  TrendingUp,
  Smile,
  Briefcase,
  Heart,
  HelpCircle,
};

const COLOR_LIST = [
  { name: "Verde Esmeralda", value: "emerald" },
  { name: "Amarelo Âmbar", value: "amber" },
  { name: "Azul Marinho", value: "blue" },
  { name: "Rosa Carmin", value: "rose" },
  { name: "Roxo Violeta", value: "violet" },
  { name: "Índigo Real", value: "indigo" },
  { name: "Azul Teal", value: "teal" },
];

export default function CategoriesView({
  categories,
  onAddCategory,
  onAddSubcategory,
  onDeleteCategory,
  onDeleteSubcategory,
  onUpdateCategory,
}: CategoriesViewProps) {
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState("indigo");
  const [newCatIcon, setNewCatIcon] = useState("HelpCircle");
  const [newCatType, setNewCatType] = useState<"expense" | "income" | "both">("expense");

  // Editing state for existing categories
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState("");
  const [editCatColor, setEditCatColor] = useState("");
  const [editCatIcon, setEditCatIcon] = useState("");
  const [editCatType, setEditCatType] = useState<"expense" | "income" | "both">("expense");

  const startEditing = (cat: Category) => {
    setEditingCatId(cat.id);
    setEditCatName(cat.name);
    setEditCatColor(cat.color);
    setEditCatIcon(cat.icon);
    setEditCatType(cat.type || (cat.name === "Rendimentos (Entradas)" ? "income" : "expense"));
  };

  const handleSaveEdit = (catId: string) => {
    if (!editCatName.trim()) return;
    const cat = categories.find((c) => c.id === catId);
    if (!cat) return;

    onUpdateCategory({
      ...cat,
      name: editCatName.trim(),
      color: editCatColor,
      icon: editCatIcon,
      type: editCatType,
    });

    setEditingCatId(null);
    alert(`✓ Categoria "${editCatName.trim()}" atualizada com sucesso!`);
  };

  const cancelEditing = () => {
    setEditingCatId(null);
  };

  // Subcategory append inputs map (indexed by category ID)
  const [subInputs, setSubInputs] = useState<Record<string, string>>({});

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    onAddCategory({
      name: newCatName.trim(),
      color: newCatColor,
      icon: newCatIcon,
      subcategories: [],
      isCustom: true,
      type: newCatType,
    });

    setNewCatName("");
    setNewCatType("expense");
    alert(`✓ Categoria "${newCatName}" criada com sucesso!`);
  };

  const handleCreateSubcategory = (catId: string) => {
    const subName = subInputs[catId];
    if (!subName || !subName.trim()) return;

    onAddSubcategory(catId, subName.trim());

    // Clear input
    setSubInputs({
      ...subInputs,
      [catId]: "",
    });
  };

  // Safe icon renderer helper
  const renderIcon = (iconName: string, className = "w-5 h-5") => {
    const Component = ICON_MAP[iconName] || HelpCircle;
    return <Component className={className} />;
  };

  // Color mappings to Tailwind borders/backgrounds
  const getColorClasses = (color: string) => {
    const maps: Record<string, { bg: string; text: string; border: string; badge: string }> = {
      emerald: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-100", badge: "bg-emerald-100/60 text-emerald-800" },
      amber: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-100", badge: "bg-amber-100/60 text-amber-800" },
      blue: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-100", badge: "bg-blue-100/60 text-blue-800" },
      rose: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-100", badge: "bg-rose-100/60 text-rose-800" },
      violet: { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-100", badge: "bg-violet-100/60 text-violet-800" },
      indigo: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-100", badge: "bg-indigo-100/60 text-indigo-800" },
      teal: { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-100", badge: "bg-teal-100/60 text-teal-800" },
    };
    return maps[color] || maps.indigo;
  };

  return (
    <div className="space-y-6" id="categories-view-container">
      
      {/* Dynamic Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Create Custom Category Form */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 h-fit">
          <div>
            <h4 className="font-display font-semibold text-slate-800 flex items-center gap-2 mb-1">
              <FolderPlus className="w-5 h-5 text-teal-500" />
              Criar Nova Categoria
            </h4>
            <p className="text-xs text-slate-400">Desenhe categorias financeiras customizadas para seus gastos</p>
          </div>

          <form onSubmit={handleCreateCategory} className="space-y-4">
            {/* Category Name */}
            <div>
              <label htmlFor="cat-name-input" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Nome da Categoria</label>
              <input
                id="cat-name-input"
                type="text"
                required
                placeholder="Ex: Pet Shop, Presentes"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
              />
            </div>

            {/* Category Type (Destinação) */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Destinação</label>
              <div className="flex gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setNewCatType("expense")}
                  className={`flex-1 text-center py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    newCatType === "expense" ? "bg-white text-rose-600 shadow-sm border border-slate-200/50" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Despesas
                </button>
                <button
                  type="button"
                  onClick={() => setNewCatType("income")}
                  className={`flex-1 text-center py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    newCatType === "income" ? "bg-white text-teal-600 shadow-sm border border-slate-200/50" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Receitas
                </button>
                <button
                  type="button"
                  onClick={() => setNewCatType("both")}
                  className={`flex-1 text-center py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    newCatType === "both" ? "bg-white text-slate-700 shadow-sm border border-slate-200/50" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Ambos
                </button>
              </div>
            </div>

            {/* Colors palette */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Paintbrush className="w-3.5 h-3.5" /> Cor de Destaque
              </label>
              <div className="flex flex-wrap gap-2">
                {COLOR_LIST.map((col) => {
                  const style = getColorClasses(col.value);
                  return (
                    <button
                      key={col.value}
                      type="button"
                      onClick={() => setNewCatColor(col.value)}
                      className={`w-7 h-7 rounded-full border-2 transition-all flex items-center justify-center cursor-pointer ${
                        newCatColor === col.value ? "border-slate-800 scale-110" : "border-transparent hover:scale-105"
                      }`}
                      style={{ backgroundColor: style.badge.split(" ")[0].includes("bg-") ? undefined : "#94a3b8" }}
                      title={col.name}
                    >
                      <div className={`w-4 h-4 rounded-full ${getColorClasses(col.value).badge.split(" ")[0]}`} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Icons select */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Ícone Visual</label>
              <div className="grid grid-cols-5 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                {Object.keys(ICON_MAP).map((iconKey) => (
                  <button
                    key={iconKey}
                    type="button"
                    onClick={() => setNewCatIcon(iconKey)}
                    className={`p-2 rounded-lg border text-slate-600 transition-all cursor-pointer flex items-center justify-center ${
                      newCatIcon === iconKey
                        ? "bg-teal-600 border-teal-600 text-white shadow-sm scale-105"
                        : "bg-white border-slate-200 hover:bg-slate-100/50"
                    }`}
                  >
                    {renderIcon(iconKey, "w-4 h-4")}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs py-3 rounded-xl shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Adicionar Categoria
            </button>
          </form>
        </div>

        {/* Right Side: Existing Categories & Subcategories List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div>
              <h4 className="font-display font-semibold text-slate-800 flex items-center gap-2">
                <Grid className="w-5 h-5 text-teal-500" />
                Estrutura de Categorias Cadastradas
              </h4>
              <p className="text-xs text-slate-400">Visualize, adicione subcategorias ou remova estruturas customizadas</p>
            </div>
            <span className="text-xs font-mono font-semibold bg-slate-100 px-2.5 py-1 rounded-full text-slate-500">
              Total: {categories.length}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categories.map((cat) => {
              const classes = getColorClasses(cat.color);
              const isEditing = editingCatId === cat.id;
              
              return (
                <motion.div
                  key={cat.id}
                  whileHover={isEditing ? undefined : { y: -1 }}
                  className={`bg-white p-4 rounded-2xl border shadow-sm transition-all flex flex-col justify-between min-h-[220px] ${
                    isEditing ? "border-teal-500 ring-1 ring-teal-500/20 bg-teal-50/5" : "border-slate-100"
                  }`}
                >
                  {isEditing ? (
                    <div className="space-y-3.5 w-full text-left">
                      <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                          <Pencil className="w-3.5 h-3.5 text-teal-600" />
                          Editar Categoria
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">ID: {cat.id}</span>
                      </div>

                      {/* Name input */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nome da Categoria</label>
                        <input
                          type="text"
                          value={editCatName}
                          onChange={(e) => setEditCatName(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs font-semibold text-slate-800 bg-white"
                        />
                      </div>

                      {/* Destinação */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Destinação</label>
                        <div className="flex gap-1 bg-slate-50 p-0.5 rounded-lg border border-slate-200">
                          {(["expense", "income", "both"] as const).map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setEditCatType(t)}
                              className={`flex-1 text-center py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                                editCatType === t ? "bg-white text-teal-600 shadow-xs border border-slate-200/30" : "text-slate-500 hover:text-slate-700"
                              }`}
                            >
                              {t === "expense" ? "Despesa" : t === "income" ? "Receita" : "Ambos"}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Color Palette */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Cor</label>
                        <div className="flex flex-wrap gap-1">
                          {COLOR_LIST.map((col) => {
                            return (
                              <button
                                key={col.value}
                                type="button"
                                onClick={() => setEditCatColor(col.value)}
                                className={`w-5 h-5 rounded-full border transition-all flex items-center justify-center cursor-pointer ${
                                  editCatColor === col.value ? "border-slate-800 scale-110 shadow-xs" : "border-transparent hover:scale-105"
                                }`}
                                title={col.name}
                              >
                                <div className={`w-3 h-3 rounded-full ${getColorClasses(col.value).badge.split(" ")[0]}`} />
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Icon Palette */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Ícone</label>
                        <div className="grid grid-cols-6 gap-1 bg-slate-50 p-1.5 rounded-lg border border-slate-100 max-h-24 overflow-y-auto">
                          {Object.keys(ICON_MAP).map((iconKey) => (
                            <button
                              key={iconKey}
                              type="button"
                              onClick={() => setEditCatIcon(iconKey)}
                              className={`p-1.5 rounded border text-slate-600 transition-all cursor-pointer flex items-center justify-center ${
                                editCatIcon === iconKey
                                  ? "bg-teal-600 border-teal-600 text-white shadow-xs scale-105"
                                  : "bg-white border-slate-200 hover:bg-slate-100/50"
                              }`}
                            >
                              {renderIcon(iconKey, "w-3.5 h-3.5")}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-2 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(cat.id)}
                          className="flex-1 bg-teal-600 hover:bg-teal-700 text-white text-[10px] font-bold py-2 rounded-lg transition-all cursor-pointer shadow-xs"
                        >
                          Salvar
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditing}
                          className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold py-2 rounded-lg transition-all cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Category Header */}
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-2.5 rounded-xl ${classes.bg} ${classes.text}`}>
                            {renderIcon(cat.icon, "w-5 h-5")}
                          </div>
                          <div>
                            <h5 className="font-display font-bold text-slate-800 text-sm flex items-center gap-1.5">
                              {cat.name}
                            </h5>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {cat.isCustom && (
                                <span className="text-[8px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold font-sans uppercase tracking-wider">
                                  Custom
                                </span>
                              )}
                              <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold font-sans uppercase tracking-wider border ${
                                (cat.type || (cat.name === "Rendimentos (Entradas)" ? "income" : "expense")) === "income"
                                  ? "bg-teal-50 text-teal-700 border-teal-100"
                                  : (cat.type || (cat.name === "Rendimentos (Entradas)" ? "income" : "expense")) === "both"
                                  ? "bg-slate-50 text-slate-600 border-slate-200"
                                  : "bg-rose-50/70 text-rose-700 border-rose-100"
                              }`}>
                                {(cat.type || (cat.name === "Rendimentos (Entradas)" ? "income" : "expense")) === "income" ? "Receitas" : (cat.type || (cat.name === "Rendimentos (Entradas)" ? "income" : "expense")) === "both" ? "Ambos" : "Despesas"}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">{cat.subcategories.length} subcategorias</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => startEditing(cat)}
                            className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg cursor-pointer transition-all"
                            title="Editar Categoria"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {cat.isCustom && (
                            <button
                              onClick={() => {
                                if (confirm(`Deseja excluir a categoria customizada "${cat.name}" e todas as suas subcategorias?`)) {
                                  onDeleteCategory(cat.id);
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-all"
                              title="Excluir Categoria"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Subcategories list */}
                      <div className="flex-1 my-3">
                        {cat.subcategories.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                            {cat.subcategories.map((sub) => (
                              <span
                                key={sub}
                                className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg border ${classes.badge} ${classes.border}`}
                              >
                                {sub}
                                
                                {/* Special Mercado note */}
                                {sub === "Mercado" && (
                                  <span className="text-[9px] text-slate-400" title="Possui sub-subcategorias automáticas: Alimentação, Higiene, Limpeza, Bebidas">
                                    🛒
                                  </span>
                                )}

                                {/* Allow deleting custom subcategories or any subcategory in custom category */}
                                {cat.isCustom && (
                                  <button
                                    type="button"
                                    onClick={() => onDeleteSubcategory(cat.id, sub)}
                                    className="hover:bg-slate-200/50 rounded p-0.5 text-slate-500 hover:text-rose-600"
                                    title={`Excluir subcategoria ${sub}`}
                                  >
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                )}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400 italic py-2">Sem subcategorias. Adicione uma abaixo!</div>
                        )}
                      </div>

                      {/* Inline Form to add Subcategory to this category */}
                      <div className="flex gap-1.5 pt-3 border-t border-slate-50">
                        <input
                          type="text"
                          placeholder="Nova subcategoria..."
                          value={subInputs[cat.id] || ""}
                          onChange={(e) => setSubInputs({ ...subInputs, [cat.id]: e.target.value })}
                          className="block w-full border border-slate-200 rounded-lg bg-slate-50 px-2 py-1 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => handleCreateSubcategory(cat.id)}
                          disabled={!subInputs[cat.id]?.trim()}
                          className="bg-slate-800 hover:bg-slate-900 text-white p-1 rounded-lg disabled:bg-slate-100 disabled:text-slate-400 cursor-pointer flex-shrink-0"
                          title="Adicionar Subcategoria"
                        >
                          <Plus className="w-4.5 h-4.5" />
                        </button>
                      </div>
                    </>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
}
