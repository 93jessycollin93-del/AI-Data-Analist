// analysis-engine.ts
// ⚸ Analysis Condenser — AI Data Analyst
// Future-proof: Jacky→Ollama→local statistical engine
// Sources verified: pandas statistical patterns, Observable Plot research,
// Recharts documentation, local-first data analysis (Arquero.js patterns)

const JACKY_URL  = (import.meta as any).env?.VITE_JACKY_URL  || null;
const OLLAMA_URL = (import.meta as any).env?.VITE_OLLAMA_URL || null;
const MODEL      = (import.meta as any).env?.VITE_OLLAMA_MODEL || "llama3.2";

export interface DataColumn {
  name: string;
  type: "numeric" | "categorical" | "datetime" | "text";
  values: (number | string | null)[];
}

export interface AnalysisResult {
  summary: string;
  insights: string[];
  patterns: string[];
  anomalies: string[];
  recommendation: string;
  stats: Record<string, number | string>;
}

export interface ChartSpec {
  type: "bar" | "line" | "scatter" | "pie" | "histogram";
  xKey: string;
  yKey?: string;
  title: string;
  data: Record<string, unknown>[];
}

// ─── Statistical utilities ─────────────────────────────────────────────────

export function computeStats(values: number[]): Record<string, number> {
  const clean = values.filter(v => !isNaN(v) && v !== null);
  if (clean.length === 0) return {};
  const sorted = [...clean].sort((a, b) => a - b);
  const sum = clean.reduce((a, b) => a + b, 0);
  const mean = sum / clean.length;
  const variance = clean.reduce((a, b) => a + (b - mean) ** 2, 0) / clean.length;
  const stdDev = Math.sqrt(variance);
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;

  return {
    count: clean.length,
    sum: Math.round(sum * 100) / 100,
    mean: Math.round(mean * 100) / 100,
    median: Math.round(median * 100) / 100,
    stdDev: Math.round(stdDev * 100) / 100,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    q1: Math.round(q1 * 100) / 100,
    q3: Math.round(q3 * 100) / 100,
    iqr: Math.round(iqr * 100) / 100,
  };
}

export function detectAnomalies(values: number[], threshold = 2.5): number[] {
  const stats = computeStats(values);
  if (!stats.mean) return [];
  return values.filter(v => Math.abs(v - stats.mean) > threshold * stats.stdDev);
}

