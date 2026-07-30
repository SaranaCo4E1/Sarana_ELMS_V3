// Run from the project root:
//   bun tools/rag-faq-editor/index.js
// Optional:
//   bun tools/rag-faq-editor/index.js --port=4317 --data=path/to/rag_faq

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(toolDirectory, "..", "..");
const defaultDataDirectory = path.join(projectRoot, "database", "data", "ai", "rag_faq");
const dataArgument = process.argv.find((argument) => argument.startsWith("--data="));
const portArgument = process.argv.find((argument) => argument.startsWith("--port="));

const dataDirectory = path.resolve(
  dataArgument?.slice("--data=".length) || process.env.RAG_FAQ_DIR || defaultDataDirectory,
);
const host = "127.0.0.1";
const port = Number(portArgument?.slice("--port=".length) || process.env.PORT || 4317);
const placeholder = "NEEDS_COMPANY_INPUT";
const deletionLog = path.resolve(
  process.env.RAG_FAQ_DELETION_LOG || path.join(toolDirectory, "deleted-records.jsonl"),
);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`Invalid port: ${port}`);
}

if (!fs.existsSync(dataDirectory) || !fs.statSync(dataDirectory).isDirectory()) {
  throw new Error(`RAG FAQ directory does not exist: ${dataDirectory}`);
}

function jsonlFiles() {
  return fs
    .readdirSync(dataDirectory)
    .filter((name) => {
      return (
        name.endsWith(".jsonl") &&
        path.resolve(dataDirectory, name) !== deletionLog
      );
    })
    .sort();
}

function readRows(fileName) {
  const filePath = path.join(dataDirectory, fileName);
  const content = fs.readFileSync(filePath, "utf8");

  return content
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`${fileName}:${index + 1}: ${error.message}`);
      }
    });
}

function writeRows(fileName, rows) {
  const filePath = path.join(dataDirectory, fileName);
  const temporaryPath = `${filePath}.rag-faq-editor-${process.pid}.tmp`;
  const content = `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`;

  fs.writeFileSync(temporaryPath, content, "utf8");
  fs.renameSync(temporaryPath, filePath);
}

function loadDatabase() {
  const questions = [];
  const seenKeys = new Set();
  let total = 0;
  let active = 0;

  for (const fileName of jsonlFiles()) {
    const rows = readRows(fileName);

    rows.forEach((row, index) => {
      if (!row.key || seenKeys.has(row.key)) {
        throw new Error(`Missing or duplicate FAQ key in ${fileName}:${index + 1}`);
      }

      seenKeys.add(row.key);
      total += 1;
      active += row.is_active ? 1 : 0;

      if (String(row.answer_en || "").includes(placeholder)) {
        questions.push({
          key: row.key,
          category: row.category,
          question_en: row.question_en,
          current_prompt: row.answer_en,
          aliases_en: row.aliases_en || [],
          aliases_km: row.aliases_km || [],
          source_file: fileName,
          source_line: index + 1,
        });
      }
    });
  }

  questions.sort((left, right) => {
    return (
      left.category.localeCompare(right.category) ||
      left.question_en.localeCompare(right.question_en)
    );
  });

  return {
    questions,
    stats: {
      total,
      active,
      remaining: questions.length,
    },
  };
}

function findRecord(key) {
  for (const fileName of jsonlFiles()) {
    const rows = readRows(fileName);
    const index = rows.findIndex((row) => row.key === key);

    if (index !== -1) {
      return { fileName, rows, index, row: rows[index] };
    }
  }

  return null;
}

function responseJson(value, status = 200) {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function responseError(message, status = 400) {
  return responseJson({ error: message }, status);
}

async function readJsonRequest(request) {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    throw new Error("Content-Type must be application/json.");
  }

  if (request.headers.get("x-rag-faq-editor") !== "1") {
    throw new Error("Missing editor request header.");
  }

  return request.json();
}

let mutationQueue = Promise.resolve();

function serializeMutation(callback) {
  const result = mutationQueue.then(callback, callback);
  mutationQueue = result.catch(() => {});
  return result;
}

