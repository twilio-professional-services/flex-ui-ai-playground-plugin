import * as Flex from '@twilio/flex-ui';
import { TaskHelper } from '@twilio/flex-ui';
import SyncToReduxService from './utils/sync-to-redux/SyncToReduxService';

function getMapName(callSid: string): string {
  return `ai-playground-${callSid}`;
}

function trackCallTask(task: Flex.ITask): void {
  if (!TaskHelper.isCallTask(task)) return;
  const callSid = task.attributes?.call_sid;
  if (!callSid) return;
  const mapName = getMapName(callSid);
  if (!SyncToReduxService.isTracking(mapName)) {
    SyncToReduxService.trackSync(mapName, 'metadata').catch((error) => {
      console.error(`[AiPlaygroundPlugin] Failed to track sync map "${mapName}":`, error);
    });
  }
}

function untrackCallTask(task: Flex.ITask): void {
  if (!TaskHelper.isCallTask(task)) return;
  const callSid = task.attributes?.call_sid;
  if (!callSid) return;
  const mapName = getMapName(callSid);
  if (SyncToReduxService.isTracking(mapName)) {
    SyncToReduxService.untrackSync(mapName).catch((error) => {
      console.error(`[AiPlaygroundPlugin] Failed to untrack sync map "${mapName}":`, error);
    });
  }
}

export function initCallSyncTracking(flex: typeof Flex, manager: Flex.Manager): void {
  // Start tracking the sync map when a call task is accepted
  flex.Actions.addListener('afterAcceptTask', (payload: { task: Flex.ITask }) => {
    trackCallTask(payload.task);
  });

  // Stop tracking when the task is completed or canceled
  flex.Actions.addListener('afterCompleteTask', (payload: { task: Flex.ITask }) => {
    untrackCallTask(payload.task);
  });

  flex.Actions.addListener('afterCancelTask', (payload: { task: Flex.ITask }) => {
    untrackCallTask(payload.task);
  });

  // Track sync maps for any call tasks already in state (e.g. plugin reload mid-call)
  const existingTasks = (manager.store.getState() as any).flex?.worker?.tasks;
  if (existingTasks instanceof Map) {
    existingTasks.forEach((task: Flex.ITask) => {
      trackCallTask(task);
    });
  }
}
