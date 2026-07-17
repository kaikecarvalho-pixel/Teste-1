import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dns from "dns";

// Fix DNS resolution issues on local setups
dns.setDefaultResultOrder("ipv4first");

const app = express();
const PORT = 3000;

// Set up JSON payload limits for base64 image uploads
app.use(express.json({ limit: "15mb" }));

// Lazy initialize Gemini client
let aiClient: GoogleGenAI | null = null;

function getGemini(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("A chave GEMINI_API_KEY não foi configurada nas variáveis de ambiente.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// 1. Healthcheck API
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// 2. Fetch invoice URL if possible
app.post("/api/fetch-invoice-html", async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: "URL é obrigatória" });
  }

  try {
    // Try to fetch the URL to extract HTML text
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      },
      signal: AbortSignal.timeout(8000) // 8 second timeout
    });

    if (!response.ok) {
      throw new Error(`Falha ao acessar o link do governo (${response.status})`);
    }

    const html = await response.text();
    // Basic sanitization to avoid huge payloads to Gemini
    const cleanHtml = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      .replace(/<\/?[^>]+(>|$)/g, " ")
      .replace(/\s+/g, " ")
      .substring(0, 80000); // limit to 80k characters

    res.json({ success: true, text: cleanHtml });
  } catch (error: any) {
    console.error("Error fetching invoice URL:", error.message);
    res.status(500).json({ 
      error: "Não foi possível acessar a URL diretamente devido a proteções do portal do governo. Por favor, faça o upload de uma imagem da nota fiscal/QR code ou copie e cole o texto da nota.",
      details: error.message 
    });
  }
});

// Helper function to call Gemini with automatic retries and fallback models
async function generateContentWithRetryAndFallback(
  ai: GoogleGenAI,
  params: {
    contents: any[];
    config?: any;
  }
) {
  const modelsToTry = ["gemini-3.5-flash", "gemini-3.1-flash-lite"];
  const maxRetries = 3;
  let lastError: any = null;

  for (const modelName of modelsToTry) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Tentando processar com o modelo ${modelName} (tentativa ${attempt}/${maxRetries})...`);
        const response = await ai.models.generateContent({
          model: modelName,
          contents: params.contents,
          config: params.config,
        });
        return response;
      } catch (error: any) {
        lastError = error;
        const errStr = String(error.message || error);
        console.error(`Erro com o modelo ${modelName} na tentativa ${attempt}:`, errStr);
        
        // Check if the error is due to high demand (503), rate-limiting (429), or is transient
        const isTransient = 
          errStr.includes("503") || 
          errStr.includes("UNAVAILABLE") || 
          errStr.includes("429") || 
          errStr.includes("high demand") ||
          error.status === 503 || 
          error.status === 429 ||
          error.code === 503 ||
          error.code === 429;

        if (isTransient && attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 2s, 4s
          console.log(`Aguardando ${delay}ms antes de tentar novamente...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          // If not transient, or we exhausted retries, break to try the next model
          break;
        }
      }
    }
  }

  throw lastError;
}

