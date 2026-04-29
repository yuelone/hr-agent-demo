# HR Agent Demo

A **ReAct (Reason + Act)** based HR Assistant demo project that combines an LLM with tool-calling to retrieve data and generate accurate responses.


This project demonstrates a **minimal viable HR Agent**:

* ReAct loop
* Tool calling
* LLM-based decision making
* Fault-tolerant design

---

# Project Structure

```
hr-agent-demo/
├── frontend/        # React frontend
├── backend/
│   ├── server.js   # API server
│   ├── agent.js    # ReAct Agent core logic
│   └── tools.js    # Tool definitions
```

---

#  Getting Started

## Start LLM (Ollama)

Make sure you have Ollama installed and run:

```bash
ollama run llama3
```

or:

```bash
ollama serve
```

---

## Start Backend

```bash
cd backend
npm install
node server.js
```

You should see:

```
Server running on http://localhost:3000
```

---

## Start Frontend

```bash
cd frontend
npm install
npm run dev
```

Open in browser:

```
http://localhost:5173
```

---

# System Architecture

The system consists of three main layers:

## Frontend (React UI)

Responsible for:

* Capturing user input
* Calling `/chat` API
* Displaying AI responses

Flow:

```
User Input → POST /chat → Display reply
```

---

## Backend API (Express)

`server.js`

```js
POST /chat
```

Responsible for:

* Receiving user messages
* Calling `runAgent()`
* Returning responses

---

## Agent Core (ReAct)

`agent.js`

Handles:

* Decision making (whether to call tools)
* Executing tools
* Aggregating data and generating answers

---

# Tool System

Defined in `tools.js`

Available tools:

| Tool Name       | Description       |
| --------------- | ----------------- |
| getUserInfo     | Get user profile  |
| getLeaveBalance | Get leave balance |
| getPaySlip      | Get payslip       |

Example:

```js
getLeaveBalance.execute({ userId: "1101" })
```

Response:

```json
{
  "annualLeave": 10,
  "sickLeave": 3
}
```

---

# Agent Workflow (ReAct Loop)

Core logic lives in `runAgent()`

## Flow:

### Step 1: Build Prompt

Includes:

* Tool list
* Collected results
* Rules
* User question

---

### Step 2: Call LLM

```js
callLLM(prompt)
```

Expected outputs:

Tool call:

```json
{"action":"tool","tool":"getLeaveBalance","input":{"userId":"1101"}}
```

Final answer:

```json
{"action":"final","response":"You have ..."}
```

---

### Step 3: Parse JSON

```js
extractBestJSON()
```

Handles:

* Multiple JSON outputs
* Malformed responses
* Noise filtering

---

### Step 4: Execute Tool (if needed)

```js
tool.execute(input)
```

Result is appended to:

```js
collectedResults
```

---

### Step 5: Repeat Loop

Until:

* A `final` answer is returned
* Or `maxSteps` is reached

---

### Step 6: Fallback Mechanism

If LLM fails:

```js
forceFinalAnswer()
```

Generates a natural language answer using collected data.

---