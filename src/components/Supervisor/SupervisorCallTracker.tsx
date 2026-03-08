import { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { ITask, TaskHelper } from '@twilio/flex-ui';
import SyncToReduxService from '../../utils/sync-to-redux/SyncToReduxService';
import { SupervisorWorkerState } from './types';
import { AppReduxState } from '../../types/reduxTypes';
import { getMapName } from '../../utils/syncMapHelpers';

const SupervisorCallTracker: React.FC = () => {
  // Track which call SIDs this component subscribed to (for cleanup)
  const subscribedCallSidsRef = useRef<Set<string>>(new Set());
  const isMountedRef = useRef<boolean>(false);

  // Monitor supervisor workers from Redux
  const supervisorWorkers = useSelector((state: AppReduxState) => {
    return state.flex?.supervisor?.workers as SupervisorWorkerState[] | undefined;
  });

  // Monitor our own worker tasks (if we're also an agent)
  const workerTasks = useSelector((state: AppReduxState) => {
    return state.flex?.worker?.tasks as Map<string, ITask> | undefined;
  });

  // Log on mount
  useEffect(() => {
    console.log('[SupervisorCallTracker] Mounted');
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // Build a set of call sids from our own worker tasks
    const ourCallSids = new Set<string>();
    if (workerTasks instanceof Map) {
      workerTasks.forEach((task: ITask) => {
        if (TaskHelper.isCallTask(task)) {
          const callSid = task.attributes?.call_sid;
          if (callSid) {
            ourCallSids.add(callSid);
          }
        }
      });
    }

    // Extract all call SIDs from supervisor workers' tasks
    const currentCallSids = new Set<string>();

    if (supervisorWorkers && Array.isArray(supervisorWorkers)) {
      for (const workerState of supervisorWorkers) {
        if (workerState.tasks && Array.isArray(workerState.tasks)) {
          for (const task of workerState.tasks) {
            // Only process call tasks
            if (TaskHelper.isCallTask(task)) {
              const callSid = task.attributes?.call_sid;
              if (callSid) {
                if (ourCallSids.has(callSid)) {
                  // Skip our own tasks - log only once when first seen
                  console.log(`[SupervisorCallTracker] Ignoring own task: ${callSid}`);
                } else {
                  currentCallSids.add(callSid);
                }
              }
            }
          }
        }
      }
    }

    // Subscribe to new call SIDs that aren't already tracked
    Array.from(currentCallSids).forEach((callSid) => {
      const mapName = getMapName(callSid);

      // Skip if already tracked (by us or by agent task tracking)
      if (SyncToReduxService.isTracking(mapName)) {
        return;
      }

      // Skip if we already tried to subscribe
      if (subscribedCallSidsRef.current.has(callSid)) {
        return;
      }

      // Subscribe to the sync map
      SyncToReduxService.trackSync(mapName, 'metadata')
        .then(() => {
          console.log(`[SupervisorCallTracker] Tracking: ${callSid}`);
          subscribedCallSidsRef.current.add(callSid);
        })
        .catch((error) => {
          console.error(`[SupervisorCallTracker] Failed to track ${callSid}:`, error);
        });
    });

    // Unsubscribe from call SIDs no longer in supervisor view
    const callSidsToUnsubscribe = new Set<string>();
    Array.from(subscribedCallSidsRef.current).forEach((callSid) => {
      if (!currentCallSids.has(callSid)) {
        callSidsToUnsubscribe.add(callSid);
      }
    });

    Array.from(callSidsToUnsubscribe).forEach((callSid) => {
      const mapName = getMapName(callSid);

      // Don't unsubscribe if it's now one of our own tasks
      if (ourCallSids.has(callSid)) {
        console.log(`[SupervisorCallTracker] Ignoring own task for cleanup: ${callSid}`);
        subscribedCallSidsRef.current.delete(callSid);
        return;
      }

      // Only unsubscribe if still tracked (might have been untracked by agent)
      if (SyncToReduxService.isTracking(mapName)) {
        SyncToReduxService.untrackSync(mapName)
          .then(() => {
            console.log(`[SupervisorCallTracker] Stopped tracking: ${callSid}`);
            subscribedCallSidsRef.current.delete(callSid);
          })
          .catch((error) => {
            console.error(`[SupervisorCallTracker] Failed to stop tracking ${callSid}:`, error);
            subscribedCallSidsRef.current.delete(callSid);
          });
      } else {
        subscribedCallSidsRef.current.delete(callSid);
      }
    });

  }, [supervisorWorkers, workerTasks]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('[SupervisorCallTracker] Unmounting');

      // Get current worker tasks at unmount time
      const currentWorkerTasks = workerTasks;
      const ourCallSidsAtUnmount = new Set<string>();

      if (currentWorkerTasks instanceof Map) {
        currentWorkerTasks.forEach((task: ITask) => {
          if (TaskHelper.isCallTask(task)) {
            const callSid = task.attributes?.call_sid;
            if (callSid) {
              ourCallSidsAtUnmount.add(callSid);
            }
          }
        });
      }

      const cleanupCount = subscribedCallSidsRef.current.size;
      let skippedCount = 0;

      Array.from(subscribedCallSidsRef.current).forEach((callSid) => {
        // Don't unsubscribe if it's one of our own tasks
        if (ourCallSidsAtUnmount.has(callSid)) {
          console.log(`[SupervisorCallTracker] Preserving tracking for own task: ${callSid}`);
          skippedCount++;
          return;
        }

        const mapName = getMapName(callSid);

        if (SyncToReduxService.isTracking(mapName)) {
          SyncToReduxService.untrackSync(mapName).catch((error) => {
            console.error(`[SupervisorCallTracker] Cleanup failed for ${callSid}:`, error);
          });
        }
      });

      if (cleanupCount > 0) {
        console.log(`[SupervisorCallTracker] Cleanup complete: ${cleanupCount - skippedCount} stopped, ${skippedCount} preserved`);
      }

      subscribedCallSidsRef.current.clear();
    };
  }, [workerTasks]);

  return null;
};

export default SupervisorCallTracker;
