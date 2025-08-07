// All required imports
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

dotenv.config();

const router = express.Router();
const ai = new GoogleGenAI({});

// 📌 POST /run
// Main endpoint for processing insurance policy documents and answering user questions
router.post("/run", async (req, res) => {
  console.log("🔁 Received request at /run");

  try {
    const { documents: pdfUrl, questions } = req.body;

    // ✅ Validate request body
    if (!pdfUrl || !Array.isArray(questions)) {
      console.error("❌ Invalid request format");
      return res.status(400).json({ error: "Invalid request format" });
    }

    // ⬇️ Step 1: Download the PDF from provided URL
    console.log("⬇️ Downloading PDF from:", pdfUrl);
    const response = await fetch(pdfUrl);
    if (!response.ok) throw new Error("Failed to fetch PDF");

    // 💾 Save PDF to a temporary file
    const pdfBuffer = await response.arrayBuffer();
    const tempPath = path.join("temp.pdf");
    await fs.writeFile(tempPath, Buffer.from(pdfBuffer));
    console.log("✅ PDF saved to temp.pdf");

    // 📄 Step 2: Load and split PDF content into smaller chunks
    const loader = new PDFLoader(tempPath);
    const docs = await loader.load();

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 800,
      chunkOverlap: 200,
    });

    const splitDocs = await splitter.splitDocuments(docs);
    console.log(`✅ Split into ${splitDocs.length} chunks`);

    // 🧠 Step 3: Generate embeddings using Gemini
    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GEMINI_API_KEY,
      model: "text-embedding-004",
    });

    // 🌲 Step 4: Connect to Pinecone vector DB
    const pinecone = new Pinecone();
    const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME);

    // 🧾 Step 5: Index embedded chunks into Pinecone for similarity search
    console.time("🧾 Indexing to Pinecone");
    await PineconeStore.fromDocuments(splitDocs, embeddings, {
      pineconeIndex,
      maxConcurrency: 5,
    });
    console.timeEnd("🧾 Indexing to Pinecone");

    // ⏳ Wait to ensure indexing is complete (important for fresh indexes)
    await new Promise((resolve) => setTimeout(resolve, 3000));
    console.log("⏳ Waited 3 seconds after indexing.");

    // ❓ Step 6: Process each user question
    const questionPromises = questions.map(async (q) => {
      const start = Date.now();
      console.log(`💬 Processing question: ${q}`);

      const rewritten = q;

      // 🔍 Get vector embedding for the question
      const vector = await embeddings.embedQuery(rewritten);

      // 🔎 Search Pinecone for most relevant document chunks
      const searchResults = await pineconeIndex.query({
        topK: 5,
        vector,
        includeMetadata: true,
      });

      // 📚 Gather top context chunks within 12,000 characters
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
      console.log("📄 Context snippet:", context.slice(0, 300), "...");

      // ✨ Build a prompt for Gemini with strict instructions
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

      // 🤖 Generate answer using Gemini 2.0 Flash model
      const geminiResponse = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: "user", parts: [{ text: geminiPrompt }] }],
      });

      const answer = geminiResponse.text?.trim() || "No answer generated";
      const timeTaken = Date.now() - start;

      return {
        question: q,
        answer,
        responseTimeMs: timeTaken,
        isCorrect: !/^not mentioned in the document\.*$/i.test(answer),
      };
    });

    const questionResults = await Promise.all(questionPromises);

    // 📊 Step 7: Calculate and log performance metrics
    const totalResponseTime = questionResults.reduce((sum, r) => sum + r.responseTimeMs, 0);
    const correctCount = questionResults.filter((r) => r.isCorrect).length;
    const averageResponseTime = totalResponseTime / questions.length;
    const accuracy = (correctCount / questions.length) * 100;

    console.log(`📊 Total Questions: ${questions.length}`);
    console.log(`⏱️ Total Response Time: ${totalResponseTime} ms`);
    console.log(`⏱️ Average Response Time: ${averageResponseTime.toFixed(2)} ms`);
    console.log(`🎯 Accuracy: ${accuracy.toFixed(2)}%`);

    // 🧹 Cleanup: delete temporary PDF
    await fs.unlink(tempPath);
    console.log("🧹 Temp file deleted");

    // 📤 Final response to client
    res.json({
      answers: questionResults.map((r) => r.answer),
    });
  } catch (err) {
    console.error("💥 Error in /run:", err);
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

export default router;
