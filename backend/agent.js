import { toolRegistry } from "./tools.js";

const OLLAMA_URL = "http://localhost:11434/api/generate";

/**
 * Builds the system prompt for each step of the ReAct loop.
 * Injects all previously collected tool results so the LLM
 * is aware of the current state before making its next decision.
 */
const buildSystemPrompt = (collectedResults = []) => `
你是 HR Agent 並且用專業的 HR 知識理解問題後
用以下你能使用的

工具列表：
${Object.entries(toolRegistry)
    .map(([name, tool]) => `- ${name}：${tool.description}`)
    .join("\n")}

${collectedResults.length > 0 ? `
已收集資料：
${collectedResults.map(r => `[${r.tool}]: ${JSON.stringify(r.result)}`).join("\n")}
` : ""}

### 重要規則 ###
每次回應只能有一個 JSON 物件。
不能同時輸出多個 action。
不能輸出任何 JSON 以外的文字。
只能使用工具列表中存在的工具，不能使用不存在的工具。
在判斷要使用哪一個工具的時候，請先分析工具的 description 欄位，在判斷要使用哪一個工具，
禁止憑空捏造答案，所有回答必須來自工具查詢的結果。
沒有收集任何資料前，不能輸出 final。
違反規則等於回答錯誤。

需要查資料 → 輸出：
{"action":"tool","tool":"工具名稱","input":{"userId":"1101"}}

資料足夠，分析資料 → 輸出：
{"action":"final","response":"用繁體中文自然語言回答，禁止出現任何英文欄位名稱如 annualLeave、sickLeave、userId 等，一律用中文描述"}
`;


/**
 * Sends a prompt to the local Ollama instance and returns the response text.
 */
const callLLM = async (prompt) => {
  const res = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama3",
      prompt,
      stream: false
    })
  });
  const data = await res.json();
  return data.response?.trim() ?? "";
};


/**
 * Extracts the most relevant JSON object from raw LLM output.
 *
 * LLMs often produce multiple JSON objects or wrap them in prose.
 * This function uses bracket-depth matching to find all valid JSON objects,
 * then prioritizes: final > reply > tool.
 *
 * This ensures that if the LLM outputs both a tool call and a final answer
 * in the same response, the final answer is always preferred.
 */
const extractBestJSON = (text) => {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const results = [];

  let i = 0;
  while (i < cleaned.length) {
    const start = cleaned.indexOf("{", i);
    if (start === -1) break;

    let depth = 0;
    for (let j = start; j < cleaned.length; j++) {
      if (cleaned[j] === "{") depth++;
      if (cleaned[j] === "}") depth--;
      if (depth === 0) {
        try {
          const parsed = JSON.parse(cleaned.slice(start, j + 1));
          results.push(parsed);
        } catch { }
        i = j + 1;
        break;
      }
    }
  }

  if (results.length === 0) throw new Error("No JSON found");

  return (
    results.find(r => r.action === "final") ||
    results.find(r => r.action === "reply") ||
    results[0]
  );
};


/**
 * Bypasses the ReAct loop and forces a final natural language answer
 * using all collected tool results.
 *
 * This is a fallback designed to handle cases where the LLM fails to
 * produce a valid final action — such as infinite tool loops, malformed
 * JSON, or exceeding the maximum step limit.
 *
 * NOTE: This function exists primarily to compensate for the weak
 * instruction-following capability of llama3. When using a stronger model
 * (e.g. GPT-4o, Claude), this fallback should rarely, if ever, be triggered.
 */
const forceFinalAnswer = async (collectedResults, message) => {
  return await callLLM(`
你是 HR 助手，請根據以下資料分析資料並且用專業的 HR 知識，分析資料，理解問題後，繁體中文回答使用者問題。
只輸出一段繁體中文的自然語言，不要 JSON，不要英文欄位名稱，人名保持原文不要翻譯。

資料：
${collectedResults
      .filter(r => r.tool !== "_system")
      .map(r => `[${r.tool}]: ${JSON.stringify(r.result)}`)
      .join("\n")}

問題：${message}

回答：`);
};


/**
 * Main agent execution loop following the ReAct (Reason + Act) pattern.
 *
 * Each step:
 * 1. Builds a prompt with all previously collected data
 * 2. Calls the LLM to decide the next action (tool call or final answer)
 * 3. Executes the tool and appends the result to collectedResults
 * 4. Repeats until the LLM outputs a final answer or maxSteps is reached
 *
 * @param {string} message - The user's question
 * @param {number} maxSteps - Maximum number of steps to prevent infinite loops
 */
