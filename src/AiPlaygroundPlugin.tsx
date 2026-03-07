import React from 'react';
import * as Flex from '@twilio/flex-ui';
import { FlexPlugin } from '@twilio/flex-plugin';
import { combineReducers } from 'redux';
import { TaskHelper } from '@twilio/flex-ui';
import SyncToReduxService from './utils/sync-to-redux/SyncToReduxService';
import { reducerHook } from './utils/sync-to-redux/state/syncToReduxSlice';
import { initPaste } from './initPaste';
import { initCallSyncTracking } from './initCallSyncTracking';
import RealTimeTranscriptionTab from './components/RealTimeTranscription';
import { AiPlaygroundPanel } from './components/AiPlayground';
import SupervisorCallTracker from './components/Supervisor/SupervisorCallTracker';
import SupervisorOperatorResultsTab from './components/Supervisor/SupervisorOperatorResultsTab';

const PLUGIN_NAME = 'AiPlaygroundPlugin';

export default class AiPlaygroundPlugin extends FlexPlugin {
  constructor() {
    super(PLUGIN_NAME);
  }

  async init(flex: typeof Flex, manager: Flex.Manager): Promise<void> {
    initPaste(flex);

    // Register Redux reducer
    const reduxNamespace = 'ai-playground';
    const reducers = reducerHook();

    if (manager.store && manager.store.addReducer) {
      manager.store.addReducer(reduxNamespace, combineReducers(reducers));
    } else {
      console.error('[AiPlaygroundPlugin] Unable to register Redux reducer');
    }

    // Initialize SyncToRedux service
    try {
      await SyncToReduxService.initialize(reduxNamespace);
      console.log('[AiPlaygroundPlugin] SyncToRedux service initialized successfully');
    } catch (error) {
      console.error('[AiPlaygroundPlugin] Failed to initialize SyncToRedux service:', error);
    }

    initCallSyncTracking(flex, manager);

    // Register supervisor call tracker in TeamsView
    flex.TeamsView.Content.add(
      <SupervisorCallTracker key="supervisor-call-tracker" />,
      {
        sortOrder: -999,
        align: 'start',
      }
    );

    // Register transcription tab for voice calls
    flex.TaskCanvasTabs.Content.add(
      <Flex.Tab
        key="realtime-transcription"
        uniqueName="realtime-transcription"
        label="RealTime Transcription"
      >
        <RealTimeTranscriptionTab />
      </Flex.Tab>,
      {
        sortOrder: 10,
        if: ({ task }: { task: Flex.ITask }) =>
          TaskHelper.isCallTask(task) && !!task.attributes?.call_sid,
      }
    );

    // Register transcription tab for supervisor view
    flex.Supervisor.TaskCanvasTabs.Content.add(
      <Flex.Tab
        key="supervisor-realtime-transcription"
        uniqueName="supervisor-realtime-transcription"
        label="RealTime Transcription"
      >
        <RealTimeTranscriptionTab />
      </Flex.Tab>,
      {
        sortOrder: 10,
        if: ({ task }: { task: Flex.ITask }) =>
          TaskHelper.isCallTask(task) && !!task.attributes?.call_sid,
      }
    );

    // Register operator results tab for supervisor view
    flex.Supervisor.TaskCanvasTabs.Content.add(
      <Flex.Tab
        key="supervisor-operator-results"
        uniqueName="supervisor-operator-results"
        label="Operator Results"
      >
        <SupervisorOperatorResultsTab />
      </Flex.Tab>,
      {
        sortOrder: 20,
        if: ({ task }: { task: Flex.ITask }) =>
          TaskHelper.isCallTask(task) && !!task.attributes?.call_sid,
      }
    );

    // Register Panel 2 for AI Playground
    flex.AgentDesktopView.Panel2.Content.add(
      <AiPlaygroundPanel key="ai-playground-panel" />,
      {
        sortOrder: -1,
        if: ({ tasks, selectedTaskSid }: { tasks: Map<string, Flex.ITask>; selectedTaskSid: string }) => {
          if (!selectedTaskSid) return false;
          const task = tasks.get(selectedTaskSid);
          return !!task && TaskHelper.isCallTask(task) && !!task.attributes?.call_sid;
        },
      }
    );
  }
}
