# 🔍 LLM-Powered Intelligent Query–Retrieval System

This project is a backend API that uses **LLMs (Gemini)**, **LangChain**, and **Pinecone** to intelligently extract answers from large documents like PDFs, DOCX, and emails. It is designed to handle real-world queries in domains such as **insurance**, **legal**, **HR**, and **compliance**.

---

## 🚀 Features

- ✅ Accepts PDF 
- ✅ Extracts relevant sections based on semantic search  
- ✅ Parses and answers natural language questions  
- ✅ Provides structured and explainable JSON responses  
- ✅ Hosted on **Render**

---

## 🧠 Technologies Used

- **Google Gemini API** – for natural language understanding and answer generation  
- **LangChain** – for prompt orchestration and LLM integration  
- **Pinecone** – for vector storage and semantic search  
- **Node.js + Express** – for building the backend API  
- **pdf-parse** – for extracting text from PDF files

---

## 📦 API Endpoint

> **POST** `https://hackrx-backend-nv7c.onrender.com/hackrx/run`

### 🔗 Example Request Body

```json
{
  "documents": "https://example.com/your-document.pdf",
  "questions": [
    "Question 1....",
    "Question 2....",
    "Question 3....",
    "Question 4....",
    "Question 5....",
    "Question 6....",
    "Question 7....?",
    "Question 8....",
    "Question 9...",
    "Question 10...."
  ]
}
```

📌 Ensure your `documents` URL is **publicly accessible over HTTPS** (e.g., Dropbox, Google Drive with public link, or any static hosting service).

---

### 📤 Sample Response

```json
{
  "answers": [
    "The waiting period for maternity expenses is 9 months.",
    "Yes, organ donor expenses are covered under the policy.",
    "The daily cash benefit is ₹1,000 per day for up to 30 days.",
    "..."
  ]
}
```

---

## 🛠️ Setup (Local)

```bash
git clone https://github.com/yourusername/llm-query-retrieval.git
cd backend-test
npm install (add "type:module" in package.json file)
```

### 🔐 Environment Variables

Create a `.env` file in the root directory with:

```env
GEMINI_API_KEY = Your Gemini Api Key
PINECONE_API_KEY = Your Pinecone Api Key
PINECONE_ENVIRONMENT = us-east-1 (default)
PINECONE_INDEX_NAME = Your Pinecone Index name
PORT=Port Number ( eg. 8080 )
API_TOKEN = Your secret token ( eg. testtoken123 )
```

### ▶️ Run Locally

```bash
npm run dev
```

---

## 🌐 Hosted Demo

Try it live:  
**POST** → [`https://hackrx-backend-nv7c.onrender.com/hackrx/run`](https://hackrx-backend-nv7c.onrender.com/hackrx/run)

---

## 💡 Problem Statement (HackRx 6.0)

> Design an LLM-Powered Intelligent Query–Retrieval System that can process large documents and make contextual decisions.  
> The system should handle real-world scenarios in **insurance**, **legal**, **HR**, and **compliance** domains.

---

---

## 🧑‍💻 Team & Contributions

This project was built as part of HackRx 6.0.

- 🔧 **Akhilesh Verma** – Developed and implemented the entire backend system.
- 📚 **Other Team Members** – Contributed by researching the problem statement, understanding domain use cases, and handling project submission.


## 📄 License

MIT License
