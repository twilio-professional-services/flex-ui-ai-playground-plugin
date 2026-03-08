import { ITask } from '@twilio/flex-ui';

/**
 * State shape for a supervisor worker in Redux
 */
export interface SupervisorWorkerState {
  worker: WorkerInfo;
  tasks: ITask[];
}

/**
 * Worker information structure
 */
export interface WorkerInfo {
  workerId: string;
  workerSid: string;
  fullName: string;
  activityName?: string;
  activitySid?: string;
  attributes?: Record<string, unknown>;
  [key: string]: unknown;
}
