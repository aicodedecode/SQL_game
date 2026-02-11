const STORAGE_KEY = "sql-quest-progress-v1";
const POINTS_PER_LEVEL = 100;

/**
 * Level definitions with expected SQL answers.
 * Validation compares the full result set (columns + rows) for correctness.
 */
const levels = [
  {
    id: 1,
    title: "SELECT statements",
    description: "Fetch basic data from a table.",
    task: "Show each employee's name and department.",
    hint: "Use SELECT with explicit columns from the employees table.",
    starterSql: "SELECT name, department\nFROM employees;",
    expectedSql: "SELECT name, department FROM employees;",
  },
  {
    id: 2,
    title: "WHERE conditions",
    description: "Filter records based on conditions.",
    task: "List product_name and price for products where price is greater than 50.",
    hint: "Use WHERE price > 50.",
    starterSql: "SELECT product_name, price\nFROM products\nWHERE price > 50;",
    expectedSql: "SELECT product_name, price FROM products WHERE price > 50;",
  },
  {
    id: 3,
    title: "ORDER BY and LIMIT",
    description: "Sort and restrict your result set.",
    task: "Return the top 3 highest-paid employees (name and salary).",
    hint: "ORDER BY salary DESC then LIMIT 3.",
    starterSql:
      "SELECT name, salary\nFROM employees\nORDER BY salary DESC\nLIMIT 3;",
    expectedSql:
      "SELECT name, salary FROM employees ORDER BY salary DESC LIMIT 3;",
  },
  {
    id: 4,
    title: "GROUP BY + Aggregates",
    description: "Summarize rows with grouping and aggregate functions.",
    task: "Show each department and the number of employees in it.",
    hint: "Use COUNT(*) and GROUP BY department.",
    starterSql:
      "SELECT department, COUNT(*) AS employee_count\nFROM employees\nGROUP BY department\nORDER BY department;",
    expectedSql:
      "SELECT department, COUNT(*) AS employee_count FROM employees GROUP BY department ORDER BY department;",
  },
  {
    id: 5,
    title: "JOIN queries",
    description: "Combine data from multiple tables.",
    task: "Show each order_id with the customer name for all orders.",
    hint: "JOIN orders and customers by customer_id.",
    starterSql:
      "SELECT o.order_id, c.customer_name\nFROM orders o\nJOIN customers c ON o.customer_id = c.customer_id\nORDER BY o.order_id;",
    expectedSql:
      "SELECT o.order_id, c.customer_name FROM orders o JOIN customers c ON o.customer_id = c.customer_id ORDER BY o.order_id;",
  },
];

const state = {
  currentLevel: 1,
  score: 0,
  completedLevels: {},
  db: null,
};

const refs = {
  levelButtons: document.getElementById("level-buttons"),
  levelLabel: document.getElementById("current-level-label"),
  score: document.getElementById("score-value"),
  completedCount: document.getElementById("completed-count"),
  title: document.getElementById("challenge-title"),
  description: document.getElementById("challenge-description"),
  task: document.getElementById("challenge-task"),
  hint: document.getElementById("challenge-hint"),
  editor: document.getElementById("query-editor"),
  runBtn: document.getElementById("run-query-btn"),
  resetBtn: document.getElementById("reset-level-btn"),
  feedback: document.getElementById("feedback"),
  results: document.getElementById("results-container"),
};

async function initGame() {
  loadProgress();

  // Initialize sql.js and create a fresh in-memory SQLite database.
  const SQL = await initSqlJs({
    locateFile: (file) =>
      `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.11.0/${file}`,
  });

  state.db = new SQL.Database();
  seedDatabase();

  renderLevelButtons();
  renderLevel();
  wireEvents();
  renderScoreboard();
}

