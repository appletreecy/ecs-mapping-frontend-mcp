import { useMemo, useState } from "react";
import { api, toPath } from "../lib/api";
import type {
    BatchInputItem,
    MapBatchResponse,
    MapBatchResultItem,
} from "../types";

/** Extract dot-notated field paths (depth ≤ 2) without using `any`. */
function extractFieldPaths(
    obj: Record<string, unknown> | unknown,
    prefix = "",
    depth = 0,
    maxDepth = 2,
    out: Set<string> = new Set<string>()
): Set<string> {
    if (typeof obj !== "object" || obj === null || depth > maxDepth) return out;

    const rec = obj as Record<string, unknown>;
    for (const key of Object.keys(rec)) {
        const path = prefix ? `${prefix}.${key}` : key;
        const val = rec[key];

        if (typeof val === "object" && val !== null) {
            out.add(path); // include container field too
            extractFieldPaths(val as Record<string, unknown>, path, depth + 1, maxDepth, out);
        } else {
            out.add(path);
        }
    }
    return out;
}

/** Get a nested value via "a.b.c" path without using `any`. */
function getByPath(
    obj: Record<string, unknown> | null | undefined,
    path: string
): unknown {
    if (!obj) return undefined;
    return path.split(".").reduce<unknown>((acc, key) => {
        if (typeof acc === "object" && acc !== null && key in (acc as Record<string, unknown>)) {
            return (acc as Record<string, unknown>)[key];
        }
        return undefined;
    }, obj);
}