export function detectTrend(values: number[]): "rising" | "falling" | "stable" | "volatile" {
  if (values.length < 3) return "stable";
  const n = values.length;
  const sumX = (n * (n - 1)) / 2;
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = values.reduce((acc, v, i) => acc + i * v, 0);
  const sumX2 = values.reduce((acc, _, i) => acc + i * i, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const stats = computeStats(values);
  const relSlope = Math.abs(slope) / Math.max(Math.abs(stats.mean || 1), 0.001);
  if (relSlope < 0.01) return "stable";
  if (stats.stdDev / Math.max(Math.abs(stats.mean || 1), 0.001) > 0.5) return "volatile";
  return slope > 0 ? "rising" : "falling";
}

export function suggestCharts(columns: DataColumn[]): ChartSpec[] {
  const charts: ChartSpec[] = [];
  const numeric = columns.filter(c => c.type === "numeric");
  const categorical = columns.filter(c => c.type === "categorical");

  if (numeric.length >= 2) {
    charts.push({
      type: "scatter",
      xKey: numeric[0].name,
      yKey: numeric[1].name,
      title: `${numeric[0].name} vs ${numeric[1].name} — correlation`,
      data: numeric[0].values.map((v, i) => ({
        [numeric[0].name]: v,
        [numeric[1].name]: numeric[1].values[i],
      })).filter(r => r[numeric[0].name] !== null) as Record<string, unknown>[],
    });
  }

  if (numeric.length >= 1) {
    charts.push({
      type: "histogram",
      xKey: numeric[0].name,
      title: `${numeric[0].name} distribution`,
      data: (numeric[0].values.filter(v => v !== null) as number[]).map(v => ({ value: v })),
    });
  }

  if (categorical.length >= 1 && numeric.length >= 1) {
    const freq: Record<string, number> = {};
    categorical[0].values.forEach(v => {
      const key = String(v ?? "null");
      freq[key] = (freq[key] || 0) + 1;
    });
    charts.push({
      type: "bar",
      xKey: categorical[0].name,
      yKey: "count",
      title: `${categorical[0].name} — frequency distribution`,
      data: Object.entries(freq).map(([k, v]) => ({ [categorical[0].name]: k, count: v })),
    });
  }

  return charts;
}

// ─── Local analysis ────────────────────────────────────────────────────────

export function analyzeLocal(columns: DataColumn[], rowCount: number): AnalysisResult {
  const numericCols = columns.filter(c => c.type === "numeric");
  const categoricalCols = columns.filter(c => c.type === "categorical");
  const insights: string[] = [];
  const patterns: string[] = [];
  const anomalies: string[] = [];
  const stats: Record<string, number | string> = { rows: rowCount, columns: columns.length };

  numericCols.forEach(col => {
    const values = col.values.filter(v => v !== null) as number[];
    const s = computeStats(values);
    stats[`${col.name}_mean`] = s.mean;
    stats[`${col.name}_std`] = s.stdDev;

    const trend = detectTrend(values);
    const anom = detectAnomalies(values);

    if (trend !== "stable") patterns.push(`${col.name} is ${trend} (slope detected)`);
    if (anom.length > 0) anomalies.push(`${col.name}: ${anom.length} anomalous values detected (±2.5σ)`);
    if (s.stdDev > s.mean * 0.5) insights.push(`${col.name} has HIGH variance — check for subgroups`);
  });

  categoricalCols.forEach(col => {
    const freq: Record<string, number> = {};
    col.values.forEach(v => { const k = String(v ?? "null"); freq[k] = (freq[k] || 0) + 1; });
    const dominant = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
    if (dominant && dominant[1] / rowCount > 0.7) {
      insights.push(`${col.name}: dominant value "${dominant[0]}" covers ${Math.round(dominant[1]/rowCount*100)}% of data`);
    }
  });

  const missingCols = columns.filter(c => c.values.some(v => v === null || v === ""));
  if (missingCols.length > 0) {
    anomalies.push(`Missing data in: ${missingCols.map(c => c.name).join(", ")}`);
  }

  return {
    summary: `Dataset: ${rowCount} rows × ${columns.length} columns. ${numericCols.length} numeric, ${categoricalCols.length} categorical.`,
    insights: insights.length > 0 ? insights : ["No strong patterns detected — data appears uniform"],
    patterns,
    anomalies,
    recommendation: anomalies.length > 0
      ? "Address missing data and anomalies before modeling. Run Jacky for AI-grade pattern analysis."
      : "Data looks clean. Connect Jacky or Ollama for advanced AI pattern detection.",
    stats,
  };
}

// ─── Jacky / Ollama AI analysis ────────────────────────────────────────────

async function aiAnalysis(
  summary: string, columns: string[], sampleRows: string
): Promise<Partial<AnalysisResult> | null> {
  const prompt = `You are a data analyst AI. Analyze this dataset.
Columns: ${columns.join(", ")}
Summary: ${summary}
Sample: ${sampleRows}
JSON: {"insights":["insight1","insight2","insight3"],"patterns":["pattern1","pattern2"],"anomalies":["anomaly1"],"recommendation":"actionable advice"}`;

  // Try Jacky first
  if (JACKY_URL) {
    try {
      const res = await fetch(JACKY_URL, {
        method: "POST", signal: AbortSignal.timeout(15000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, task_type: "analysis", specialization: "analysis" }),
      });
      if (res.ok) {
        const d = await res.json();
        try { const p = JSON.parse(d.response || "{}"); if (p.insights) return p; } catch {}
      }
    } catch {}
  }

  // Try Ollama
  if (OLLAMA_URL) {
    try {
      const res = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: "POST", signal: AbortSignal.timeout(20000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: MODEL, prompt, stream: false, format: "json" }),
      });
      if (res.ok) {
        const d = await res.json();
        try { const p = JSON.parse(d.response || "{}"); if (p.insights) return p; } catch {}
      }
    } catch {}
  }

  return null;
}

export async function analyzeDataset(columns: DataColumn[], rowCount: number): Promise<AnalysisResult> {
  const local = analyzeLocal(columns, rowCount);
  const sampleRows = columns.map(c => `${c.name}: ${c.values.slice(0,3).join(", ")}`).join(" | ");
  const aiResult = await aiAnalysis(local.summary, columns.map(c => c.name), sampleRows);
  if (aiResult) {
    return {
      ...local,
      insights: aiResult.insights || local.insights,
      patterns: aiResult.patterns || local.patterns,
      anomalies: aiResult.anomalies || local.anomalies,
      recommendation: aiResult.recommendation || local.recommendation,
    };
  }
  return local;
}
