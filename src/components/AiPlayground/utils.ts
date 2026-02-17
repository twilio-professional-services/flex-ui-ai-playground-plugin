import { OperatorResult } from './types';

const REALTIME_PREFIX = 'OPERATOR-COMMUNICATION-';
const POST_CALL_PREFIX = 'OPERATOR-CONVERSATION_END-';

export function isRealtimeOperatorKey(key: string): boolean {
  return key.startsWith(REALTIME_PREFIX);
}

export function isPostCallOperatorKey(key: string): boolean {
  return key.startsWith(POST_CALL_PREFIX);
}

export function getRealtimeOperatorKeys(syncObjects: Record<string, any>): string[] {
  return Object.keys(syncObjects).filter(isRealtimeOperatorKey).sort();
}

export function getPostCallOperatorKeys(syncObjects: Record<string, any>): string[] {
  return Object.keys(syncObjects).filter(isPostCallOperatorKey).sort();
}

export function getOperatorDisplayName(key: string, items?: OperatorResult[]): string {
  if (items && items.length > 0) {
    const latest = items[items.length - 1];
    if (latest.displayName) {
      return latest.displayName;
    }
  }
  // Strip whichever prefix matches
  if (key.startsWith(REALTIME_PREFIX)) return key.replace(REALTIME_PREFIX, '');
  if (key.startsWith(POST_CALL_PREFIX)) return key.replace(POST_CALL_PREFIX, '');
  return key;
}

export function formatResultValue(result: OperatorResult): string {
  const outputFormat = result.outputFormat;
  const data = result.result;

  if (!data) {
    return JSON.stringify(result, null, 2);
  }

  if (outputFormat === 'CLASSIFICATION' && data.label) {
    return data.label;
  }

  if (outputFormat === 'TEXT' && data.text) {
    return data.text;
  }

  // JSON or unknown format: check known fields, then fall back
  if (data.response) return data.response;
  if (data.summary) return data.summary;
  if (data.text) return data.text;
  if (data.label) return data.label;
  if (data.observations && Array.isArray(data.observations)) {
    return data.observations
      .map((o: any) => {
        if (typeof o === 'string') return o;
        if (o && typeof o === 'object' && o.content) return o.content;
        return JSON.stringify(o, null, 2);
      })
      .join('\n');
  }

  return JSON.stringify(data, null, 2);
}
