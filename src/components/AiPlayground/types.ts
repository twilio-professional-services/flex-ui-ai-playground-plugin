export type OutputFormat = 'CLASSIFICATION' | 'TEXT' | 'JSON';

export interface OperatorResult {
  operatorSid?: string;
  displayName?: string;
  outputFormat?: OutputFormat;
  result?: {
    label?: string;
    text?: string;
    response?: string;
    summary?: string;
    observations?: string[];
    [key: string]: any;
  };
  timestamp?: string;
  [key: string]: any;
}

export interface OperatorSyncObject {
  type: 'list';
  items?: OperatorResult[];
}
