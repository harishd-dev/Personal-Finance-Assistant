import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

// Es module path resolution
const __filename = typeof import.meta !== "undefined" && import.meta.url
  ? fileURLToPath(import.meta.url)
  : "";
const __dirname = __filename ? path.dirname(__filename) : "";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for parsing requests
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Initialize Gemini API client
  const apiKey = process.env.GEMINI_API_KEY;
  const isApiKeyConfigured = !!apiKey && apiKey !== "MY_GEMINI_API_KEY" && apiKey !== "";
  
  const ai = new GoogleGenAI({
    apiKey: isApiKeyConfigured ? apiKey : "MOCK_OR_MISSING_KEY",
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // Middleware mock guard for missing API key
  const apiCheck = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!isApiKeyConfigured) {
      return res.status(403).json({
        error: "API key missing",
        message: "Gemini API key is required but not configured. Please add your GEMINI_API_KEY in Settings > Secrets."
      });
    }
    next();
  };

  /**
   * API Route: OCR Receipt Processing
   * Receives camera capture or file uploaded from UI (base64 jpeg/png)
   */
  app.post("/api/upload-receipt", apiCheck, async (req, res) => {
    const { imageBase64, mimeType } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "Missing imageBase64 payload" });
    }

    try {
      // Decode the data part of base64
      const actualData = imageBase64.includes(",") 
        ? imageBase64.split(",")[1] 
        : imageBase64;
      
      const cleanMimeType = mimeType || "image/jpeg";

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          {
            inlineData: {
              data: actualData,
              mimeType: cleanMimeType
            }
          },
          "Extract transaction data from this receipt. Analyze the text, determine the merchant name, correct purchase date, total amount spent, logical category classification, and list individual invoice items with price."
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              merchant: { type: Type.STRING, description: "Name of the merchant" },
              date: { type: Type.STRING, description: "Date of transaction in YYYY-MM-DD format (if not present, estimate based on metadata or current year 2026)" },
              totalAmount: { type: Type.NUMBER, description: "Total amount on the receipt" },
              category: { 
                type: Type.STRING, 
                description: "Category of expense. Must be exactly one of: Food, Utilities, Entertainment, Transportation, Shopping, Health, Education, Other" 
              },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING, description: "Item description" },
                    price: { type: Type.NUMBER, description: "Item cost" }
                  },
                  required: ["name", "price"]
                }
              },
              confidence: { type: Type.NUMBER, description: "Confidence score between 0.0 and 1.0" }
            },
            required: ["merchant", "date", "totalAmount", "category", "items", "confidence"]
          },
        }
      });

      const extractedText = response.text || "{}";
      const receiptData = JSON.parse(extractedText.trim());
      res.json(receiptData);
    } catch (error: any) {
      console.error("Error processing receipt:", error);
      res.status(500).json({ 
        error: "Failed to parse receipt using Gemini AI", 
        message: error.message 
      });
    }
  });

  /**
   * API Route: Bank Statement Processing
   * Processes bank statements uploaded as PDF (inlineData base64) or CSV (as text)
   */
  app.post("/api/parse-bank-statement", apiCheck, async (req, res) => {
    const { fileBase64, fileName, mimeType } = req.body;

    if (!fileBase64) {
      return res.status(400).json({ error: "Missing fileBase64 payload" });
    }

    try {
      const isPdf = mimeType === "application/pdf" || fileName?.endsWith(".pdf");
      const actualData = fileBase64.includes(",") 
        ? fileBase64.split(",")[1] 
        : fileBase64;

      let promptText = "";
      if (isPdf) {
        promptText = "Extract historical transaction records from this bank statement. Read columns of dates, descriptions, deposits, and withdrawals. Construct an array of transactions containing date (YYYY-MM-DD), merchant description, amount (negative for spent, positive for earning), category (Food, Utilities, Entertainment, Transportation, Shopping, Health, Other), and whether it looks like a recurring fee/monthly bill (isRecurring).";
      } else {
        const decodedText = Buffer.from(actualData, "base64").toString("utf8");
        promptText = `Parse these CSV transaction rows and extract details. Read the column names if headers exist.\n\nRaw transactions content:\n${decodedText}\n\nConstruct structured output. Each transaction must have a date (YYYY-MM-DD), merchant description, amount (adjust signs: positive/negative), category (Food, Utilities, Entertainment, Transportation, Shopping, Health, Other) and isRecurring.`;
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: isPdf ? [
          {
            inlineData: {
              data: actualData,
              mimeType: "application/pdf"
            }
          },
          promptText
        ] : [
          promptText
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              transactions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    date: { type: Type.STRING, description: "Date of transaction (YYYY-MM-DD)" },
                    description: { type: Type.STRING, description: "Merchant name or description" },
                    amount: { type: Type.NUMBER, description: "Transaction amount. positive for incoming, negative for expenses" },
                    category: { 
                      type: Type.STRING, 
                      description: "Broad category: Food, Utilities, Entertainment, Transportation, Shopping, Health, Education, Income, Other" 
                    },
                    isRecurring: { type: Type.BOOLEAN, description: "Whether this represents a recurring monthly bill or subscription" }
                  },
                  required: ["date", "description", "amount", "category", "isRecurring"]
                }
              }
            },
            required: ["transactions"]
          }
        }
      });

      const parsedText = response.text || "{\"transactions\":[]}";
      res.json(JSON.parse(parsedText.trim()));
    } catch (error: any) {
      console.error("Error parsing bank statement:", error);
      res.status(500).json({ 
        error: "Failed to parse bank statement using Gemini AI", 
        message: error.message 
      });
    }
  });

  /**
   * API Route: Budget Savings Recommendations & Forecaster
   * Combines all current user transactions and monthly bills, and returns dynamic recommendation checklists and forecast charts.
   */
  app.post("/api/analyze-finance", apiCheck, async (req, res) => {
    const { transactions, monthlyBills, income } = req.body;

    try {
      const summaryPrompt = `Analyze the user's spending data and monthly bills. Suggest custom optimization strategies to save money on recurring monthly bills, identify potential spending waste based on history, and give a forecast.
      
      User recurring monthly bills:
      ${JSON.stringify(monthlyBills || [], null, 2)}
      
      Recent transactions history:
      ${JSON.stringify((transactions || []).slice(0, 50), null, 2)}
      
      User regular income:
      $${income || "3500"} per month
      
      Synthesize realistic recommendations. Return structural insights list with title description, actions, expected savings and difficulty, along with category audit and forecast estimations.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: summaryPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              recurringBillSavings: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    billName: { type: Type.STRING, description: "Name of the subscription or bill" },
                    currentCost: { type: Type.NUMBER },
                    suggestedAction: { type: Type.STRING, description: "Actionable saving advice, e.g. negotiate plan, trim tier, cancel" },
                    expectedSavings: { type: Type.NUMBER, description: "Expected monthly savings in USD" },
                    difficulty: { type: Type.STRING, description: "Easy, Medium, or Hard" }
                  },
                  required: ["billName", "currentCost", "suggestedAction", "expectedSavings", "difficulty"]
                }
              },
              generalHabitSavings: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    category: { type: Type.STRING, description: "E.g., Restaurants, Apparel, Subscriptions, etc." },
                    observation: { type: Type.STRING, description: "What Gemini noticed in the trends" },
                    tip: { type: Type.STRING, description: "Actionable cost cutting tip" },
                    estimatedMonthlySavings: { type: Type.NUMBER, description: "Estimated monthly USD savings" }
                  },
                  required: ["category", "observation", "tip", "estimatedMonthlySavings"]
                }
              },
              budgetForecast: {
                type: Type.OBJECT,
                properties: {
                  predictedSpendingNextMonth: { type: Type.NUMBER },
                  savingsPotential: { type: Type.NUMBER, description: "Total potential monthly savings from suggestions" },
                  summaryRemarks: { type: Type.STRING, description: "Overall financial Health feedback and summary overview" }
                },
                required: ["predictedSpendingNextMonth", "savingsPotential", "summaryRemarks"]
              }
            },
            required: ["recurringBillSavings", "generalHabitSavings", "budgetForecast"]
          }
        }
      });

      const parsedText = response.text || "{}";
      res.json(JSON.parse(parsedText.trim()));
    } catch (error: any) {
      console.error("Error analyzing finance data:", error);
      res.status(500).json({ 
        error: "Failed to compile budget analysis", 
        message: error.message 
      });
    }
  });

  /**
   * API Route: Financial Coach Chat Companion
   * Processes conversational queries grounded on the user's active cashflows and monthly bills.
   */
  app.post("/api/financial-chat", apiCheck, async (req, res) => {
    const { message, transactions, bills, income } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Missing conversational message query" });
    }

    try {
      const chatPrompt = `You are an elite certified Personal Finance Coach and Advisor. A user is asking you for financial help.
      
      Active monthly income: $${income || 3500}
      Active subscriptions / bills: ${JSON.stringify(bills || [], null, 2)}
      Recent transactions ledger: ${JSON.stringify(transactions || [], null, 2)}
      
      User's question/instruction: "${message}"

      Respond in a supportive, constructive, humanly realistic personal advisor tone. Limit excessive math formulas, and focus on human advice. If they ask you to write script scripts (such as a Comcast negotiation email, landlord rent plea, gym opt-out), make sure to draft a full, copyable script format with placeholders like [Full Name] or [Account Number] so they can copy-paste immediately. Provide brief bulleted cost saving tips when relevant. Keep your response around 3-4 paragraphs. Use markdown where helpful.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: chatPrompt,
      });

      res.json({ reply: response.text || "I was unable to synthesize an answer right now. Please test another question." });
    } catch (error: any) {
      console.error("Error in AI financial chat:", error);
      res.status(500).json({ 
        error: "Failed to synthesize coach reply", 
        message: error.message 
      });
    }
  });

  /**
   * API Route: Cloud storage exporter mock simulation
   * Simulates immediate export to selected cloud providers (GCS, AWS S3, Dropbox, Google Drive)
   * generates public sharable reference URLs, logs validation, metadata payload index
   */
  app.post("/api/export-cloud", (req, res) => {
    const { provider, dashboardSummary, transactionsCount } = req.body;

    if (!provider) {
      return res.status(400).json({ error: "Provider is required (gdrive | s3 | dropbox)" });
    }

    try {
      const timestamp = new Date().toISOString();
      const randomId = Math.random().toString(36).substring(2, 10).toUpperCase();
      const fileRef = `FINANCE_REPORT_${randomId}_${timestamp.split('T')[0]}.pdf`;
      
      let shareUrl = "";
      let bucketOrFolder = "";
      
      // Customize output based on cloud host provider
      switch (provider) {
        case "gdrive":
          bucketOrFolder = `Google Drive / Personal / PersonalFinanceApp / Reports`;
          shareUrl = `https://drive.google.com/file/d/1pf-${randomId}-finance-analytics/view?usp=sharing`;
          break;
        case "s3":
          bucketOrFolder = `s3://finance-assistant-reports-${randomId}/monthly/`;
          shareUrl = `https://s3.amazonaws.com/finance-assistant-reports-${randomId}/${fileRef}`;
          break;
        case "dropbox":
          bucketOrFolder = `Dropbox/Apps/Personal Finance Tracker/Reports`;
          shareUrl = `https://www.dropbox.com/s/db-${randomId}/${fileRef}?dl=0`;
          break;
        default:
          bucketOrFolder = `Local Storage/Backup`;
          shareUrl = `https://local.storage/download/${fileRef}`;
      }

      res.json({
        success: true,
        provider,
        fileName: fileRef,
        bucketOrFolder,
        exportTimestamp: timestamp,
        shareUrl,
        transactionsCount: transactionsCount || 0,
        metadata: {
          totalIncome: dashboardSummary?.income || 0,
          totalExpenses: dashboardSummary?.expenses || 0,
          netSavings: dashboardSummary?.savings || 0,
          exportChecksum: `SHA256-${Math.random().toString(16).substring(2, 12).toUpperCase()}`
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed cloud replication", message: error.message });
    }
  });

  // Client-Facing Dev vs Production Middleware Serving Route Configs
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve build from standard build folder
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Finance Engine] Active backend server running at http://localhost:${PORT}`);
  });
}

startServer();