function seedDatabase() {
  // Schema + seed data used across all levels.
  const schemaAndData = `
    DROP TABLE IF EXISTS employees;
    DROP TABLE IF EXISTS products;
    DROP TABLE IF EXISTS customers;
    DROP TABLE IF EXISTS orders;

    CREATE TABLE employees (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      department TEXT NOT NULL,
      salary INTEGER NOT NULL
    );

    CREATE TABLE products (
      product_id INTEGER PRIMARY KEY,
      product_name TEXT NOT NULL,
      price REAL NOT NULL
    );

    CREATE TABLE customers (
      customer_id INTEGER PRIMARY KEY,
      customer_name TEXT NOT NULL,
      city TEXT NOT NULL
    );

    CREATE TABLE orders (
      order_id INTEGER PRIMARY KEY,
      customer_id INTEGER NOT NULL,
      total REAL NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
    );

    INSERT INTO employees (id, name, department, salary) VALUES
      (1, 'Alice', 'Engineering', 92000),
      (2, 'Bob', 'Engineering', 85000),
      (3, 'Cara', 'Marketing', 69000),
      (4, 'Dylan', 'HR', 64000),
      (5, 'Eve', 'Marketing', 73000),
      (6, 'Finn', 'Engineering', 99000);

    INSERT INTO products (product_id, product_name, price) VALUES
      (1, 'Mechanical Keyboard', 79.99),
      (2, 'USB-C Cable', 14.99),
      (3, '27-inch Monitor', 219.00),
      (4, 'Laptop Stand', 42.50),
      (5, 'Noise-Canceling Headphones', 129.50);

    INSERT INTO customers (customer_id, customer_name, city) VALUES
      (1, 'Nova Tech', 'Seattle'),
      (2, 'GreenLeaf Co', 'Portland'),
      (3, 'Pixel Bakery', 'Austin');

    INSERT INTO orders (order_id, customer_id, total) VALUES
      (101, 1, 480.00),
      (102, 3, 125.75),
      (103, 2, 310.20),
      (104, 1, 88.40);
  `;

  state.db.run(schemaAndData);
}

function wireEvents() {
  refs.runBtn.addEventListener("click", handleRunQuery);
  refs.resetBtn.addEventListener("click", handleResetLevel);
}

function renderLevelButtons() {
  refs.levelButtons.innerHTML = "";

  levels.forEach((level) => {
    const btn = document.createElement("button");
    btn.textContent = `Level ${level.id}`;
    btn.addEventListener("click", () => {
      state.currentLevel = level.id;
      renderLevel();
      renderScoreboard();
      renderLevelButtons();
    });

    if (level.id === state.currentLevel) {
      btn.classList.add("active-level");
    }

    if (state.completedLevels[level.id]) {
      btn.classList.add("completed-level");
    }

    refs.levelButtons.appendChild(btn);
  });
}

function renderLevel() {
  const level = getCurrentLevel();

  refs.title.textContent = `Level ${level.id}: ${level.title}`;
  refs.description.textContent = level.description;
  refs.task.textContent = level.task;
  refs.hint.textContent = level.hint;
  refs.editor.value = level.starterSql;

  setFeedback("");
  refs.results.innerHTML = `<p class="placeholder">Run a query to see results.</p>`;
}

function renderScoreboard() {
  refs.levelLabel.textContent = String(state.currentLevel);
  refs.score.textContent = String(state.score);
  refs.completedCount.textContent = String(
    Object.keys(state.completedLevels).length
  );
}

function getCurrentLevel() {
  return levels.find((lvl) => lvl.id === state.currentLevel);
}

function normalizeQuery(sql) {
  return sql
    .replace(/--.*$/gm, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/;$/, "")
    .toLowerCase();
}

