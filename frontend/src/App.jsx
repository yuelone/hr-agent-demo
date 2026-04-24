import { useState } from "react";

const App = () => {
  const [input, setInput] = useState("");
  const [reply, setReply] = useState("");

  const sendMessage = async () => {
    const res = await fetch("http://localhost:3000/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message: input })
    });

    const data = await res.json();
    setReply(data.reply);
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>HR Agent Demo</h2>

      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="輸入問題..."
        style={{ width: 300, marginRight: 10 }}
      />

      <button onClick={sendMessage}>送出</button>

      <div style={{ marginTop: 20 }}>
        <b>回覆：</b> {reply}
      </div>
    </div>
  );
}

export default App;