export const runAgent = async (message, maxSteps = 5) => {
  const collectedResults = [];

  for (let step = 0; step < maxSteps; step++) {
    console.log(`\n=== Step ${step + 1} ===`);

    const prompt = `${buildSystemPrompt(collectedResults)}\n\n使用者問題：${message}`;

    // Handle LLM call failures (e.g. Ollama not running, network issues)
    let raw;
    try {
      raw = await callLLM(prompt);
    } catch (e) {
      console.log("LLM 呼叫失敗：", e.message);
      return "系統發生錯誤，請稍後再試";
    }
    console.log("LLM raw:", raw);

    let decision;
    try {
      decision = extractBestJSON(raw);
      console.log("Decision:", decision);
    } catch (e) {
      console.log("Parse error:", e.message);

      // JSON is completely broken but we have data — force a final answer
      if (collectedResults.filter(r => r.tool !== "_system").length > 0) {
        console.log("Forcing final answer from collected data...");
        return await forceFinalAnswer(collectedResults, message);
      }

      // LLM intended to output final but JSON is malformed — extract plain text as fallback
      if (raw.includes('"action":"final"') || raw.includes("final")) {
        const lines = raw
          .split("\n")
          .map(l => l.trim())
          .filter(l => l.length > 0 && !l.startsWith("{") && !l.startsWith("}") && !l.startsWith('"'));

        if (lines.length > 0) {
          return lines.join(" ");
        }
      }

      return raw;
    }

    if (decision.action === "tool") {
      const tool = toolRegistry[decision.tool];
      console.log("Executing tool:", decision.tool);

      // LLM hallucinated a tool that doesn't exist in the registry
      if (!tool) {
        console.log("Tool not found:", decision.tool);
        collectedResults.push({
          tool: decision.tool,
          result: { error: `"${decision.tool}" 不存在，請只使用工具列表中的工具` }
        });
        continue;
      }

      const alreadyCalled = collectedResults.some(r => r.tool === decision.tool);
      if (alreadyCalled) {
        const calledTools = collectedResults
          .filter(r => r.tool !== "_system")
          .map(r => r.tool);

        // TODO: Currently hints all uncalled tools regardless of relevance.
        // With a stronger model, the LLM should determine which tools are
        // actually needed based on the user's question.
        const remainingTools = Object.keys(toolRegistry)
          .filter(name => !calledTools.includes(name));

        if (remainingTools.length > 0) {
          // Guide the LLM toward uncalled tools instead of repeating
          console.log("Tool already called, remaining tools:", remainingTools);
          collectedResults.push({
            tool: "_system",
            result: { error: `${decision.tool} 已呼叫過。你還沒有查詢：${remainingTools.join("、")}，請繼續查詢。` }
          });
          continue;
        }

        // All tools have been called but LLM is still looping — force answer
        console.log("All tools called, forcing final answer...");
        return await forceFinalAnswer(collectedResults, message);
      }

      let result;
      try {
        result = await tool.execute(decision.input ?? {});
      } catch (e) {
        console.log("Tool 執行失敗：", e.message);
        collectedResults.push({ tool: decision.tool, result: { error: `工具執行失敗：${e.message}` } });
        continue;
      }

      console.log("Tool result:", result);
      collectedResults.push({ tool: decision.tool, result });
      continue;
    }

    if (decision.action === "final") {
      console.log("Final answer reached");

      // LLM tried to answer without querying any data — force a tool call first
      if (collectedResults.filter(r => r.tool !== "_system").length === 0) {
        console.log("No data collected yet, forcing tool call...");
        collectedResults.push({
          tool: "_system",
          result: { error: "你還沒有查詢任何資料，請先使用工具取得資訊再回答" }
        });
        continue;
      }

      // Only accept a non-empty string as a valid final response
      if (typeof decision.response === "string" && decision.response.trim().length > 0) {
        return decision.response;
      }

      // response is empty or not a string — prompt the LLM to fill it in
      console.log("Final response is empty, continuing...");
      collectedResults.push({
        tool: "_system",
        result: { error: "請用繁體中文自然語言填寫 response 欄位，不能是空的" }
      });
      continue;
    }

    if (decision.action === "reply") {
      return decision.response;
    }

    // LLM produced an unrecognized action — prompt it to retry with correct format
    console.log("Unknown action, ignoring:", decision.action);
    collectedResults.push({
      tool: "_system",
      result: { error: "格式錯誤，請重新輸出正確的 action" }
    });
    continue;
  }

  // Exceeded max steps — still return an answer if we have collected data
  if (collectedResults.filter(r => r.tool !== "_system").length > 0) {
    console.log("Max steps reached, forcing final answer...");
    return await forceFinalAnswer(collectedResults, message);
  }

  return "超過最大步數";
};