async function saveAnswer(request) {
  let payload;

  try {
    payload = await readJsonRequest(request);
  } catch (error) {
    return responseError(error.message);
  }

  const key = String(payload.key || "");
  const answer = String(payload.answer || "").trim();

  if (!key) {
    return responseError("A question key is required.");
  }

  if (!answer) {
    return responseError("Enter an answer before saving.");
  }

  if (answer.length > 20_000) {
    return responseError("The answer is too long (maximum 20,000 characters).");
  }

  if (answer.includes(placeholder)) {
    return responseError(`The answer cannot contain ${placeholder}.`);
  }

  return serializeMutation(() => {
    const match = findRecord(key);

    if (!match) {
      return responseError("The FAQ record no longer exists.", 404);
    }

    if (!String(match.row.answer_en || "").includes(placeholder)) {
      return responseError("This question has already been answered.", 409);
    }

    match.rows[match.index] = {
      ...match.row,
      answer_en: answer,
      is_active: true,
    };
    writeRows(match.fileName, match.rows);

    return responseJson({
      ok: true,
      key,
      source_file: match.fileName,
      stats: loadDatabase().stats,
    });
  });
}

async function deleteRecord(request) {
  let payload;

  try {
    payload = await readJsonRequest(request);
  } catch (error) {
    return responseError(error.message);
  }

  const key = String(payload.key || "");

  if (!key) {
    return responseError("A question key is required.");
  }

  return serializeMutation(() => {
    const match = findRecord(key);

    if (!match) {
      return responseError("The FAQ record no longer exists.", 404);
    }

    if (!String(match.row.answer_en || "").includes(placeholder)) {
      return responseError("Only unanswered company-input records can be deleted here.", 409);
    }

    fs.appendFileSync(
      deletionLog,
      `${JSON.stringify({
        deleted_at: new Date().toISOString(),
        source_file: match.fileName,
        source_line: match.index + 1,
        record: match.row,
      })}\n`,
      "utf8",
    );

    match.rows.splice(match.index, 1);
    writeRows(match.fileName, match.rows);

    return responseJson({
      ok: true,
      key,
      recovery_log: deletionLog,
      stats: loadDatabase().stats,
    });
  });
}

