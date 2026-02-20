// Memora (Customer Memory) API types
// Based on memory.twilio.com/v1 OpenAPI spec

// --- Shared pagination ---

export interface PaginationMeta {
  pageSize: number;
  nextToken?: string | null;
  previousToken?: string | null;
}

// --- Observations ---

export interface MemoraObservation {
  id: string;
  content: string;
  source?: string;
  occurredAt?: string;
  createdAt: string;
  updatedAt: string;
  conversationIds?: string[];
}

export interface ObservationsResponse {
  observations: MemoraObservation[];
  meta: PaginationMeta;
}

// --- Conversation Summaries ---

export interface MemoraSummary {
  id: string;
  conversationId: string;
  content: string;
  source?: string;
  occurredAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationSummariesResponse {
  summaries: MemoraSummary[];
  meta: PaginationMeta;
}

// --- Traits ---

export interface MemoraTrait {
  name: string;
  value: string | number | boolean | (string | number | boolean)[];
  traitGroup: string;
  timestamp?: string;
}

export interface TraitsResponse {
  traits: MemoraTrait[];
  meta: PaginationMeta;
}

// --- Recall (semantic search) ---

export interface RecallObservation extends MemoraObservation {
  score?: number | null;
}

export interface RecallSummary extends MemoraSummary {
  score?: number | null;
}

export interface RecallMeta {
  queryTime: number;
}

export interface RecallResponse {
  observations: RecallObservation[];
  summaries: RecallSummary[];
  meta: RecallMeta;
}

export interface RecallParams {
  query?: string;
  observationsLimit?: number;
  summariesLimit?: number;
}

// --- Profile Lookup ---

export interface LookupResponse {
  normalizedValue: string;
  profiles: string[];
}