export default function MapFromJsonPage() {
    const [text, setText] = useState("");
    const [sourcetype, setSourcetype] = useState("pan_traffic");
    const [model, setModel] = useState("gpt-4o-mini");
    const [limit, setLimit] = useState(5);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [results, setResults] = useState<MapBatchResultItem[]>([]);
    const [showPayload, setShowPayload] = useState(false);

    /** Build payload to send to /map-batch */
    function buildBatchPayload(silent = false): BatchInputItem[] | null {
        // NEW: if input is empty/whitespace, treat as "no payload yet" without error
        if (!text || text.trim() === "") return null;

        let parsed: unknown;
        try {
            parsed = JSON.parse(text);
        } catch {
            if (!silent) {
                setError("Invalid JSON. Please paste a valid JSON object or array.");
            }
            return null;
        }

        const arr: Array<Record<string, unknown>> = Array.isArray(parsed)
            ? (parsed.filter((x) => typeof x === "object" && x !== null) as Array<Record<string, unknown>>)
            : typeof parsed === "object" && parsed !== null
                ? [parsed as Record<string, unknown>]
                : [];

        if (!arr.length) {
            if (!silent) setError("JSON must be an object or an array of objects.");
            return null;
        }

        const fields = new Set<string>();
        for (const ev of arr) extractFieldPaths(ev, "", 0, 2, fields);

        const first = arr[0] ?? {};
        const payload: BatchInputItem[] = Array.from(fields).map((f) => {
            const v = getByPath(first, f);
            const description =
                v !== undefined && v !== null && typeof v !== "object"
                    ? `sample value: ${String(v)}`
                    : `field ${f}`;
            return { sourcetype, field: f, description };
        });
        return payload;
    }

    async function handleMap() {
        setError(null);
        setResults([]);
        const payload = buildBatchPayload(false); // show errors for real submit
        if (!payload) return;

        setLoading(true);
        try {
            const qs = new URLSearchParams({ limit: String(limit), model });
            const url = toPath(`/map-batch?${qs.toString()}`);
            const { data } = await api.post<MapBatchResponse>(url, payload);
            const arr = Array.isArray(data?.results) ? data.results : [];
            setResults(arr);
        } catch (e: unknown) {
            const err = e as { response?: { data?: { detail?: string; message?: string } } };
            setError(err?.response?.data?.detail || err?.response?.data?.message || "Mapping failed. Check backend logs.");
        } finally {
            setLoading(false);
        }
    }

    function downloadJSON() {
        const blob = new Blob([JSON.stringify({ results }, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "ecs-mappings-batch.json";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(a.href);
    }

    const payloadPreview = useMemo(() => {
        const p = buildBatchPayload(true); // NEW: silent mode for preview
        return p ? JSON.stringify(p, null, 2) : "";
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [text, sourcetype, model, limit]);

    return (
        <div className="space-y-4">
            <h1 className="text-xl font-semibold">Map from JSON (batch via /map-batch)</h1>
            <p className="text-sm text-gray-600">
                Paste JSON event(s). We’ll extract unique fields and call <code>/map-batch</code> with
                <code> limit</code> and <code>model</code>.
            </p>

            {/* Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                    <label className="block text-xs text-gray-600 mb-1">Sourcetype</label>
                    <input
                        className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                        value={sourcetype}
                        onChange={(e) => setSourcetype(e.target.value)}
                        placeholder="pan_traffic"
                    />
                </div>
                <div>
                    <label className="block text-xs text-gray-600 mb-1">Model</label>
                    <select
                        className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                    >
                        <option value="gpt-4o-mini">gpt-4o-mini</option>
                        <option value="gpt-4o">gpt-4o</option>
                        <option value="o4-mini">o4-mini</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs text-gray-600 mb-1">Limit</label>
                    <input
                        type="number"
                        min={1}
                        className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                        value={limit}
                        onChange={(e) =>
                            setLimit(Number.isNaN(Number(e.target.value)) ? 5 : parseInt(e.target.value, 10))
                        }
                    />
                </div>
            </div>

            {/* JSON input */}
            <textarea
                className="w-full h-120 p-3 border rounded-md bg-white font-mono text-sm"
                placeholder='{"message":"allowed","department_phone_number":"02-9000-0000","department_abn":"12 345 678 901"}'
                value={text}
                onChange={(e) => setText(e.target.value)}
            />

            <div className="flex items-center gap-3">
                <button
                    onClick={handleMap}
                    disabled={loading}
                    className="px-4 py-2 rounded-md bg-gradient-to-r from-blue-600 to-indigo-600
           text-white font-medium shadow-md hover:from-blue-700 hover:to-indigo-700
           focus:ring-2 focus:ring-blue-500 focus:outline-none transition disabled:opacity-60"
                >
                    {loading ? "Mapping..." : "Send to /map-batch"}
                </button>
                <button
                    onClick={() => setShowPayload((s) => !s)}
                    className="px-3 py-2 text-sm rounded-md border bg-white hover:bg-gray-50"
                >
                    {showPayload ? "Hide payload" : "Preview payload"}
                </button>
                {error && <div className="text-red-600 text-sm">{error}</div>}
            </div>

            {/* Payload preview */}
            {showPayload && (
                <pre className="text-xs p-3 border rounded-md bg-white overflow-auto max-h-56">
{payloadPreview}
        </pre>
            )}

            {/* Results table */}
            {results.length > 0 && (
                <div className="mt-4">
                    <h2 className="font-medium mb-2">Results</h2>
                    <div className="overflow-x-auto border rounded-md bg-white">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b">
                            <tr className="text-left">
                                <th className="px-3 py-2">Field</th>
                                <th className="px-3 py-2">Mapped Field</th>
                                <th className="px-3 py-2">Type</th>
                                <th className="px-3 py-2">Confidence</th>
                                <th className="px-3 py-2">ECS Ver</th>
                                <th className="px-3 py-2">Rationale</th>
                                <th className="px-3 py-2">DB</th>
                                <th className="px-3 py-2">Sourcetype</th>
                            </tr>
                            </thead>
                            <tbody>
                            {results.map((r, i) => (
                                <tr key={i} className="border-b last:border-0">
                                    <td className="px-3 py-2 font-mono">{r.query.field}</td>
                                    <td className="px-3 py-2 font-mono">{r.llm_decision.mapped_field_name}</td>
                                    <td className="px-3 py-2">{r.llm_decision.mapping_type}</td>
                                    <td className="px-3 py-2">{r.llm_decision.confidence.toFixed(2)}</td>
                                    <td className="px-3 py-2">{r.llm_decision.ecs_version}</td>
                                    <td className="px-3 py-2">{r.llm_decision.rationale}</td>
                                    <td className="px-3 py-2">{r.db_status}</td>
                                    <td className="px-3 py-2">{r.query.sourcetype}</td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-3 flex items-center gap-3">
                        <button
                            onClick={downloadJSON}
                            className="px-3 py-2 text-sm rounded-md border bg-white hover:bg-gray-50"
                        >
                            Download JSON
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