const html = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>RAG FAQ Company Input Editor</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #18211c;
      --muted: #66736b;
      --line: #dce3de;
      --paper: #ffffff;
      --canvas: #f3f6f4;
      --accent: #e96716;
      --accent-dark: #b84608;
      --danger: #b42318;
      --danger-bg: #fff4f2;
      --success: #147a45;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      background: var(--canvas);
      color: var(--ink);
    }

    button, input, select, textarea { font: inherit; }

    .shell {
      width: min(1180px, calc(100% - 32px));
      margin: 32px auto;
    }

    .header {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 24px;
      margin-bottom: 20px;
    }

    h1 {
      margin: 0 0 5px;
      font-size: clamp(25px, 4vw, 38px);
      letter-spacing: -0.04em;
    }

    .subhead, .muted { color: var(--muted); }

    .stats {
      display: grid;
      grid-template-columns: repeat(3, minmax(100px, 1fr));
      gap: 8px;
      min-width: 340px;
    }

    .stat, .panel {
      border: 1px solid var(--line);
      background: var(--paper);
      border-radius: 14px;
    }

    .stat { padding: 12px 14px; }
    .stat strong { display: block; font-size: 22px; }
    .stat span { color: var(--muted); font-size: 12px; }

    .panel { padding: 24px; }

    .filters {
      display: grid;
      grid-template-columns: minmax(220px, 1fr) minmax(220px, 0.6fr) auto;
      gap: 12px;
      margin-bottom: 16px;
    }

    input, select, textarea {
      width: 100%;
      border: 1px solid #c8d1ca;
      border-radius: 10px;
      background: #fff;
      color: var(--ink);
      outline: none;
    }

    input, select { height: 44px; padding: 0 12px; }

    input:focus, select:focus, textarea:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(233, 103, 22, 0.13);
    }

    .check {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 44px;
      color: var(--muted);
      white-space: nowrap;
    }

    .check input { width: 17px; height: 17px; }

    .question-card {
      border-top: 1px solid var(--line);
      padding-top: 22px;
    }

    .eyebrow {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 14px;
      color: var(--muted);
      font-size: 12px;
    }

    .pill {
      background: #edf2ee;
      border-radius: 999px;
      padding: 5px 9px;
    }

    h2 {
      max-width: 900px;
      margin: 0 0 12px;
      font-size: clamp(22px, 3vw, 31px);
      line-height: 1.2;
      letter-spacing: -0.025em;
    }

    .prompt {
      margin: 0 0 18px;
      padding: 12px 14px;
      border-left: 3px solid #f0a36e;
      background: #fff8f3;
      color: #75401d;
      font-size: 13px;
    }

    .aliases {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin: 0 0 18px;
    }

    .alias-box {
      padding: 12px 14px;
      background: #f7f9f7;
      border-radius: 10px;
      color: var(--muted);
      font-size: 13px;
    }

    .alias-box strong {
      display: block;
      margin-bottom: 4px;
      color: var(--ink);
      font-size: 12px;
    }

    label[for="answer"] {
      display: block;
      margin-bottom: 7px;
      font-weight: 700;
    }

    textarea {
      min-height: 190px;
      resize: vertical;
      padding: 14px;
      line-height: 1.5;
    }

    .help {
      margin: 7px 0 0;
      color: var(--muted);
      font-size: 12px;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 9px;
      margin-top: 18px;
    }

    button {
      min-height: 42px;
      padding: 0 15px;
      border: 1px solid #c9d1cb;
      border-radius: 10px;
      background: #fff;
      color: var(--ink);
      cursor: pointer;
      font-weight: 650;
    }

    button:hover { background: #f5f7f5; }
    button:disabled { cursor: not-allowed; opacity: 0.55; }

    .primary {
      border-color: var(--accent);
      background: var(--accent);
      color: #fff;
    }

    .primary:hover { background: var(--accent-dark); }

    .danger {
      margin-left: auto;
      border-color: #f0b9b4;
      background: var(--danger-bg);
      color: var(--danger);
    }

    .status {
      display: none;
      margin: 0 0 16px;
      padding: 11px 13px;
      border-radius: 10px;
      font-size: 14px;
    }

    .status.show { display: block; }
    .status.success { background: #eaf8f0; color: var(--success); }
    .status.error { background: var(--danger-bg); color: var(--danger); }

    .empty {
      display: none;
      padding: 44px 12px 22px;
      text-align: center;
    }

    .empty.show { display: block; }
    .hidden { display: none; }

    @media (max-width: 760px) {
      .header { align-items: stretch; flex-direction: column; }
      .stats { min-width: 0; }
      .filters { grid-template-columns: 1fr; }
      .aliases { grid-template-columns: 1fr; }
      .panel { padding: 18px; }
      .danger { margin-left: 0; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <header class="header">
      <div>
        <h1>Company FAQ input</h1>
        <div class="subhead">Resolve only the questions that still need authoritative company information.</div>
      </div>
      <div class="stats">
        <div class="stat"><strong id="remaining">—</strong><span>remaining</span></div>
        <div class="stat"><strong id="active">—</strong><span>active</span></div>
        <div class="stat"><strong id="total">—</strong><span>total records</span></div>
      </div>
    </header>

    <section class="panel">
      <div id="status" class="status" role="status"></div>

      <div class="filters">
        <input id="search" type="search" placeholder="Search questions, keys, or categories">
        <select id="category" aria-label="Filter by category">
          <option value="">All categories</option>
        </select>
        <label class="check">
          <input id="show-skipped" type="checkbox">
          Show skipped
        </label>
      </div>

      <div id="question-card" class="question-card hidden">
        <div class="eyebrow">
          <span id="position" class="pill"></span>
          <span id="category-label" class="pill"></span>
          <span id="source-label" class="pill"></span>
        </div>
        <h2 id="question"></h2>
        <p id="prompt" class="prompt"></p>
        <div class="aliases">
          <div class="alias-box">
            <strong>English aliases</strong>
            <span id="aliases-en"></span>
          </div>
          <div class="alias-box">
            <strong>Khmer aliases</strong>
            <span id="aliases-km"></span>
          </div>
        </div>
        <label for="answer">Authoritative English answer</label>
        <textarea id="answer" placeholder="Enter the verified company answer here…"></textarea>
        <p class="help">Saving replaces the placeholder and activates the FAQ record. Ctrl/Cmd + Enter saves.</p>
        <div class="actions">
          <button id="previous" type="button">Previous</button>
          <button id="next" type="button">Next</button>
          <button id="skip" type="button">Skip</button>
          <button id="save" class="primary" type="button">Save &amp; next</button>
          <button id="delete" class="danger" type="button">Delete record…</button>
        </div>
      </div>

      <div id="empty" class="empty">
        <h2 id="empty-title">No questions to show</h2>
        <p id="empty-message" class="muted"></p>
        <button id="clear-skips" type="button">Clear skipped list</button>
      </div>
    </section>
  </main>

  <script>
    const storageKey = "rag-faq-editor-skipped-v1";
    const state = {
      questions: [],
      stats: { total: 0, active: 0, remaining: 0 },
      currentKey: null,
      skipped: new Set(JSON.parse(localStorage.getItem(storageKey) || "[]")),
      busy: false
    };

    const elements = {
      remaining: document.getElementById("remaining"),
      active: document.getElementById("active"),
      total: document.getElementById("total"),
      status: document.getElementById("status"),
      search: document.getElementById("search"),
      category: document.getElementById("category"),
      showSkipped: document.getElementById("show-skipped"),
      card: document.getElementById("question-card"),
      empty: document.getElementById("empty"),
      emptyTitle: document.getElementById("empty-title"),
      emptyMessage: document.getElementById("empty-message"),
      position: document.getElementById("position"),
      categoryLabel: document.getElementById("category-label"),
      sourceLabel: document.getElementById("source-label"),
      question: document.getElementById("question"),
      prompt: document.getElementById("prompt"),
      aliasesEn: document.getElementById("aliases-en"),
      aliasesKm: document.getElementById("aliases-km"),
      answer: document.getElementById("answer"),
      previous: document.getElementById("previous"),
      next: document.getElementById("next"),
      skip: document.getElementById("skip"),
      save: document.getElementById("save"),
      delete: document.getElementById("delete"),
      clearSkips: document.getElementById("clear-skips")
    };

    function saveSkipped() {
      localStorage.setItem(storageKey, JSON.stringify(Array.from(state.skipped)));
    }

    function setStatus(message, type) {
      elements.status.textContent = message || "";
      elements.status.className = "status" + (message ? " show " + type : "");
    }

    function setBusy(value) {
      state.busy = value;
      [elements.previous, elements.next, elements.skip, elements.save, elements.delete]
        .forEach(function (button) { button.disabled = value; });
      elements.save.textContent = value ? "Saving…" : "Save & next";
    }

    function filteredQuestions() {
      const search = elements.search.value.trim().toLowerCase();
      const category = elements.category.value;

      return state.questions.filter(function (item) {
        if (category && item.category !== category) return false;
        if (!elements.showSkipped.checked && state.skipped.has(item.key)) return false;
        if (!search) return true;

        const haystack = [
          item.key,
          item.category,
          item.question_en,
          item.current_prompt
        ].concat(item.aliases_en || [], item.aliases_km || []).join(" ").toLowerCase();

        return haystack.includes(search);
      });
    }

    function currentQuestion() {
      return state.questions.find(function (item) { return item.key === state.currentKey; }) || null;
    }

    function selectQuestion(key, clearAnswer) {
      state.currentKey = key;
      if (clearAnswer !== false) elements.answer.value = "";
      render();
    }

    function move(offset) {
      const visible = filteredQuestions();
      if (!visible.length) return;
      const index = Math.max(0, visible.findIndex(function (item) { return item.key === state.currentKey; }));
      const nextIndex = (index + offset + visible.length) % visible.length;
      selectQuestion(visible[nextIndex].key);
    }

    function render() {
      elements.remaining.textContent = state.stats.remaining;
      elements.active.textContent = state.stats.active;
      elements.total.textContent = state.stats.total;

      const visible = filteredQuestions();
      let item = currentQuestion();

      if (!item || !visible.some(function (candidate) { return candidate.key === item.key; })) {
        item = visible[0] || null;
        state.currentKey = item ? item.key : null;
        elements.answer.value = "";
      }

      if (!item) {
        elements.card.classList.add("hidden");
        elements.empty.classList.add("show");
        if (state.stats.remaining === 0) {
          elements.emptyTitle.textContent = "All company-input questions are resolved";
          elements.emptyMessage.textContent = "There are no NEEDS_COMPANY_INPUT records left.";
        } else {
          elements.emptyTitle.textContent = "No questions match this view";
          elements.emptyMessage.textContent = "Change the filters, show skipped questions, or clear the skipped list.";
        }
        return;
      }

      const position = visible.findIndex(function (candidate) { return candidate.key === item.key; }) + 1;
      elements.empty.classList.remove("show");
      elements.card.classList.remove("hidden");
      elements.position.textContent = position + " of " + visible.length;
      elements.categoryLabel.textContent = item.category;
      elements.sourceLabel.textContent = item.source_file + ":" + item.source_line;
      elements.question.textContent = item.question_en;
      elements.prompt.textContent = item.current_prompt;
      elements.aliasesEn.textContent = (item.aliases_en || []).join(" · ") || "None";
      elements.aliasesKm.textContent = (item.aliases_km || []).join(" · ") || "None";
      elements.skip.textContent = state.skipped.has(item.key) ? "Unskip" : "Skip";
    }

    async function api(path, body) {
      const response = await fetch(path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Rag-Faq-Editor": "1"
        },
        body: JSON.stringify(body)
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Request failed.");
      return payload;
    }

    async function load() {
      setStatus("", "");
      try {
        const response = await fetch("/api/questions", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Could not load questions.");
        state.questions = payload.questions;
        state.stats = payload.stats;

        const categories = Array.from(new Set(state.questions.map(function (item) {
          return item.category;
        }))).sort();
        categories.forEach(function (category) {
          const option = document.createElement("option");
          option.value = category;
          option.textContent = category.replaceAll("_", " ");
          elements.category.appendChild(option);
        });

        render();
      } catch (error) {
        setStatus(error.message, "error");
      }
    }

    async function saveAnswer() {
      const item = currentQuestion();
      const answer = elements.answer.value.trim();
      if (!item || state.busy) return;
      if (!answer) {
        setStatus("Enter an answer before saving.", "error");
        elements.answer.focus();
        return;
      }

      setBusy(true);
      setStatus("", "");
      try {
        const payload = await api("/api/answer", { key: item.key, answer: answer });
        state.questions = state.questions.filter(function (question) {
          return question.key !== item.key;
        });
        state.skipped.delete(item.key);
        saveSkipped();
        state.stats = payload.stats;
        state.currentKey = null;
        elements.answer.value = "";
        setStatus("Saved and activated " + item.key + ".", "success");
        render();
        elements.answer.focus();
      } catch (error) {
        setStatus(error.message, "error");
      } finally {
        setBusy(false);
      }
    }

    async function deleteCurrent() {
      const item = currentQuestion();
      if (!item || state.busy) return;

      const confirmed = window.confirm(
        "Delete this FAQ record from " + item.source_file + "?\n\n" +
        item.question_en + "\n\n" +
        "The original record will be appended to tools/rag-faq-editor/deleted-records.jsonl."
      );
      if (!confirmed) return;

      setBusy(true);
      setStatus("", "");
      try {
        const payload = await api("/api/delete", { key: item.key });
        state.questions = state.questions.filter(function (question) {
          return question.key !== item.key;
        });
        state.skipped.delete(item.key);
        saveSkipped();
        state.stats = payload.stats;
        state.currentKey = null;
        elements.answer.value = "";
        setStatus("Deleted " + item.key + ". A recovery copy was logged.", "success");
        render();
      } catch (error) {
        setStatus(error.message, "error");
      } finally {
        setBusy(false);
      }
    }

    elements.previous.addEventListener("click", function () { move(-1); });
    elements.next.addEventListener("click", function () { move(1); });
    elements.save.addEventListener("click", saveAnswer);
    elements.delete.addEventListener("click", deleteCurrent);
    elements.skip.addEventListener("click", function () {
      const item = currentQuestion();
      if (!item) return;
      if (state.skipped.has(item.key)) state.skipped.delete(item.key);
      else state.skipped.add(item.key);
      saveSkipped();
      state.currentKey = null;
      elements.answer.value = "";
      render();
    });
    elements.search.addEventListener("input", function () {
      state.currentKey = null;
      elements.answer.value = "";
      render();
    });
    elements.category.addEventListener("change", function () {
      state.currentKey = null;
      elements.answer.value = "";
      render();
    });
    elements.showSkipped.addEventListener("change", render);
    elements.clearSkips.addEventListener("click", function () {
      state.skipped.clear();
      saveSkipped();
      elements.showSkipped.checked = false;
      render();
    });
    elements.answer.addEventListener("keydown", function (event) {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        saveAnswer();
      }
    });

    load();
  </script>
</body>
</html>`;

const server = Bun.serve({
  hostname: host,
  port,
  async fetch(request) {
    const url = new URL(request.url);

    try {
      if (request.method === "GET" && url.pathname === "/") {
        return new Response(html, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }

      if (request.method === "GET" && url.pathname === "/api/questions") {
        return responseJson(loadDatabase());
      }

      if (request.method === "POST" && url.pathname === "/api/answer") {
        return await saveAnswer(request);
      }

      if (request.method === "POST" && url.pathname === "/api/delete") {
        return await deleteRecord(request);
      }

      return responseError("Not found.", 404);
    } catch (error) {
      console.error(error);
      return responseError(error.message || "Unexpected server error.", 500);
    }
  },
});

console.log(`RAG FAQ editor: http://${server.hostname}:${server.port}`);
console.log(`Data directory: ${dataDirectory}`);
console.log("Press Ctrl+C to stop.");
