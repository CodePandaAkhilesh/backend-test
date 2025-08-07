// Importing required libraries and modules
import express from "express";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Pinecone } from "@pinecone-database/pinecone";
import { PineconeStore } from "@langchain/pinecone";
import { GoogleGenAI } from "@google/genai";
import fetch from "node-fetch";
import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

const router = express.Router();
// Initialize Google GenAI SDK for use with Gemini
const ai = new GoogleGenAI({});

// Route to process the PDF and questions
router.post("/run", async (req, res) => {
  console.log("🔁 Received request at /run");

  try {
    // ✅ Authentication check using Bearer token from headers
    // const authHeader = req.headers.authorization || "";
    // const token = authHeader.split(" ")[1];
    // if (!token || token !== process.env.API_TOKEN) {
    //   console.warn("⚠️ Unauthorized request");
    //   return res.status(401).json({ error: "Unauthorized" });
    // }

    // ✅ Destructure documents (PDF URL) and questions from request body
    const { documents: pdfUrl, questions } = req.body;
    if (!pdfUrl || !Array.isArray(questions)) {
      console.error("❌ Invalid request format");
      return res.status(400).json({ error: "Invalid request format" });
    }

    // ✅ Download PDF from given URL and store temporarily
    console.log("⬇️ Downloading PDF from:", pdfUrl);
    const response = await fetch(pdfUrl);
    if (!response.ok) throw new Error("Failed to fetch PDF");

    const pdfBuffer = await response.arrayBuffer();
    const tempPath = path.join("temp.pdf");
    await fs.writeFile(tempPath, Buffer.from(pdfBuffer));
    console.log("✅ PDF downloaded and saved to temp.pdf");

    // ✅ Load and split PDF into smaller chunks for embedding
    console.log("🔍 Loading and splitting PDF...");
    const loader = new PDFLoader(tempPath);
    const docs = await loader.load();

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const splitDocs = await splitter.splitDocuments(docs);
    console.log(`✅ Split into ${splitDocs.length} chunks`);

    // ✅ Initialize Google Generative AI Embeddings
    console.log("🧠 Initializing embeddings...");
    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GEMINI_API_KEY,
      model: "text-embedding-004",
    });

    // ✅ Connect to Pinecone vector database
    console.log("🌲 Connecting to Pinecone...");
    const pinecone = new Pinecone();
    const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME);
    console.log("✅ Connected to Pinecone index");

    // ✅ Store the split documents in Pinecone for future semantic retrieval
    console.time("🧾 Indexing to Pinecone");
    await PineconeStore.fromDocuments(splitDocs, embeddings, {
      pineconeIndex,
      maxConcurrency: 5,
    });
    console.timeEnd("🧾 Indexing to Pinecone");

    const results = [];
    let correctCount = 0;

    // ✅ Process each user question
    for (const q of questions) {
      const start = Date.now();
      console.log(`💬 Processing question: ${q}`);

      // Rewrite the query to be self-contained
      const rewritten = await transformQuery(q);
      console.log("🔁 Rewritten Question:", rewritten);

      // Convert the question into an embedding vector
      const vector = await embeddings.embedQuery(rewritten);

      // Query Pinecone for top-k similar chunks from the document
      const searchResults = await pineconeIndex.query({
        topK: 10,
        vector,
        includeMetadata: true,
      });

      // ✅ Prepare limited-length document context for Gemini model
      let totalLength = 0;
      const contextChunks = [];
      for (const match of searchResults.matches) {
        if (!match?.metadata?.text) continue;
        const text = match.metadata.text.trim();
        totalLength += text.length;
        if (totalLength > 12000) break;
        contextChunks.push(text);
      }

      const context = contextChunks.join("\n\n---\n\n");
      console.log("📄 Retrieved Context (first 500 chars):\n", context.slice(0, 500), "...");

      // ✅ Prompt construction for Gemini: simulate an insurance policy analyst
      const geminiPrompt = `
You are a certified insurance policy analyst.

Your job is to answer strictly based on the provided insurance policy context. Return answers in a professional, clause-like tone, as typically written in insurance documents.

Guidelines:
- ✅ If the answer is clearly present in the context, respond with a formal, complete sentence using exact terms from the policy (e.g. specific durations, limits, exclusions, definitions).
- ✅ If the policy mentions the topic indirectly or in conditions/tables, interpret and report the clause clearly (e.g., room rent limits, donor expenses).
- ❌ Do NOT guess, assume, summarize, or add information not found in the context.
- ❌ Do NOT generate examples, interpretations, or generic statements.
- ❌ If the answer is truly not found in the context, respond exactly with: "Not mentioned in the document."

Context:
${context}

Question: ${rewritten}
`.trim();

      // ✅ Call Gemini to get the answer
      const geminiResponse = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [
          {
            role: "user",
            parts: [{ text: geminiPrompt }],
          },
        ],
      });

      // ✅ Extract and log answer
      const answer = geminiResponse.text?.trim() || "No answer generated";
      console.log("✅ Answer generated:", answer);

      // ✅ Count answer as correct if it is not "Not mentioned..."
      if (!/^not mentioned in the document\.*$/i.test(answer)) {
        correctCount += 1;
      }

      const timeTaken = Date.now() - start;
      results.push({ question: q, answer, responseTimeMs: timeTaken });
    }

    // ✅ Delete the temporary PDF file after use
    await fs.unlink(tempPath);
    console.log("🧹 Temp file deleted");

    // ✅ Return only the answers in response
    res.json({
      answers: results.map(r => r.answer)
    });

  } catch (err) {
    // ✅ Handle and report errors
    console.error("💥 Error in /run:", err);
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// ✅ Helper function to rewrite queries clearly before embedding
async function transformQuery(question) {
  console.log("🔧 Rewriting query:", question);

  const response = await ai.models.generateContent({
    model: "gemini-1.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `You are a query rewriting expert. Rewrite the following question to make it fully self-contained and clear on its own:\n\n"${question}"`,
          },
        ],
      },
    ],
  });

  const rewritten = response.text?.trim() || question;
  console.log("🔁 Rewritten as:", rewritten);
  return rewritten;
}

export default router;


// http://localhost:8080/hackrx/run