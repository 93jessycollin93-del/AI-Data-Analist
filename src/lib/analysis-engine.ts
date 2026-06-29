// analysis-engine.ts
// ⚸ AI Data Analyst — Pattern detection + statistical analysis engine
// Specialization: Data Analysis (⚸ symbol)
// Future-proof:
//   - Layer 1: Jacky API (full AI analysis)
//   - Layer 2: Ollama (LLM interpretation of stats)
//   - Layer 3: Pure local statistics (always available)
//   - Supports CSV, JSON, plain text input
//   - Results persist in localStorage
//   - IndexedDB-upgradeable for large datasets

const JACKY_URL  = (import.meta as any).env?.VITE_JACKY_URL  || null;
const OLLAMA_URL = (import.meta as any).env?.VITE_OLLAMA_URL || null;
const MODEL      = (import.meta as any).env?.VITE_OLLAMA_MODEL || "llama3.2";

export interface DataPoint { label: string; value: number; }
export interface AnalysisResult {
  summary: string;
  patterns: string[];
  anomalies: string[];
  stats: {
    mean: number; median: number; stddev: number;
    min: number; max: number; count: number; range: number;
  };
  insights: string[];
  chartData: DataPoint[];
  recommendation: string;
}

// ─── Statistical primitives ────────────────────────────────────────────────────

function mean(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m-1] + s[m]) / 2 : s[m];
}
function stddev(nums: number[], avg: number): number {
  return Math.sqrt(nums.reduce((a, b) => a + (b - avg) ** 2, 0) / nums.length);
}

// ─── Input parsing ─────────────────────────────────────────────────────────────

export function parseInput(raw: string): { nums: number[]; labels: string[]; text: string } {
  // Try JSON array
  try {
    const parsed = JSON.parse(raw.trim());
    if (Array.isArray(parsed)) {
      if (typeof parsed[0] === "number") {
        return { nums: parsed, labels: parsed.map((_,i) => `Item ${i+1}`), text: raw };
      }
      if (typeof parsed[0] === "object" && "value" in parsed[0]) {
        return {
          nums: parsed.map((d: any) => Number(d.value)),
          labels: parsed.map((d: any) => d.label || d.name || d.key || String(d.value)),
          text: raw,
        };
      }
    }
  } catch { /* not JSON */ }

  // Try CSV — first column labels, second column values
  const lines = raw.trim().split(/\n|,/).map(l => l.trim()).filter(Boolean);
  const nums: number[] = [];
  const labels: string[] = [];
  for (const line of lines) {
    const parts = line.split(/[,\t]/);
    if (parts.length >= 2) {
      const val = parseFloat(parts[parts.length - 1]);
      if (!isNaN(val)) { nums.push(val); labels.push(parts[0]); continue; }
    }
    const val = parseFloat(line);
    if (!isNaN(val)) { nums.push(val); labels.push(`#${nums.length + 1}`); }
  }

  // Fallback: extract all numbers from text
  if (nums.length === 0) {
    const found = raw.match(/-?\d+(\.\d+)?/g)?.map(Number) || [];
    return { nums: found, labels: found.map((_,i) => `Val ${i+1}`), text: raw };
  }

  return { nums, labels, text: raw };
}

// ─── Local statistical analysis ────────────────────────────────────────────────

