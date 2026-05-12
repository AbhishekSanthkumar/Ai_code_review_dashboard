import { useState } from "react"
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query"
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts"
import axios from "axios"

const API = "https://ai-code-review-production-ec4d.up.railway.app"
const queryClient = new QueryClient()

// ── API calls ─────────────────────────────────────────────

const fetchRepos  = () => axios.get(`${API}/api/repos`).then(r => r.data)
const fetchMetrics = (repo) => axios.get(`${API}/api/metrics?repo=${encodeURIComponent(repo)}`).then(r => r.data)
const fetchReviews = (repo) => axios.get(`${API}/api/reviews?repo=${encodeURIComponent(repo)}`).then(r => r.data)
const fetchComments = (repo, pr_number) => axios.get(`${API}/api/comments?repo=${encodeURIComponent(repo)}&pr_number=${pr_number}`).then(r => r.data)

// ── Score color helper ────────────────────────────────────

function scoreColor(score) {
  if (score >= 80) return "text-emerald-400"
  if (score >= 50) return "text-amber-400"
  return "text-red-400"
}

function scoreBg(score) {
  if (score >= 80) return "bg-emerald-400/10 border-emerald-400/20"
  if (score >= 50) return "bg-amber-400/10 border-amber-400/20"
  return "bg-red-400/10 border-red-400/20"
}

// ── Components ────────────────────────────────────────────

