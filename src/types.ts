export type BatchInputItem = {
    sourcetype: string;
    field: string;
    description: string;
};

export type McpHint = {
    // unknown structure, keep flexible
    [k: string]: any;
};

export type LlmDecision = {
    mapping_type: "ecs" | "non-ecs";
    mapped_field_name: string;       // ecs.field or custom_prefix_*
    ecs_version: string;             // "8.10.0"
    rationale: string;
    confidence: number;              // 0..1
};

export type MapBatchResultItem = {
    query: {
        sourcetype: string;
        field: string;
        limit: number;
        model: string;
    };
    hints: McpHint[] | any;           // backend may return top/top5 – treat as any[]
    llm_decision: LlmDecision;
    db_status: "exists" | "inserted";
};

export type MapBatchResponse = {
    results: MapBatchResultItem[];
};

// For the “Mappings List” page (if/when your backend exposes /mappings):
export type MappingRow = {
    id: number;
    sourcetype: string;
    source_field: string;
    mapped_field_name: string; // <- matches your DB column
    mapping_type: "ecs" | "non-ecs";
    rationale: string | null;
    confidence: number | null;
    created_at: string; // ISO
};
