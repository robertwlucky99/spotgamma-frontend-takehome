import { useMemo, useState } from "react";
import "./App.css";

type CellId = string;

const COLS = "ABCDEFGHIJ".split("");
const ROWS = Array.from({ length: 10 }, (_, i) => i + 1);

function makeGrid() {
  const grid: Record<CellId, string> = {};
  for (const col of COLS) {
    for (const row of ROWS) {
      grid[`${col}${row}`] = "";
    }
  }
  return grid;
}

function expandRange(range: string): CellId[] {
  const [start, end] = range.split(":");
  const startCol = start[0];
  const startRow = Number(start.slice(1));
  const endCol = end[0];
  const endRow = Number(end.slice(1));

  const startColIdx = COLS.indexOf(startCol);
  const endColIdx = COLS.indexOf(endCol);

  const cells: CellId[] = [];
  for (let c = startColIdx; c <= endColIdx; c++) {
    for (let r = startRow; r <= endRow; r++) {
      cells.push(`${COLS[c]}${r}`);
    }
  }
  return cells;
}

function getDependencies(raw: string): CellId[] {
  if (!raw.startsWith("=")) return [];

  const deps = new Set<CellId>();

  const rangeMatches = raw.match(/[A-J](10|[1-9]):[A-J](10|[1-9])/g) || [];
  for (const range of rangeMatches) {
    expandRange(range).forEach((cell) => deps.add(cell));
  }

  const cellMatches = raw.match(/[A-J](10|[1-9])/g) || [];
  for (const cell of cellMatches) {
    deps.add(cell);
  }

  return [...deps];
}

function hasCycle(
  grid: Record<CellId, string>,
  start: CellId,
  current: CellId,
  visited = new Set<CellId>()
): boolean {
  if (visited.has(current)) return false;
  visited.add(current);

  const deps = getDependencies(grid[current] || "");

  for (const dep of deps) {
    if (dep === start) return true;
    if (hasCycle(grid, start, dep, visited)) return true;
  }

  return false;
}

function evaluateCell(
  cell: CellId,
  grid: Record<CellId, string>,
  cache: Record<CellId, string>,
  stack = new Set<CellId>()
): string {
  if (cache[cell] !== undefined) return cache[cell];

  const raw = grid[cell] || "";

  if (!raw.startsWith("=")) {
    cache[cell] = raw;
    return raw;
  }

  if (stack.has(cell)) {
    cache[cell] = "CYCLE!";
    return "CYCLE!";
  }

  stack.add(cell);

  try {
    let expr = raw.slice(1);

    expr = expr.replace(/SUM\(([A-J](10|[1-9]):[A-J](10|[1-9]))\)/g, (_, range) => {
      const sum = expandRange(range).reduce((acc, id) => {
        const value = Number(evaluateCell(id, grid, cache, stack)) || 0;
        return acc + value;
      }, 0);

      return String(sum);
    });

    expr = expr.replace(/[A-J](10|[1-9])/g, (id) => {
      const value = Number(evaluateCell(id, grid, cache, stack)) || 0;
      return String(value);
    });

    if (!/^[0-9+\-*/().\s]+$/.test(expr)) {
      throw new Error("Invalid expression");
    }

    const result = Function(`"use strict"; return (${expr})`)();
    cache[cell] = String(result);
  } catch {
    cache[cell] = "ERROR";
  }

  stack.delete(cell);
  return cache[cell];
}

export default function App() {
  const [grid, setGrid] = useState<Record<CellId, string>>(makeGrid);
  const [editingCell, setEditingCell] = useState<CellId | null>(null);
  const [error, setError] = useState("");

  const calculated = useMemo(() => {
    const cache: Record<CellId, string> = {};
    for (const cell of Object.keys(grid)) {
      evaluateCell(cell, grid, cache);
    }
    return cache;
  }, [grid]);

  function updateCell(cell: CellId, value: string) {
    const nextGrid = { ...grid, [cell]: value };

    if (hasCycle(nextGrid, cell, cell)) {
      setError(`Circular dependency detected. Update blocked for ${cell}.`);
      return;
    }

    setError("");
    setGrid(nextGrid);
  }

  return (
    <main className="app">
      <h1>Live Matrix Calculator</h1>

      {error && <div className="error">{error}</div>}

      <div className="grid">
        <div className="corner" />

        {COLS.map((col) => (
          <div key={col} className="header">
            {col}
          </div>
        ))}

        {ROWS.map((row) => (
          <>
            <div key={`row-${row}`} className="header">
              {row}
            </div>

            {COLS.map((col) => {
              const cell = `${col}${row}`;
              const isEditing = editingCell === cell;

              return (
                <input
                  key={cell}
                  className="cell"
                  value={isEditing ? grid[cell] : calculated[cell]}
                  onFocus={() => setEditingCell(cell)}
                  onBlur={() => setEditingCell(null)}
                  onChange={(e) => updateCell(cell, e.target.value)}
                  placeholder={cell}
                />
              );
            })}
          </>
        ))}
      </div>

      <p className="help">
        Try: <code>=A1 + B1</code> or <code>=SUM(A1:A5)</code>
      </p>
    </main>
  );
}