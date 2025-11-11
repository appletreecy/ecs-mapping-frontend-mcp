import { useEffect, useMemo, useState } from "react";
import { api, toPath } from "../lib/api";
import type { MappingRow } from "../types";

type ListResponse = { items: MappingRow[]; total: number };

// Extend the type locally if needed (non-breaking)
type Row = MappingRow & { human_verified?: boolean };

export default function MappingsListPage() {
    const [items, setItems] = useState<Row[]>([]);
    const [q, setQ] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize] = useState(20);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [notImplemented, setNotImplemented] = useState(false);

    const [savingId, setSavingId] = useState<number | null>(null);
    const [editId, setEditId] = useState<number | null>(null);
    const [editHuman, setEditHuman] = useState<boolean>(false);
    const [editMapped, setEditMapped] = useState<string>("");

    async function load() {
        setLoading(true);
        setNotImplemented(false);
        try {
            const url = toPath(`/mappings`);
            const { data } = await api.get<ListResponse>(url, {
                params: { search: q, page, pageSize },
            });
            setItems((data.items || []) as Row[]);
            setTotal(data.total || 0);
        } catch (e: unknown) {
            if (
                typeof e === "object" &&
                e !== null &&
                "response" in e &&
                (e as { response?: { status?: number } }).response?.status === 404
            ) {
                setNotImplemented(true);
            }
            console.error(e);
        } finally {
            setLoading(false);
        }
    }


    useEffect(() => { load(); /* eslint-disable-next-line */ }, [page, pageSize]);

    const filtered = useMemo(() => {
        if (!q) return items;
        const t = q.toLowerCase();
        return items.filter(r =>
            r.sourcetype.toLowerCase().includes(t) ||
            r.source_field.toLowerCase().includes(t) ||
            r.mapped_field_name.toLowerCase().includes(t)
        );
    }, [q, items]);

    function exportCSV() {
        const header = [
            "id","sourcetype","source_field","mapped_field_name",
            "mapped_field_name_underscore","mapping_type","confidence","created_at",
            "human_verified"
        ];
        const rows = filtered.map(r => [
            r.id,
            r.sourcetype,
            r.source_field,
            r.mapped_field_name,
            r.mapped_field_name.replaceAll(".", "_"),
            r.mapping_type,
            r.confidence ?? "",
            r.created_at,
            (r.human_verified ? "true" : "false")
        ]);
        const csv = [header, ...rows]
            .map(cols => cols.map((v) => `"${String(v).replaceAll('"','""')}"`).join(","))
            .join("\n");

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "ecs-mappings.csv";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(a.href);
    }

    // Row edit handlers
    function startEdit(r: Row) {
        setEditId(r.id);
        setEditHuman(!!r.human_verified);
        setEditMapped(r.mapped_field_name || "");
    }
    function cancelEdit() {
        setEditId(null);
        setEditHuman(false);
        setEditMapped("");
    }
    async function saveEdit(id: number) {
        const nextName = editMapped.trim();
        if (!nextName) {
            alert("Mapped Field cannot be empty.");
            return;
        }
        try {
            setSavingId(id);
            await api.patch(toPath(`/mappings/${id}`), {
                human_verified: editHuman,
                mapped_field_name: nextName,
            });
            // reflect locally without a full reload
            setItems(prev => prev.map(it => it.id === id ? {
                ...it,
                human_verified: editHuman,
                mapped_field_name: nextName
            } : it));
            setEditId(null);
        } catch (e) {
            console.error(e);
            alert("Failed to update. See console for details.");
        } finally {
            setSavingId(null);
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold">Mappings List</h1>
                <div className="flex items-center gap-2">
                    <input
                        value={q}
                        onChange={(e)=>{ setQ(e.target.value); setPage(1); }}
                        placeholder="Search (sourcetype / source / mapped)"
                        className="border rounded-md px-3 py-2 text-sm bg-white w-80"
                    />
                    <button onClick={exportCSV} className="px-3 py-2 text-sm rounded-md border bg-white hover:bg-gray-50">
                        Export CSV
                    </button>
                    <button
                        onClick={load}
                        disabled={loading}
                        className="px-3 py-2 text-sm rounded-md bg-blue-600 text-white disabled:opacity-60"
                    >
                        {loading ? "Loading..." : "Refresh"}
                    </button>
                </div>
            </div>

            {notImplemented && (
                <div className="p-3 border rounded-md bg-amber-50 text-amber-800 text-sm">
                    The backend doesn’t expose <code>/mappings</code> yet. Add a FastAPI route that SELECTs from
                    <code> field_mapping</code> and returns <code>{`{ items, total }`}</code> to enable this page.
                </div>
            )}

            <div className="overflow-x-auto border rounded-md bg-white">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                    <tr className="text-left">
                        <th className="px-3 py-2">ID</th>
                        <th className="px-3 py-2">Sourcetype</th>
                        <th className="px-3 py-2">Source Field</th>
                        <th className="px-3 py-2">Mapped Field</th>
                        <th className="px-3 py-2">Mapped Field (_)</th>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2">Confidence</th>
                        <th className="px-3 py-2">Human Verified</th>
                        <th className="px-3 py-2">Created</th>
                        <th className="px-3 py-2">Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                    {filtered.map((r) => {
                        const isEditing = editId === r.id;
                        return (
                            <tr key={r.id} className={`border-b last:border-0 ${isEditing ? "bg-green-50" : ""}`}>
                                <td className="px-3 py-2">{r.id}</td>
                                <td className="px-3 py-2">{r.sourcetype}</td>
                                <td className="px-3 py-2 font-mono">{r.source_field}</td>

                                {/* Mapped Field cell: input in edit mode */}
                                <td className="px-3 py-2 font-mono">
                                    {!isEditing ? (
                                        r.mapped_field_name
                                    ) : (
                                        <input
                                            value={editMapped}
                                            onChange={(e) => setEditMapped(e.target.value)}
                                            className="w-64 border rounded-md px-2 py-1 text-sm"
                                            placeholder="ecs.field or custom_prefix_xxx"
                                        />
                                    )}
                                </td>

                                <td className="px-3 py-2 font-mono">
                                    {(isEditing ? editMapped : r.mapped_field_name).replaceAll(".", "_")}
                                </td>

                                <td className="px-3 py-2">{r.mapping_type}</td>
                                <td className="px-3 py-2">{r.confidence ?? "-"}</td>

                                <td className="px-3 py-2">
                                    <label className="inline-flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            className="accent-blue-600 w-4 h-4"
                                            checked={isEditing ? editHuman : !!r.human_verified}
                                            onChange={(e) => isEditing && setEditHuman(e.target.checked)}
                                            disabled={!isEditing || savingId === r.id}
                                        />
                                    </label>
                                </td>

                                <td className="px-3 py-2">{new Date(r.created_at).toLocaleString()}</td>

                                <td className="px-3 py-2">
                                    {!isEditing ? (
                                        <button
                                            className="px-2 py-1 text-xs rounded-md border bg-white hover:bg-gray-50"
                                            onClick={() => startEdit(r)}
                                        >
                                            Edit
                                        </button>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <button
                                                className="px-3 py-1.5 text-sm font-semibold rounded-md text-white bg-green-600 border border-green-700 shadow hover:bg-green-700 hover:shadow-md transition disabled:opacity-60 !bg-green-600 !text-white"
                                                onClick={() => saveEdit(r.id)}
                                                disabled={savingId === r.id}
                                            >
                                                {savingId === r.id ? "Saving..." : "Save"}
                                            </button>
                                            <button
                                                className="px-2 py-1 text-xs rounded-md border bg-white hover:bg-gray-50"
                                                onClick={cancelEdit}
                                                disabled={savingId === r.id}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        )})}
                    {filtered.length === 0 && !loading && (
                        <tr>
                            <td className="px-3 py-8 text-center text-gray-500" colSpan={10}>
                                {notImplemented ? "Waiting for backend /mappings…" : "No records."}
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </div>

            <div className="flex items-center justify-end gap-3">
                <span className="text-sm text-gray-600">
                    Page {page} / {Math.max(1, Math.ceil(total / pageSize))} ({total} total)
                </span>
                <button
                    className="px-3 py-2 text-sm rounded-md border bg-white disabled:opacity-50"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                >
                    Prev
                </button>
                <button
                    className="px-3 py-2 text-sm rounded-md border bg-white disabled:opacity-50"
                    onClick={() => setPage(p => Math.min(Math.max(1, Math.ceil(total / pageSize)), p + 1))}
                    disabled={page === Math.max(1, Math.ceil(total / pageSize))}
                >
                    Next
                </button>
            </div>
        </div>
    );
}
