import React, { useState, useRef } from "react";
import { ParsedReceipt, ParsedItem, Transaction, MarketPurchase } from "../types";
import { MERCADO_SUB_SUBCATEGORIES } from "../data";
import { motion, AnimatePresence } from "motion/react";
import { 
  QrCode, 
  Upload, 
  Camera, 
  Link2, 
  FileText, 
  Sparkles, 
  Check, 
  AlertCircle, 
  Loader2, 
  ArrowRight,
  Plus,
  Trash2,
  Calendar,
  Store,
  Info
} from "lucide-react";

interface ScannerViewProps {
  onImportTransactions: (items: Transaction[], marketPurchase: MarketPurchase) => void;
}

const SCAN_STEPS = [
  "Preparando arquivos e codificando mídias...",
  "Conectando ao motor de IA Gemini 3.5 Flash...",
  "Lendo caracteres, descrições e valores...",
  "Itemizando compras e aplicando inteligência de classificação...",
  "Pronto! Renderizando itens detalhados..."
];

export default function ScannerView({ onImportTransactions }: ScannerViewProps) {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState("");
  const [pastedText, setPastedText] = useState("");
  
  // App states
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedReceipt | null>(null);

  // File Upload Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Trigger base64 conversion
  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64Str = (reader.result as string).split(",")[1];
        resolve(base64Str);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setError(null);
    }
  };

  // Attempt to fetch URL HTML server-side
  const handleFetchUrl = async () => {
    if (!qrUrl) return;
    setLoading(true);
    setLoadingStep(0);
    setError(null);
    setInfoMessage(null);

    const stepInterval = setInterval(() => {
      setLoadingStep((prev) => (prev < 2 ? prev + 1 : prev));
    }, 1200);

    try {
      const res = await fetch("/api/fetch-invoice-html", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: qrUrl }),
      });

      const data = await res.json();
      clearInterval(stepInterval);

      if (!res.ok) {
        throw new Error(data.error || "Erro ao tentar ler o site governamental.");
      }

      setPastedText(data.text);
      setInfoMessage("✓ Link decodificado com sucesso! O texto extraído da Nota Carioca foi inserido abaixo para ser analisado pela IA.");
      setLoading(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
      setLoading(false);
    }
  };

  // Main analyze trigger
  const handleAnalyzeReceipt = async () => {
    setLoading(true);
    setError(null);
    setInfoMessage(null);
    setLoadingStep(0);

    // Stagger loading step logging for beautiful feedback
    const stepInterval = setInterval(() => {
      setLoadingStep((prev) => {
        if (prev < SCAN_STEPS.length - 2) {
          return prev + 1;
        }
        return prev;
      });
    }, 1800);

    try {
      let imageBase64 = "";
      let mimeType = "";

      if (imageFile) {
        imageBase64 = await convertFileToBase64(imageFile);
        mimeType = imageFile.type;
      }

      if (!imageBase64 && !pastedText && !qrUrl) {
        throw new Error("Por favor, envie uma foto do recibo/QR Code, cole o texto da nota ou insira o link correspondente.");
      }

      setLoadingStep(3); // Classifying...

      const response = await fetch("/api/parse-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: imageBase64 || undefined,
          mimeType: mimeType || undefined,
          text: pastedText || undefined,
          qrUrl: qrUrl || undefined,
        }),
      });

      const resData = await response.json();
      clearInterval(stepInterval);

      if (!response.ok) {
        throw new Error(resData.error || "Não foi possível obter uma resposta do modelo de Inteligência Artificial.");
      }

      setLoadingStep(4); // Rendering...
      setTimeout(() => {
        // Map parsed items to add standard selected key
        if (resData.data && resData.data.items) {
          const itemsWithSelection = resData.data.items.map((item: any) => ({
            ...item,
            selected: true, // Default to select everything found
          }));
          setParsedData({
            ...resData.data,
            items: itemsWithSelection,
          });
        } else {
          throw new Error("A Inteligência Artificial não conseguiu ler nenhum item nesta nota. Tente tirar uma foto mais nítida ou copie os detalhes em formato texto.");
        }
        setLoading(false);
      }, 800);

    } catch (err: any) {
      clearInterval(stepInterval);
      console.error(err);
      setError(err.message);
      setLoading(false);
    }
  };

  // Modify parsed results locally before importing
  const handleEditMarketName = (val: string) => {
    if (!parsedData) return;
    setParsedData({ ...parsedData, marketName: val });
  };

  const handleEditDate = (val: string) => {
    if (!parsedData) return;
    setParsedData({ ...parsedData, date: val });
  };

  const handleToggleItemSelect = (index: number) => {
    if (!parsedData) return;
    const items = [...parsedData.items];
    items[index].selected = !items[index].selected;
    
    // Recompute total amount
    const totalAmount = items.reduce((sum, item) => sum + (item.selected ? item.total : 0), 0);
    setParsedData({ ...parsedData, items, totalAmount });
  };

  const handleEditItemName = (index: number, val: string) => {
    if (!parsedData) return;
    const items = [...parsedData.items];
    items[index].name = val;
    setParsedData({ ...parsedData, items });
  };

  const handleEditItemPrice = (index: number, val: string) => {
    if (!parsedData) return;
    const items = [...parsedData.items];
    const price = parseFloat(val) || 0;
    items[index].price = price;
    items[index].total = price * items[index].quantity;
    const totalAmount = items.reduce((sum, item) => sum + (item.selected ? item.total : 0), 0);
    setParsedData({ ...parsedData, items, totalAmount });
  };

  const handleEditItemQty = (index: number, val: string) => {
    if (!parsedData) return;
    const items = [...parsedData.items];
    const qty = parseFloat(val) || 0;
    items[index].quantity = qty;
    items[index].total = items[index].price * qty;
    const totalAmount = items.reduce((sum, item) => sum + (item.selected ? item.total : 0), 0);
    setParsedData({ ...parsedData, items, totalAmount });
  };

  const handleEditItemSubSub = (index: number, val: string) => {
    if (!parsedData) return;
    const items = [...parsedData.items];
    items[index].subSubcategory = val;
    setParsedData({ ...parsedData, items });
  };

  const handleRemoveParsedItem = (index: number) => {
    if (!parsedData) return;
    const items = parsedData.items.filter((_, i) => i !== index);
    const totalAmount = items.reduce((sum, item) => sum + (item.selected ? item.total : 0), 0);
    setParsedData({ ...parsedData, items, totalAmount });
  };

  // Convert parsed items to main Finance database transactions
  const handleSaveToMainLog = () => {
    if (!parsedData) return;
    const selectedItems = parsedData.items.filter((item) => item.selected);

    if (selectedItems.length === 0) {
      alert("Nenhum item selecionado para salvar!");
      return;
    }

    const parentId = `sc_parent_${Date.now()}`;
    const totalSelectedAmount = selectedItems.reduce((sum, item) => sum + item.total, 0);

    // One combined transaction to avoid polluting the spreadsheet!
    const parentTransaction: Transaction = {
      id: parentId,
      date: parsedData.date || new Date().toISOString().split("T")[0],
      description: `Compra Mercado - ${parsedData.marketName}`,
      amount: parseFloat(totalSelectedAmount.toFixed(2)),
      type: "expense",
      category: "Alimentação",
      subcategory: "Mercado",
      paymentMethod: "Cartão de Crédito", // default assumption
      notes: `Compra agrupada contendo ${selectedItems.length} itens. Detalhes completos disponíveis na aba Itens de Mercado.`,
    };

    // Store full market purchase details
    const marketPurchase: MarketPurchase = {
      id: `mp_${Date.now()}`,
      transactionId: parentId,
      marketName: parsedData.marketName,
      date: parsedData.date || new Date().toISOString().split("T")[0],
      totalAmount: parseFloat(totalSelectedAmount.toFixed(2)),
      items: selectedItems,
    };

    onImportTransactions([parentTransaction], marketPurchase);
    
    // Reset scanner states
    setParsedData(null);
    setImageFile(null);
    setImagePreview(null);
    setQrUrl("");
    setPastedText("");
    alert(`✓ Compra agrupada no valor de ${currencyFormatter(totalSelectedAmount)} cadastrada! Os ${selectedItems.length} itens individuais foram arquivados e podem ser vistos de forma completa na aba 'Itens de Mercado'.`);
  };

  const clearAllInput = () => {
    setImageFile(null);
    setImagePreview(null);
    setQrUrl("");
    setPastedText("");
    setError(null);
    setInfoMessage(null);
    setParsedData(null);
  };

  const currencyFormatter = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div className="space-y-6" id="scanner-view-container">
      {/* Introduction Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-semibold text-slate-800 flex items-center gap-2">
            <QrCode className="w-6 h-6 text-teal-500" />
            Scanner Inteligente de Notas Fiscais
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Envie a foto de um cupom ou insira o link da Nota Carioca rj.gov.br para itemizar as despesas de supermercado em subsubcategorias automaticamente com IA.
          </p>
        </div>
        {parsedData && (
          <button
            onClick={clearAllInput}
            className="text-xs text-rose-500 font-semibold border border-rose-200 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
          >
            Escanear Outra Nota
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          /* LOADING STATE: ANIMATED SCANNER PROGRESS */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white border border-slate-100 rounded-2xl p-12 text-center shadow-sm flex flex-col items-center justify-center min-h-[400px]"
            id="scanner-loading-screen"
          >
            <div className="relative mb-6">
              <div className="w-20 h-20 rounded-full border-4 border-slate-100 border-t-teal-500 animate-spin flex items-center justify-center" />
              <QrCode className="w-8 h-8 text-teal-500 absolute inset-0 m-auto animate-pulse" />
            </div>
            
            <h3 className="text-lg font-display font-semibold text-slate-800 mb-2">Processando Notas Fiscais com IA</h3>
            
            <div className="w-full max-w-md bg-slate-100 h-2 rounded-full overflow-hidden mt-4 relative">
              <motion.div 
                className="h-full bg-teal-500"
                initial={{ width: "0%" }}
                animate={{ width: `${((loadingStep + 1) / SCAN_STEPS.length) * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            
            <p className="text-sm text-teal-600 font-semibold mt-4 h-6 animate-pulse">
              {SCAN_STEPS[loadingStep]}
            </p>
            
            <p className="text-xs text-slate-400 mt-2">Isso pode levar de 5 a 15 segundos dependendo do tamanho da compra.</p>
          </motion.div>
        ) : !parsedData ? (
          /* INPUT FORM STATE: PHOTO / LINK / TEXT */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            id="scanner-inputs-grid"
          >
            {/* Box 1: Image Drag-n-Drop & Upload */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 flex flex-col justify-between">
              <div>
                <h4 className="font-display font-semibold text-slate-800 flex items-center gap-2 mb-1">
                  <Camera className="w-5 h-5 text-teal-500" />
                  Foto ou Captura da Nota / QR Code
                </h4>
                <p className="text-xs text-slate-400">Arraste ou envie uma imagem nítida da nota ou do QR Code impresso no cupom</p>
              </div>

              {imagePreview ? (
                <div className="relative border border-slate-200 rounded-xl overflow-hidden h-64 bg-slate-50 flex items-center justify-center group">
                  <img src={imagePreview} alt="Recibo enviado" className="max-h-full max-w-full object-contain" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-white hover:bg-slate-50 text-slate-800 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Alterar Imagem
                    </button>
                    <button
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview(null);
                      }}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 hover:border-teal-500 hover:bg-slate-50/50 transition-all rounded-xl h-64 flex flex-col items-center justify-center p-6 text-center cursor-pointer group"
                >
                  <div className="p-4 rounded-full bg-slate-50 text-slate-400 group-hover:text-teal-50 group-hover:bg-teal-50 transition-all mb-3">
                    <Upload className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 block">Escolha uma imagem</span>
                  <span className="text-xs text-slate-400 mt-1 block">ou tire uma foto pelo smartphone</span>
                  <span className="text-[10px] text-slate-400 font-mono mt-3 uppercase">JPEG, PNG ou WEBP</span>
                </div>
              )}

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />

              <div className="bg-teal-50/50 p-3.5 rounded-xl border border-teal-100/60 flex gap-2.5">
                <Sparkles className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5 animate-pulse" />
                <span className="text-xs text-teal-800 leading-normal">
                  <strong>Tecnologia OCR + IA:</strong> O Gemini lerá a imagem, extrairá os produtos do supermercado e agrupará cada item em categorias de Limpeza, Alimentação, Higiene e outros.
                </span>
              </div>
            </div>

            {/* Box 2: Link / URL & Text Import */}
            <div className="space-y-6">
              {/* Link Input Section */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <div>
                  <h4 className="font-display font-semibold text-slate-800 flex items-center gap-2 mb-1">
                    <Link2 className="w-5 h-5 text-teal-500" />
                    Link da NFC-e (Nota Carioca / Rio)
                  </h4>
                  <p className="text-xs text-slate-400">Cole a URL do QR Code da sua nota carioca da fazenda rj.gov.br</p>
                </div>

                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="http://www4.fazenda.rj.gov.br/consultaNFCe/..."
                    value={qrUrl}
                    onChange={(e) => setQrUrl(e.target.value)}
                    className="block w-full border border-slate-200 rounded-xl bg-slate-50 px-3 py-2 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleFetchUrl}
                    disabled={!qrUrl}
                    className="bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs px-4 py-2 rounded-xl transition-all disabled:bg-slate-100 disabled:text-slate-400 cursor-pointer flex-shrink-0"
                  >
                    Decodificar
                  </button>
                </div>

                <div className="text-[11px] text-slate-400 bg-slate-50 p-3 rounded-lg border border-slate-100 flex items-start gap-1.5">
                  <Info className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 mt-0.5" />
                  <span>
                    Como muitos portais estaduais barram consultas diretas por robôs, se a decodificação de link der erro, você pode simplesmente <strong>copiar o texto</strong> dos itens na tela e colar abaixo, ou <strong>fazer upload de um print</strong>.
                  </span>
                </div>
              </div>

              {/* Raw Text Box */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <div>
                  <h4 className="font-display font-semibold text-slate-800 flex items-center gap-2 mb-1">
                    <FileText className="w-5 h-5 text-teal-500" />
                    Colar Texto Detalhado da Nota (Opcional)
                  </h4>
                  <p className="text-xs text-slate-400">Se preferir, copie toda a tabela de itens do portal fiscal e cole abaixo:</p>
                </div>

                <textarea
                  placeholder="Cole aqui os dados copiados da nota fiscal. Ex:
1  ARROZ CARIOCA T1 1KG  R$ 6,50
2  DETERGENTE IPE 500ML  R$ 3,20"
                  rows={4}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl bg-slate-50 p-3 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs font-mono"
                />

                {infoMessage && (
                  <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-teal-800 text-xs">
                    {infoMessage}
                  </div>
                )}

                {error && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4.5 h-4.5 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  {(imageFile || pastedText || qrUrl) && (
                    <button
                      onClick={clearAllInput}
                      className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 font-semibold text-xs px-4 py-2 rounded-xl cursor-pointer"
                    >
                      Limpar
                    </button>
                  )}
                  <button
                    onClick={handleAnalyzeReceipt}
                    disabled={!imageFile && !pastedText && !qrUrl}
                    className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs px-5 py-2.5 rounded-xl shadow-md transition-all cursor-pointer disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none"
                  >
                    <Sparkles className="w-4 h-4 animate-spin-slow" />
                    Analisar Nota com IA
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          /* RESULTS REVIEW SCREEN */
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-6"
            id="scanner-results-container"
          >
            {/* Header: Establishment Meta */}
            <div className="border-b border-slate-100 pb-5 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <span className="text-[10px] font-bold text-teal-600 bg-teal-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                    Processado com Sucesso! 🧠
                  </span>
                  <h3 className="text-lg font-display font-bold text-slate-800 mt-1.5">Conferência dos Produtos Importados</h3>
                </div>
                <div className="bg-slate-50 border border-slate-200/60 p-3 rounded-xl text-right">
                  <span className="text-xs text-slate-400">Total Selecionado:</span>
                  <p className="text-xl font-mono font-bold text-teal-700">{currencyFormatter(parsedData.totalAmount)}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Store Name input */}
                <div>
                  <label htmlFor="scan-market" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Estabelecimento</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Store className="w-4 h-4" />
                    </div>
                    <input
                      id="scan-market"
                      type="text"
                      className="block w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                      value={parsedData.marketName}
                      onChange={(e) => handleEditMarketName(e.target.value)}
                    />
                  </div>
                </div>

                {/* Date Input */}
                <div>
                  <label htmlFor="scan-date" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Data da Compra</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <input
                      id="scan-date"
                      type="date"
                      className="block w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                      value={parsedData.date}
                      onChange={(e) => handleEditDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Editable Items Grid table */}
            <div className="border border-slate-100 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="px-4 py-3 w-12 text-center">Incluir</th>
                      <th className="px-4 py-3">Nome do Produto</th>
                      <th className="px-4 py-3 w-28 text-right">Preço Unitário</th>
                      <th className="px-4 py-3 w-24 text-center">Quant.</th>
                      <th className="px-4 py-3 w-32 text-right">Total Item</th>
                      <th className="px-4 py-3 w-48">Classificação IA (Sub-subcategoria)</th>
                      <th className="px-4 py-3 w-16 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                    {parsedData.items.map((item, idx) => (
                      <tr 
                        key={idx} 
                        className={`hover:bg-slate-50/50 transition-colors ${
                          !item.selected ? "opacity-40 bg-slate-50/30" : "bg-white"
                        }`}
                      >
                        {/* Checkbox selector */}
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={item.selected}
                            onChange={() => handleToggleItemSelect(idx)}
                            className="w-4.5 h-4.5 rounded text-teal-600 focus:ring-teal-500 border-slate-300 cursor-pointer"
                          />
                        </td>

                        {/* Editable Name */}
                        <td className="px-4 py-3 font-medium text-slate-800">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => handleEditItemName(idx, e.target.value)}
                            className="w-full border-0 focus:border border-slate-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-teal-500 bg-transparent hover:bg-slate-100/50 text-sm"
                            disabled={!item.selected}
                          />
                        </td>

                        {/* Price Unitary */}
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-slate-400 text-xs">R$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={item.price}
                              onChange={(e) => handleEditItemPrice(idx, e.target.value)}
                              className="w-16 text-right border-0 focus:border border-slate-200 rounded px-1 py-0.5 focus:outline-none bg-transparent hover:bg-slate-100/50 text-sm font-semibold"
                              disabled={!item.selected}
                            />
                          </div>
                        </td>

                        {/* Quantity */}
                        <td className="px-4 py-3 text-center">
                          <input
                            type="number"
                            step="0.1"
                            value={item.quantity}
                            onChange={(e) => handleEditItemQty(idx, e.target.value)}
                            className="w-12 text-center border-0 focus:border border-slate-200 rounded px-1 py-0.5 focus:outline-none bg-transparent hover:bg-slate-100/50 text-sm"
                            disabled={!item.selected}
                          />
                        </td>

                        {/* Computed Total */}
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">
                          {currencyFormatter(item.total)}
                        </td>

                        {/* Automatic Sub-subclass select */}
                        <td className="px-4 py-3">
                          <select
                            value={item.subSubcategory}
                            onChange={(e) => handleEditItemSubSub(idx, e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500 bg-slate-50 cursor-pointer font-medium"
                            disabled={!item.selected}
                          >
                            {MERCADO_SUB_SUBCATEGORIES.map((ss) => (
                              <option key={ss} value={ss}>
                                {ss}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Remove item button */}
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveParsedItem(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-full hover:bg-rose-50 cursor-pointer"
                            title="Remover este item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Quick summary and Action buttons */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div className="text-xs text-slate-500 text-center sm:text-left">
                💡 <strong>Dica de Organização:</strong> O aplicativo agrupará todos os itens marcados em um <strong>único lançamento consolidado</strong> de Mercado para não poluir sua planilha. Você poderá ver o detalhamento completo de cada produto na aba <strong>Itens de Mercado</strong>!
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={clearAllInput}
                  className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer"
                >
                  Descartar Nota
                </button>
                <button
                  onClick={handleSaveToMainLog}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Importar {parsedData.items.filter(i => i.selected).length} Itens Selecionados
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