// 3. Scan and Parse Receipt (Image or Text) with Gemini
app.post("/api/parse-receipt", async (req, res) => {
  const { image, mimeType, text, qrUrl } = req.body;

  try {
    const ai = getGemini();
    const contents: any[] = [];

    let prompt = `
Você é um especialista em extração de dados e finanças pessoais.
Sua missão é extrair as informações detalhadas desta nota fiscal (NFC-e ou similar) ou cupom de supermercado/loja.

Selecione a classificação exata dos itens de supermercado (Mercado) nas seguintes subsubcategorias:
- 'Alimentação' (comida, lanches, ingredientes, iogurte, carnes, bebidas, refrigerantes, etc.)
- 'Produtos de Limpeza' (detergente, amaciante, sabão em pó, desinfetante, água sanitária, etc.)
- 'Higiene Pessoal' (shampoo, condicionador, sabonete, pasta de dente, fio dental, desodorante, etc.)
- 'Outros' (sacola plástica, pilhas, utensílios de cozinha, papel alumínio, etc.)

Regras importantes de tratamento de dados:
1. 'marketName': Extraia o nome fantasia do estabelecimento comercial (ex: 'ZONA SUL', 'SUPERMERCADOS GUANABARA', 'PÃO DE AÇÚCAR'). Escreva em caixa alta, limpo e legível.
2. 'date': Extraia a data de emissão no formato YYYY-MM-DD. Se não encontrar, use a data atual (${new Date().toISOString().split("T")[0]}).
3. 'totalAmount': Extraia o valor total pago na compra (número decimal).
4. 'items': Extraia uma lista de todos os itens comprados na nota.
   - Para cada item, melhore o nome removendo abreviações feias de nota fiscal para ficar legível em português (ex: 'ARROZ T1 CARIOCA 1KG' -> 'Arroz Carioca Tipo 1 1kg', 'REFRIG COCA COLA 2L' -> 'Coca Cola 2 Litros').
   - Classifique cada item com precisão na subsubcategoria correta do Mercado ('Alimentação', 'Produtos de Limpeza', 'Higiene Pessoal' ou 'Outros').
   - O preço total ('total') de cada item deve ser igual a: quantidade * preço unitário ('price').

Forneça a saída estritamente em formato JSON correspondente ao esquema fornecido.
`;

    if (image && mimeType) {
      contents.push({
        inlineData: {
          mimeType,
          data: image,
        },
      });
      prompt += "\nAnalise a imagem da nota fiscal fornecida.";
    }

    if (text) {
      contents.push({ text: `Texto extraído da nota fiscal:\n${text}` });
      prompt += "\nAnalise o texto fornecido que foi copiado ou extraído da nota fiscal.";
    }

    if (qrUrl) {
      prompt += `\nCaso não encontre dados na imagem ou texto, o QR Code correspondente possui esta URL: ${qrUrl}. Use as informações disponíveis para preencher os dados.`;
    }

    contents.push({ text: prompt });

    const response = await generateContentWithRetryAndFallback(ai, {
      contents: contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            marketName: { 
              type: Type.STRING, 
              description: "Nome do supermercado ou estabelecimento em letras maiúsculas e legível." 
            },
            date: { 
              type: Type.STRING, 
              description: "Data da compra em formato YYYY-MM-DD. Ex: 2026-07-15." 
            },
            totalAmount: { 
              type: Type.NUMBER, 
              description: "Valor total da nota fiscal/recibo." 
            },
            items: {
              type: Type.ARRAY,
              description: "Lista de itens detalhados comprados no estabelecimento.",
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { 
                    type: Type.STRING, 
                    description: "Nome limpo e legível do produto em português (ex: 'Detergente Ipê Coco 500ml')." 
                  },
                  price: { 
                    type: Type.NUMBER, 
                    description: "Preço unitário do produto." 
                  },
                  quantity: { 
                    type: Type.NUMBER, 
                    description: "Quantidade comprada do produto." 
                  },
                  total: { 
                    type: Type.NUMBER, 
                    description: "Valor total pago por este item (quantidade * preço unitário)." 
                  },
                  subSubcategory: {
                    type: Type.STRING,
                    description: "Classificação precisa do item: 'Alimentação', 'Produtos de Limpeza', 'Higiene Pessoal' ou 'Outros'."
                  }
                },
                required: ["name", "price", "quantity", "total", "subSubcategory"]
              }
            }
          },
          required: ["marketName", "date", "totalAmount", "items"]
        },
        temperature: 0.1, // low temperature for precise extraction
      }
    });

    const resultText = response.text?.trim() || "{}";
    const parsedData = JSON.parse(resultText);

    res.json({ success: true, data: parsedData });
  } catch (error: any) {
    console.error("Error parsing receipt with Gemini:", error);
    res.status(500).json({ 
      error: "Falha ao processar nota fiscal com Inteligência Artificial.",
      details: error.message 
    });
  }
});

// Configure Vite or Serve Static Files
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
