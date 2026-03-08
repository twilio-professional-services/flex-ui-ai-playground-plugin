import React from 'react';
import { ITask } from '@twilio/flex-ui';
import { Box } from '@twilio-paste/core/box';
import { Text } from '@twilio-paste/core/text';
import { Tabs, Tab, TabList, TabPanel, TabPanels, useTabState } from '@twilio-paste/core/tabs';
import { useTrackedMap } from '../../utils/sync-to-redux/hooks';
import { getRealtimeOperatorKeys, getOperatorDisplayName } from './utils';
import { OperatorResult } from './types';
import OperatorResultCard from './OperatorResultCard';
import { getMapName } from '../../utils/syncMapHelpers';

interface RealtimeOperatorsTabProps {
  task?: ITask;
}

const RealtimeOperatorsTab: React.FC<RealtimeOperatorsTabProps> = ({ task }) => {
  const callSid = task?.attributes?.call_sid;
  const mapName = callSid ? getMapName(callSid) : '';

  const trackedMap = useTrackedMap(mapName);
  const syncObjects = trackedMap?.syncObjects || {};
  const operatorKeys = getRealtimeOperatorKeys(syncObjects);

  const tabState = useTabState();

  if (!callSid) {
    return (
      <Box padding="space60">
        <Text as="p" color="colorTextWeak">No call SID available.</Text>
      </Box>
    );
  }

  if (operatorKeys.length === 0) {
    return (
      <Box padding="space60">
        <Text as="p" color="colorTextWeak">Waiting for operator results...</Text>
      </Box>
    );
  }

  return (
    <Box paddingTop="space40">
      <Tabs baseId="operator-tabs" state={tabState}>
        <TabList aria-label="Operator results" element="OPERATOR_TAB_LIST">
          {operatorKeys.map((key) => {
            const items: OperatorResult[] = syncObjects[key]?.items || [];
            return (
              <Tab key={key} element="OPERATOR_TAB">
                {getOperatorDisplayName(key, items)}
              </Tab>
            );
          })}
        </TabList>
        <TabPanels>
          {operatorKeys.map((key) => {
            const items: OperatorResult[] = syncObjects[key]?.items || [];
            return (
              <TabPanel key={key}>
                <OperatorResultCard items={items} />
              </TabPanel>
            );
          })}
        </TabPanels>
      </Tabs>
    </Box>
  );
};

export default RealtimeOperatorsTab;
