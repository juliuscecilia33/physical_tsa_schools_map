"use client";

import { useState, useCallback } from "react";

const PARAMS = [
  { name: "page", type: "integer", default: "1", description: "Page number for pagination" },
  { name: "limit", type: "integer", default: "50", description: "Results per page (max 200)" },
  { name: "serp_scraped", type: "boolean", default: "true", description: "Filter by SERP scrape status" },
  { name: "sport", type: "string", default: "—", description: "Filter by sport (matches against identified_sports array)" },
  { name: "q", type: "string", default: "—", description: "Search facility name (case-insensitive partial match)" },
  { name: "sort", type: "string", default: "name", description: "Sort field: name, rating, or created_at" },
  { name: "order", type: "string", default: "asc", description: "Sort order: asc or desc" },
];

const EXAMPLE_LIST_RESPONSE = `{
  "data": [
    {
      "id": "a1b2c3d4-...",
      "place_id": "ChIJ...",
      "name": "Riverside Sports Complex",
      "sport_types": ["basketball_court", "tennis_court"],
      "identified_sports": ["basketball", "tennis"],
      "address": "123 Main St, Anytown, USA",
      "location": { "lat": 34.0522, "lng": -118.2437 },
      "phone": "(555) 123-4567",
      "website": "https://example.com",
      "rating": 4.5,
      "user_ratings_total": 128,
      "photo_references": ["CmRa..."],
      "additional_photos": [{ "url": "...", "source": "serp" }],
      "additional_reviews": [{ "author": "...", "text": "..." }],
      "opening_hours": { "weekday_text": ["Monday: 6AM–10PM", "..."] },
      "business_status": "OPERATIONAL",
      "serp_scraped": true,
      "serp_scraped_at": "2025-12-01T00:00:00.000Z",
      "total_photo_count": 12
    }
  ],
  "pagination": {
    "total": 1542,
    "page": 1,
    "limit": 50,
    "total_pages": 31,
    "has_next": true,
    "has_prev": false
  }
}`;

const EXAMPLE_DETAIL_RESPONSE = `{
  "data": {
    "id": "a1b2c3d4-...",
    "place_id": "ChIJ...",
    "name": "Riverside Sports Complex",
    "sport_types": ["basketball_court", "tennis_court"],
    "identified_sports": ["basketball", "tennis"],
    "sport_metadata": { "basketball": { "indoor": true } },
    "address": "123 Main St, Anytown, USA",
    "location": { "lat": 34.0522, "lng": -118.2437 },
    "phone": "(555) 123-4567",
    "website": "https://example.com",
    "email": ["info@example.com"],
    "email_scraped_at": "2025-12-01T00:00:00.000Z",
    "rating": 4.5,
    "user_ratings_total": 128,
    "reviews": [{ "author": "...", "text": "...", "rating": 5 }],
    "photo_references": ["CmRa..."],
    "additional_photos": [{ "url": "...", "source": "serp" }],
    "additional_reviews": [{ "author": "...", "text": "..." }],
    "opening_hours": { "weekday_text": ["Monday: 6AM–10PM"] },
    "business_status": "OPERATIONAL",
    "serp_scraped": true,
    "serp_scraped_at": "2025-12-01T00:00:00.000Z",
    "total_photo_count": 12
  }
}`;

const EXAMPLE_ERROR_RESPONSE = `{
  "error": {
    "code": "NOT_FOUND",
    "message": "Facility not found"
  }
}`;

