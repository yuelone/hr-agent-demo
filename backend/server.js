import express from "express";
import cors from "cors";
import { runAgent } from "./agent.js";

const app = express();
app.use(cors());
app.use(express.json());

app.post("/chat", async (req, res) => {
  const { message } = req.body;

  try {
    const reply = await runAgent(message);
    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ reply: "系統錯誤" });
  }
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
