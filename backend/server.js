import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

app.post("/chat", async (req, res) => {
  const { message } = req.body;

  try {
    const response = await fetch("http://127.0.0.1:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama3",
        prompt: `
          你是 HR 助手
          如果問題是請假相關，回答：你還有 5 天假
          否則正常回答
                
          使用者問題：${message}
        `,
        stream: false
      })
    });

    const data = await response.json();

    return res.json({
      reply: data.response || ""
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ reply: "錯誤" });
  }
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