function StatusBadge({ status }: { status: number | null }) {
  if (status === null) return null;
  const color =
    status >= 200 && status < 300
      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
      : "bg-red-500/20 text-red-400 border-red-500/30";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono border ${color}`}>
      {status}
    </span>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-gray-950 border border-gray-800 rounded-lg p-4 overflow-x-auto text-sm text-gray-300 leading-relaxed">
      <code>{children}</code>
    </pre>
  );
}

function SectionCard({ title, method, path, children }: { title: string; method?: string; path?: string; children: React.ReactNode }) {
  return (
    <section className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-800 flex items-center gap-3">
        {method && (
          <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-md text-xs font-bold font-mono tracking-wide">
            {method}
          </span>
        )}
        {path && <code className="text-sm text-gray-300 font-mono">{path}</code>}
        {!method && <h2 className="text-lg font-semibold text-white">{title}</h2>}
      </div>
      <div className="p-6 space-y-6">{children}</div>
    </section>
  );
}

function TryItPanel({ endpoint, fields }: { endpoint: string; fields: { name: string; placeholder: string }[] }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [response, setResponse] = useState<string | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const buildUrl = useCallback(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    if (endpoint === "detail") {
      const id = values.id || "";
      return `${origin}/api/v1/facilities/${encodeURIComponent(id)}`;
    }
    const params = new URLSearchParams();
    for (const f of fields) {
      const v = values[f.name];
      if (v !== undefined && v !== "") {
        params.set(f.name, v);
      }
    }
    const qs = params.toString();
    return `${origin}/api/v1/facilities${qs ? `?${qs}` : ""}`;
  }, [values, endpoint, fields]);

  const send = useCallback(async () => {
    setLoading(true);
    setResponse(null);
    setStatus(null);

    const url = buildUrl();

    try {
      const res = await fetch(url);
      setStatus(res.status);
      const json = await res.json();
      setResponse(JSON.stringify(json, null, 2));
    } catch (err: any) {
      setStatus(0);
      setResponse(`Network error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [buildUrl]);

  const copyUrl = useCallback(async () => {
    await navigator.clipboard.writeText(buildUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [buildUrl]);

  const liveUrl = buildUrl();

  return (
    <div className="bg-gray-950/50 border border-gray-700 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-700 bg-gray-800/50">
        <h4 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
          Try It
        </h4>
      </div>
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {fields.map((f) => (
            <div key={f.name}>
              <label className="block text-xs font-mono text-gray-500 mb-1">{f.name}</label>
              <input
                type="text"
                placeholder={f.placeholder}
                value={values[f.name] || ""}
                onChange={(e) => setValues((prev) => ({ ...prev, [f.name]: e.target.value }))}
                className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-mono"
              />
            </div>
          ))}
        </div>

        <div>
          <p className="text-xs font-mono text-gray-500 mb-1">Request URL</p>
          <code className="text-xs text-blue-400 break-all">{liveUrl}</code>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={send}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2 rounded-md transition-colors"
          >
            {loading ? "Sending..." : "Send Request"}
          </button>
          <button
            onClick={copyUrl}
            className="bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm font-medium px-4 py-2 rounded-md transition-colors"
          >
            {copied ? "Copied!" : "Copy URL"}
          </button>
        </div>

        {response !== null && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-xs font-mono text-gray-500">Response</p>
              <StatusBadge status={status} />
            </div>
            <pre className="bg-gray-950 border border-gray-800 rounded-lg p-4 overflow-x-auto text-xs text-gray-300 leading-relaxed max-h-[500px] overflow-y-auto">
              <code>{response}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
        {/* Header */}
        <div className="space-y-3">
          <h1 className="text-3xl font-bold text-white tracking-tight">Facilities API</h1>
          <p className="text-gray-400 text-lg">Public REST API for querying sports facility data.</p>
          <div className="inline-flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-lg px-4 py-2">
            <span className="text-xs text-gray-500 uppercase tracking-wider font-medium">Base URL</span>
            <code className="text-sm text-blue-400 font-mono">/api/v1/facilities</code>
          </div>
        </div>

        {/* List Endpoint */}
        <SectionCard title="List Facilities" method="GET" path="/api/v1/facilities">
          <p className="text-gray-400">
            Returns a paginated list of sports facilities. Supports filtering by sport, search by name, and sorting.
          </p>

          {/* Parameter Table */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">Query Parameters</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left py-2 pr-4 text-gray-500 font-medium">Parameter</th>
                    <th className="text-left py-2 pr-4 text-gray-500 font-medium">Type</th>
                    <th className="text-left py-2 pr-4 text-gray-500 font-medium">Default</th>
                    <th className="text-left py-2 text-gray-500 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {PARAMS.map((p) => (
                    <tr key={p.name} className="border-b border-gray-800/50">
                      <td className="py-2.5 pr-4">
                        <code className="text-blue-400 text-xs font-mono bg-blue-500/10 px-1.5 py-0.5 rounded">{p.name}</code>
                      </td>
                      <td className="py-2.5 pr-4 text-gray-500 font-mono text-xs">{p.type}</td>
                      <td className="py-2.5 pr-4 font-mono text-xs text-gray-400">{p.default}</td>
                      <td className="py-2.5 text-gray-400 text-xs">{p.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Example Response */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">Example Response</h3>
            <CodeBlock>{EXAMPLE_LIST_RESPONSE}</CodeBlock>
          </div>

          {/* Try It */}
          <TryItPanel
            endpoint="list"
            fields={PARAMS.map((p) => ({
              name: p.name,
              placeholder: p.default === "—" ? "" : p.default,
            }))}
          />
        </SectionCard>

        {/* Detail Endpoint */}
        <SectionCard title="Get Facility" method="GET" path="/api/v1/facilities/{id}">
          <p className="text-gray-400">
            Returns a single facility by ID. Accepts either a <code className="text-blue-400 bg-blue-500/10 px-1 py-0.5 rounded text-xs">UUID</code> (internal
            ID) or a <code className="text-blue-400 bg-blue-500/10 px-1 py-0.5 rounded text-xs">place_id</code> (Google Places ID) — the API auto-detects the
            format.
          </p>
          <p className="text-gray-500 text-sm">
            The detail response includes additional fields not present in the list endpoint: <code className="text-gray-400">sport_metadata</code>,{" "}
            <code className="text-gray-400">email</code>, and <code className="text-gray-400">reviews</code>.
          </p>

          {/* Example Response */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">Example Response</h3>
            <CodeBlock>{EXAMPLE_DETAIL_RESPONSE}</CodeBlock>
          </div>

          {/* Try It */}
          <TryItPanel
            endpoint="detail"
            fields={[{ name: "id", placeholder: "UUID or place_id" }]}
          />
        </SectionCard>

        {/* Error Responses */}
        <SectionCard title="Error Responses">
          <p className="text-gray-400">
            All errors follow a consistent shape. The HTTP status code indicates the error category.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-2 pr-4 text-gray-500 font-medium">Status</th>
                  <th className="text-left py-2 pr-4 text-gray-500 font-medium">Code</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-800/50">
                  <td className="py-2.5 pr-4"><StatusBadge status={400} /></td>
                  <td className="py-2.5 pr-4 font-mono text-xs text-gray-400">BAD_REQUEST</td>
                  <td className="py-2.5 text-gray-400 text-xs">Missing or invalid request parameters</td>
                </tr>
                <tr className="border-b border-gray-800/50">
                  <td className="py-2.5 pr-4"><StatusBadge status={404} /></td>
                  <td className="py-2.5 pr-4 font-mono text-xs text-gray-400">NOT_FOUND</td>
                  <td className="py-2.5 text-gray-400 text-xs">Facility with the given ID does not exist</td>
                </tr>
                <tr className="border-b border-gray-800/50">
                  <td className="py-2.5 pr-4"><StatusBadge status={500} /></td>
                  <td className="py-2.5 pr-4 font-mono text-xs text-gray-400">INTERNAL_ERROR</td>
                  <td className="py-2.5 text-gray-400 text-xs">Unexpected server error</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">Error Shape</h3>
            <CodeBlock>{EXAMPLE_ERROR_RESPONSE}</CodeBlock>
          </div>
        </SectionCard>

        {/* Footer */}
        <div className="text-center text-xs text-gray-600 pt-4">
          Responses are cached for up to 5 minutes. Large list responses are gzip-compressed automatically.
        </div>
      </div>
    </div>
  );
}
