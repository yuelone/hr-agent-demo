import { useState, useRef, useEffect } from "react";

const Icon = ({ name, className = "" }) => (
  <span className={`material-symbols-outlined ${className}`}>{name}</span>
);

const AiMessage = ({ reply }) => (
  <div className="ai-bubble">
    <div className="ai-bubble__header">
      <Icon name="auto_awesome" className="ai-bubble__header-icon" />
      <span className="ai-bubble__label">HR Assistant</span>
    </div>
    <div className="ai-bubble__body">
      <p>{reply}</p>
    </div>
  </div>
);

const LoadingMessage = () => (
  <div className="ai-bubble">
    <div className="ai-bubble__header">
      <Icon name="auto_awesome" className="ai-bubble__header-icon" />
      <span className="ai-bubble__label">HR Assistant</span>
    </div>
    <div className="ai-bubble__body ai-bubble__body--loading">
      <div className="skeleton skeleton--line" />
      <div className="skeleton skeleton--line skeleton--short" />
    </div>
  </div>
);

const ErrorMessage = ({ message }) => (
  <div className="ai-bubble ai-bubble--error">
    <div className="ai-bubble__header">
      <Icon name="error" className="ai-bubble__header-icon" />
      <span className="ai-bubble__label">系統錯誤</span>
    </div>
    <div className="ai-bubble__body">
      <p>{message}</p>
    </div>
  </div>
);

const App = () => {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const textareaRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const res = await fetch("http://localhost:3000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok) throw new Error(`伺服器錯誤 (${res.status})`);

      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "error", content: "連線失敗，請稍後再試。" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleInput = (e) => {
    setInput(e.target.value);
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 192) + "px";
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <main className="app">
      <header className="header">
        <div className="header__logo">
          <div className="header__icon-wrap">
            <Icon name="auto_awesome" className="header__icon" />
          </div>
          <span className="header__title">HR Assistant</span>
        </div>
      </header>
      <div className="chat-area scrollbar">
        <div className="chat-area__inner">
          {messages.length === 0 && (
            <section className="hero">
              <div className="hero__icon-wrap">
                <Icon name="auto_awesome" className="hero__icon" />
              </div>
              <h2 className="hero__title">Hello, I'm HR Assistant.</h2>
              <p className="hero__subtitle">
                How can I accelerate your productivity today?
              </p>
            </section>
          )}
          <div className="conversation">
            {messages.map((msg, i) => {
              if (msg.role === "user") {
                return (
                  <div key={i} className="user-bubble-wrap">
                    <div className="user-bubble">{msg.content}</div>
                  </div>
                );
              }
              if (msg.role === "assistant") {
                return (
                  <div key={i} className="ai-bubble-wrap">
                    <AiMessage reply={msg.content} />
                  </div>
                );
              }
              if (msg.role === "error") {
                return (
                  <div key={i} className="ai-bubble-wrap">
                    <ErrorMessage message={msg.content} />
                  </div>
                );
              }
              return null;
            })}
            {loading && (
              <div className="ai-bubble-wrap">
                <LoadingMessage />
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>
      </div>
      <div className="input-bar">
        <div className="input-bar__inner">
          <div className="input-bar__shimmer-wrap">
            <div className="input-bar__shimmer-bar shimmer" />
          </div>
          <div className="input-bar__container">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="Type your message to HR Assistant..."
              className="input-bar__textarea scrollbar"
              disabled={loading}
            />
            <div className="input-bar__actions">
              <button
                className="btn-send"
                onClick={sendMessage}
                disabled={loading}
              >
                <Icon
                  name={loading ? "hourglass_empty" : "send"}
                  className="btn-send__icon"
                />
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="aura-top" />
      <div className="aura-bottom" />
    </main>
  );
};

export default App;