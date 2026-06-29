import { useState, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Activity, Upload, Save, Clock, Trash2, Loader2, TrendingUp, AlertTriangle, Lightbulb } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Toaster } from "sonner";
import { analyze, saveAnalysis, loadHistory, type AnalysisResult, type AnalysisRecord } from "./lib/analysis-engine";

// ⚸ AI Data Analyst — specialization: pattern detection + statistical analysis
// Future-proof: Jacky→Ollama→local, localStorage history, CSV/JSON/text input

export default function App() {
  const [input, setInput]       = useState("");
  const [result, setResult]     = useState<AnalysisResult | null>(null);
  const [loading, setLoading]   = useState(false);
  const [history, setHistory]   = useState<AnalysisRecord[]>(() => loadHistory());
  const [tab, setTab]           = useState<"analyze"|"history">("analyze");

  const handleAnalyze = useCallback(async () => {
    if (!input.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const r = await analyze(input.trim());
      setResult(r);
      const saved = saveAnalysis(input.trim(), r);
      setHistory(prev => [saved, ...prev].slice(0, 50));
    } catch { toast.error("Analysis failed"); }
    finally { setLoading(false); }
  }, [input]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { setInput(ev.target?.result as string || ""); };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen font-mono">
      <Toaster />
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground tracking-wide">AI Data Analyst</span>
          <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 border border-border rounded">⚸ analysis</span>
        </div>
        <span className="text-[10px] text-muted-foreground">offline · Ollama-ready · Jacky-ready</span>
      </header>

      <div className="flex border-b border-border">
        {(["analyze","history"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={\`px-4 py-2 text-xs uppercase tracking-widest transition-colors \${tab===t ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}\`}>
            {t === "history" ? \`History (\${history.length})\` : "Analyze"}
          </button>
        ))}
      </div>

      {tab === "analyze" && (
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground uppercase tracking-widest">Input — CSV, JSON, numbers, or text</span>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
                <Upload className="w-3 h-3" /> Upload file
                <input type="file" accept=".csv,.json,.txt" onChange={handleFile} className="hidden" />
              </label>
            </div>
            <textarea value={input} onChange={e => setInput(e.target.value)}
              placeholder={"Paste data here...\n\nExamples:\n  [12, 45, 23, 67, 34, 89, 12]\n  label,value\n  Jan,1200\n  Feb,1450\n  Mar,980"}
              rows={6}
              className="w-full bg-card border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none focus:ring-1 focus:ring-primary/30" />
          </div>

          <button onClick={handleAnalyze} disabled={!input.trim() || loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-sm">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</> : <><Activity className="w-4 h-4" /> Run Analysis</>}
          </button>

          <AnimatePresence>
            {result && (
              <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} className="space-y-4">
                {/* Summary */}
                <div className="bg-card border border-border rounded-lg p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Summary</p>
                  <p className="text-sm text-foreground">{result.summary}</p>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {Object.entries(result.stats).filter(([k]) => k !== "count").map(([k,v]) => (
                    <div key={k} className="bg-card border border-border rounded-lg p-3 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase">{k}</p>
                      <p className="text-sm font-semibold text-foreground mt-1">{Number(v).toFixed(2)}</p>
                    </div>
                  ))}
                  <div className="bg-card border border-border rounded-lg p-3 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase">count</p>
                    <p className="text-sm font-semibold text-foreground mt-1">{result.stats.count}</p>
                  </div>
                </div>

                {/* Chart */}
                {result.chartData.length > 0 && (
                  <div className="bg-card border border-border rounded-lg p-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-3">Distribution</p>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={result.chartData} margin={{top:4,right:4,bottom:20,left:4}}>
                        <XAxis dataKey="label" tick={{fontSize:9,fill:"hsl(var(--muted-foreground))"}} angle={-30} textAnchor="end" interval={0} />
                        <YAxis tick={{fontSize:9,fill:"hsl(var(--muted-foreground))"}} />
                        <Tooltip contentStyle={{background:"hsl(var(--card))",border:"1px solid hsl(var(--border))",fontSize:11}} />
                        <ReferenceLine y={result.stats.mean} stroke="hsl(var(--primary))" strokeDasharray="3 3" label={{value:"mean",position:"right",fontSize:9,fill:"hsl(var(--primary))"}} />
                        <Bar dataKey="value" fill="hsl(var(--primary))" radius={[3,3,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Patterns, Anomalies, Insights */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {[
                    { icon: TrendingUp, label:"Patterns", items: result.patterns, color:"text-primary" },
                    { icon: AlertTriangle, label:"Anomalies", items: result.anomalies, color:"text-destructive" },
                    { icon: Lightbulb, label:"Insights", items: result.insights, color:"text-muted-foreground" },
                  ].map(({ icon: Icon, label, items, color }) => (
                    <div key={label} className="bg-card border border-border rounded-lg p-4">
                      <div className={\`flex items-center gap-1.5 mb-2 \${color}\`}>
                        <Icon className="w-3.5 h-3.5" />
                        <span className="text-xs font-semibold uppercase tracking-widest">{label}</span>
                      </div>
                      <ul className="space-y-1.5">
                        {items.map((item, i) => <li key={i} className="text-xs text-muted-foreground leading-relaxed">{item}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>

                {/* Recommendation */}
                <div className="bg-card border border-primary/20 rounded-lg p-4">
                  <p className="text-xs text-primary uppercase tracking-widest mb-1">Recommendation</p>
                  <p className="text-sm text-foreground">{result.recommendation}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {tab === "history" && (
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-3">
          {history.length === 0 && (
            <div className="text-center py-16 text-muted-foreground text-sm">No analysis history yet.</div>
          )}
          {history.map(rec => (
            <div key={rec.id} className="bg-card border border-border rounded-lg p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />{new Date(rec.timestamp).toLocaleString()}
                </span>
                <span className="text-xs text-muted-foreground">{rec.result.stats.count} values</span>
              </div>
              <p className="text-sm text-foreground">{rec.result.summary}</p>
              <p className="text-xs text-muted-foreground italic">{rec.result.recommendation}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
