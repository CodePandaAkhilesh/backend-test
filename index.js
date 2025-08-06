import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import hackrxRouter from "./routes/hackrxRouter.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/hackrx", hackrxRouter);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