function analyzeLocal(raw: string): AnalysisResult {
  const { nums, labels, text } = parseInput(raw);

  if (nums.length === 0) {
    // Text-only analysis
    const words = text.split(/\s+/);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 4);
    return {
      summary: `Text signal: ${words.length} words, ${sentences.length} sentences. No numeric data detected.`,
      patterns: [`Word density: ${(words.length / Math.max(sentences.length,1)).toFixed(1)} words/sentence`],
      anomalies: [],
      stats: { mean:0, median:0, stddev:0, min:0, max:0, count:words.length, range:0 },
      insights: [`Start Jacky or Ollama for deep text analysis.`, `${sentences.length} propositions found.`],
      chartData: [],
      recommendation: "Provide numeric data (CSV, JSON array, or numbers) for statistical analysis.",
    };
  }

  const avg  = mean(nums);
  const med  = median(nums);
  const sd   = stddev(nums, avg);
  const mn   = Math.min(...nums);
  const mx   = Math.max(...nums);
  const rng  = mx - mn;

  // Detect patterns
  const patterns: string[] = [];
  const sorted = [...nums].sort((a,b) => a-b);
  const isAscending = nums.every((v,i) => i === 0 || v >= nums[i-1]);
  const isDescending = nums.every((v,i) => i === 0 || v <= nums[i-1]);
  if (isAscending)  patterns.push("Monotonically increasing — steady growth pattern");
  if (isDescending) patterns.push("Monotonically decreasing — steady decline pattern");
  if (sd < avg * 0.1) patterns.push("Low variance — highly stable dataset");
  if (sd > avg * 0.5) patterns.push("High variance — volatile or diverse dataset");
  const q1 = sorted[Math.floor(nums.length * 0.25)];
  const q3 = sorted[Math.floor(nums.length * 0.75)];
  patterns.push(`Interquartile range: ${(q3-q1).toFixed(2)} (middle 50% spread)`);

  // Detect anomalies (points > 2 stddev from mean)
  const anomalies: string[] = [];
  nums.forEach((v, i) => {
    if (Math.abs(v - avg) > 2 * sd) {
      anomalies.push(`${labels[i]}: ${v} (${((v-avg)/sd).toFixed(1)}σ from mean)`);
    }
  });
  if (anomalies.length === 0) anomalies.push("No statistical outliers detected (within 2σ)");

  const insights = [
    `Mean (${avg.toFixed(2)}) vs Median (${med.toFixed(2)}) — ${avg > med * 1.1 ? "right-skewed distribution" : avg < med * 0.9 ? "left-skewed distribution" : "roughly symmetric"}`,
    `${anomalies.length > 1 ? anomalies.length + " anomalies detected — investigate outliers" : "Clean distribution — anomalies within normal range"}`,
    nums.length >= 5 ? `Coefficient of variation: ${(sd/avg*100).toFixed(1)}% — ${sd/avg < 0.15 ? "consistent" : sd/avg < 0.35 ? "moderate variability" : "high variability"}` : "Add more data points for richer analysis",
    "Start Ollama for AI interpretation of patterns",
  ];

  return {
    summary: `Dataset: ${nums.length} values | Mean: ${avg.toFixed(2)} | Range: ${mn.toFixed(2)}–${mx.toFixed(2)}`,
    patterns,
    anomalies: anomalies.slice(0,5),
    stats: { mean: +avg.toFixed(3), median: +med.toFixed(3), stddev: +sd.toFixed(3), min: mn, max: mx, count: nums.length, range: +rng.toFixed(3) },
    insights,
    chartData: labels.map((label, i) => ({ label, value: nums[i] })),
    recommendation: isAscending ? "Trend is positive — monitor for inflection points." : isDescending ? "Declining trend — identify causation." : "Mixed signal — segment data for clearer patterns.",
  };
}

// ─── Ollama interpretation ─────────────────────────────────────────────────────

async function interpretOllama(raw: string, localResult: AnalysisResult): Promise<Partial<AnalysisResult> | null> {
  if (!OLLAMA_URL) return null;
  try {
    const prompt = `You are a data analyst AI. Given this dataset and preliminary stats, provide deeper insights.
Stats: ${JSON.stringify(localResult.stats)}
Patterns: ${localResult.patterns.join("; ")}
Respond JSON: {"summary":"2 sentences","insights":["insight1","insight2","insight3"],"recommendation":"1 clear action"}
Data: ${raw.slice(0, 500)}`;
    const res = await fetch(\`\${OLLAMA_URL}/api/generate\`, {
      method:"POST", signal: AbortSignal.timeout(20000),
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ model: MODEL, prompt, stream:false, format:"json" }),
    });
    if (!res.ok) return null;
    const d = await res.json();
    return JSON.parse(d.response || "{}");
  } catch { return null; }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function analyze(raw: string): Promise<AnalysisResult> {
  const local = analyzeLocal(raw);
  const aiEnhancement = await interpretOllama(raw, local);
  if (aiEnhancement) {
    return {
      ...local,
      summary: aiEnhancement.summary || local.summary,
      insights: aiEnhancement.insights || local.insights,
      recommendation: aiEnhancement.recommendation || local.recommendation,
    };
  }
  return local;
}

// ─── Persistence ──────────────────────────────────────────────────────────────

const STORAGE_KEY = "ai-data-analist:history";
export interface AnalysisRecord { id: string; input: string; result: AnalysisResult; timestamp: string; }

export function saveAnalysis(input: string, result: AnalysisResult): AnalysisRecord {
  const record: AnalysisRecord = { id: crypto.randomUUID(), input: input.slice(0,200), result, timestamp: new Date().toISOString() };
  const history: AnalysisRecord[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  history.unshift(record);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 50)));
  return record;
}

export function loadHistory(): AnalysisRecord[] {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
}