function StatCard({ label, value, sub, color }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-3xl font-semibold ${color || "text-white"}`}>{value}</p>
      {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
    </div>
  )
}

function SectionTitle({ children }) {
  return <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-widest mb-4">{children}</h2>
}

function PRComments({ repo, prNumber, prTitle, onClose }) {
  const { data, isLoading } = useQuery({
    queryKey: ["comments", repo, prNumber],
    queryFn: () => fetchComments(repo, prNumber),
  })

  const icons = { critical: "🔴", warning: "🟡", suggestion: "🔵" }
  const comments = data?.comments || []
  const critical   = comments.filter(c => c.severity === "critical")
  const warnings   = comments.filter(c => c.severity === "warning")
  const suggestions= comments.filter(c => c.severity === "suggestion")

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center p-6 overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-3xl">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <div>
            <p className="text-xs text-zinc-500 mb-1">PR #{prNumber}</p>
            <h2 className="text-white font-medium text-lg">{prTitle}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition-colors text-2xl leading-none"
          >×</button>
        </div>

        {/* Body */}
        <div className="p-6">
          {isLoading ? (
            <p className="text-zinc-500 animate-pulse text-sm">Loading comments...</p>
          ) : comments.length === 0 ? (
            <p className="text-zinc-500 text-sm">No comments found for this PR.</p>
          ) : (
            <div className="space-y-6">

              {/* Summary pills */}
              <div className="flex gap-3">
                <span className="text-xs bg-red-400/10 text-red-400 border border-red-400/20 px-3 py-1 rounded-full">
                  🔴 {critical.length} critical
                </span>
                <span className="text-xs bg-amber-400/10 text-amber-400 border border-amber-400/20 px-3 py-1 rounded-full">
                  🟡 {warnings.length} warnings
                </span>
                <span className="text-xs bg-blue-400/10 text-blue-400 border border-blue-400/20 px-3 py-1 rounded-full">
                  🔵 {suggestions.length} suggestions
                </span>
              </div>

              {/* Comments grouped by severity */}
              {[
                { label: "Critical Issues", items: critical, color: "border-red-400/30 bg-red-400/5" },
                { label: "Warnings",        items: warnings, color: "border-amber-400/30 bg-amber-400/5" },
                { label: "Suggestions",     items: suggestions, color: "border-blue-400/30 bg-blue-400/5" },
              ].map(({ label, items, color }) =>
                items.length > 0 && (
                  <div key={label}>
                    <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3">{label}</p>
                    <div className="space-y-3">
                      {items.map((c, i) => (
                        <div key={i} className={`border rounded-xl p-4 ${color}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-mono text-xs text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">
                              {c.filename}
                            </span>
                            {c.line && (
                              <span className="text-xs text-zinc-600">line {c.line}</span>
                            )}
                          </div>
                          <p className="text-sm text-zinc-300 leading-relaxed">{c.body}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Dashboard({ repo }) {
  const { data: metrics, isLoading: mLoading } = useQuery({ queryKey: ["metrics", repo], queryFn: () => fetchMetrics(repo) })
  const { data: reviewsData, isLoading: rLoading } = useQuery({ queryKey: ["reviews", repo], queryFn: () => fetchReviews(repo) })

  if (mLoading || rLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-500 text-sm animate-pulse">Loading metrics...</div>
      </div>
    )
  }

  const reviews = reviewsData?.reviews || []
  const trend   = [...(metrics?.trend || [])].reverse()

  return (
    <div className="space-y-8">

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Avg Score"
          value={metrics.avg_score}
          sub="out of 100"
          color={scoreColor(metrics.avg_score)}
        />
        <StatCard
          label="PRs Reviewed"
          value={metrics.total_reviews}
          sub="total"
        />
        <StatCard
          label="Critical Issues"
          value={metrics.total_critical}
          sub="across all PRs"
          color="text-red-400"
        />
        <StatCard
          label="Warnings"
          value={metrics.total_warnings}
          sub="across all PRs"
          color="text-amber-400"
        />
      </div>

      {/* Score trend chart */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <SectionTitle>Code quality score — last 30 days</SectionTitle>
        {trend.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="day" tick={{ fill: "#71717a", fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fill: "#71717a", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }}
                labelStyle={{ color: "#a1a1aa" }}
                itemStyle={{ color: "#34d399" }}
              />
              <Line
                type="monotone" dataKey="score"
                stroke="#34d399" strokeWidth={2}
                dot={{ fill: "#34d399", r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-zinc-600 text-sm">Not enough data yet — open more PRs to see trends.</p>
        )}
      </div>

      {/* Two column — top files + authors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Top problematic files */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <SectionTitle>Most critical files</SectionTitle>
          {metrics.top_files.length > 0 ? (
            <div className="space-y-3">
              {metrics.top_files.map((f, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm text-zinc-300 font-mono truncate max-w-[70%]">{f.file}</span>
                  <span className="text-xs bg-red-400/10 text-red-400 border border-red-400/20 px-2 py-0.5 rounded-full">
                    {f.critical_count} critical
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-zinc-600 text-sm">No critical issues found.</p>
          )}
        </div>

        {/* Author leaderboard */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <SectionTitle>Author scores</SectionTitle>
          {metrics.authors.length > 0 ? (
            <div className="space-y-3">
              {metrics.authors.map((a, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-zinc-300">{a.author}</p>
                    <p className="text-xs text-zinc-600">{a.prs} PR{a.prs !== 1 ? "s" : ""}</p>
                  </div>
                  <span className={`text-xs border px-2 py-0.5 rounded-full font-medium ${scoreBg(a.avg_score)} ${scoreColor(a.avg_score)}`}>
                    {a.avg_score}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-zinc-600 text-sm">No author data yet.</p>
          )}
        </div>
      </div>

      {/* PR history table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <SectionTitle>PR review history</SectionTitle>
        {reviews.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-zinc-500 uppercase tracking-widest border-b border-zinc-800">
                  <th className="text-left pb-3 pr-4">PR</th>
                  <th className="text-left pb-3 pr-4">Title</th>
                  <th className="text-left pb-3 pr-4">Author</th>
                  <th className="text-left pb-3 pr-4">Score</th>
                  <th className="text-left pb-3 pr-4">Issues</th>
                  <th className="text-left pb-3">Reviewed</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((r) => (
                  <tr key={r.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3 pr-4 text-zinc-400 font-mono">#{r.pr_number}</td>
                    <td className="py-3 pr-4 text-zinc-300 max-w-[200px] truncate">{r.pr_title}</td>
                    <td className="py-3 pr-4 text-zinc-400">{r.author}</td>
                    <td className="py-3 pr-4">
                      <span className={`font-medium ${scoreColor(r.score)}`}>{r.score}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="text-red-400 text-xs">🔴 {r.critical}</span>
                      <span className="text-amber-400 text-xs ml-2">🟡 {r.warnings}</span>
                    </td>
                    <td className="py-3 text-zinc-500 text-xs">{r.reviewed_at.split("T")[0]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-zinc-600 text-sm">No reviews yet.</p>
        )}
      </div>

    </div>
  )
}

// ── Main App ──────────────────────────────────────────────

function App() {
  const { data, isLoading } = useQuery({ queryKey: ["repos"], queryFn: fetchRepos })
  const repos = data?.repos || []
  const [selected, setSelected] = useState(null)
  const repo = selected || repos[0] || null

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-zinc-950 text-white">

        {/* Header */}
        <div className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-sm">🤖</div>
            <span className="font-medium text-white">AI Code Review</span>
            <span className="text-zinc-600 text-sm">Dashboard</span>
          </div>
          {repos.length > 0 && (
            <select
              value={repo || ""}
              onChange={e => setSelected(e.target.value)}
              className="bg-zinc-900 border border-zinc-700 text-zinc-300 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-violet-500"
            >
              {repos.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          )}
        </div>

        {/* Content */}
        <div className="max-w-6xl mx-auto px-6 py-8">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-zinc-500 animate-pulse">Connecting to API...</p>
            </div>
          ) : repos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <p className="text-zinc-400">No repos reviewed yet.</p>
              <p className="text-zinc-600 text-sm">Open a pull request to see metrics here.</p>
            </div>
          ) : repo ? (
            <>
              <div className="mb-6">
                <h1 className="text-xl font-medium text-white">{repo}</h1>
                <p className="text-zinc-500 text-sm mt-0.5">Code quality metrics</p>
              </div>
              <Dashboard repo={repo} />
            </>
          ) : null}
        </div>
      </div>
    </QueryClientProvider>
  )
}

export default function Root() {
  return (
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  )
}