function handleRunQuery() {
  const userSql = refs.editor.value.trim();

  if (!userSql) {
    setFeedback("Please enter a SQL query before running.", "error");
    return;
  }

  try {
    const userResult = runSingleStatement(userSql);
    renderResultTable(userResult);

    const expectedResult = runSingleStatement(getCurrentLevel().expectedSql);

    if (areResultsEqual(userResult, expectedResult)) {
      const isNewCompletion = !state.completedLevels[state.currentLevel];
      if (isNewCompletion) {
        state.completedLevels[state.currentLevel] = true;
        state.score += POINTS_PER_LEVEL;
        saveProgress();
      }

      setFeedback(
        isNewCompletion
          ? `✅ Correct! +${POINTS_PER_LEVEL} points earned.`
          : "✅ Correct! You've already completed this level.",
        "success"
      );

      if (isNewCompletion && state.currentLevel < levels.length) {
        state.currentLevel += 1;
        renderLevel();
      }

      renderLevelButtons();
      renderScoreboard();
    } else {
      setFeedback(
        "Not quite right yet. Compare your output with the task and try again.",
        "error"
      );
    }
  } catch (error) {
    setFeedback(`SQL error: ${error.message}`, "error");
  }
}

function runSingleStatement(sql) {
  // Soft guard against multi-statement input.
  const semicolonCount = (sql.match(/;/g) || []).length;
  if (semicolonCount > 1) {
    throw new Error("Please run one SQL statement at a time.");
  }

  const normalized = normalizeQuery(sql);
  if (!normalized.startsWith("select")) {
    throw new Error("Only SELECT queries are allowed in this game.");
  }

  const result = state.db.exec(sql);
  if (result.length === 0) {
    return { columns: [], values: [] };
  }

  return result[0];
}

function areResultsEqual(a, b) {
  if (a.columns.length !== b.columns.length) {
    return false;
  }

  for (let i = 0; i < a.columns.length; i += 1) {
    if (a.columns[i] !== b.columns[i]) {
      return false;
    }
  }

  if (a.values.length !== b.values.length) {
    return false;
  }

  for (let rowIndex = 0; rowIndex < a.values.length; rowIndex += 1) {
    const rowA = a.values[rowIndex];
    const rowB = b.values[rowIndex];

    if (rowA.length !== rowB.length) {
      return false;
    }

    for (let col = 0; col < rowA.length; col += 1) {
      if (String(rowA[col]) !== String(rowB[col])) {
        return false;
      }
    }
  }

  return true;
}

function renderResultTable(result) {
  if (!result.columns.length) {
    refs.results.innerHTML = `<p class="placeholder">Query executed. No rows returned.</p>`;
    return;
  }

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");

  const headRow = document.createElement("tr");
  result.columns.forEach((col) => {
    const th = document.createElement("th");
    th.textContent = col;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);

  result.values.forEach((row) => {
    const tr = document.createElement("tr");
    row.forEach((cell) => {
      const td = document.createElement("td");
      td.textContent = String(cell);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  table.append(thead, tbody);
  refs.results.innerHTML = "";
  refs.results.appendChild(table);
}

function handleResetLevel() {
  const level = getCurrentLevel();

  refs.editor.value = level.starterSql;
  refs.results.innerHTML = `<p class="placeholder">Run a query to see results.</p>`;
  setFeedback("Level reset. Starter query restored.");
}

function setFeedback(message, kind = "") {
  refs.feedback.textContent = message;
  refs.feedback.classList.remove("success", "error");
  if (kind) {
    refs.feedback.classList.add(kind);
  }
}

function saveProgress() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      score: state.score,
      completedLevels: state.completedLevels,
      currentLevel: state.currentLevel,
    })
  );
}

function loadProgress() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw);
    state.score = Number(parsed.score) || 0;
    state.completedLevels = parsed.completedLevels || {};
    state.currentLevel = Math.min(
      Math.max(Number(parsed.currentLevel) || 1, 1),
      levels.length
    );
  } catch {
    // If corrupted data is found, reset to defaults.
    localStorage.removeItem(STORAGE_KEY);
  }
}

initGame().catch((err) => {
  setFeedback(
    `Failed to initialize SQL engine. Check your connection and refresh. (${err.message})`,
    "error"
  );
});
