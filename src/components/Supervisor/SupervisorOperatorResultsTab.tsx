import React, { useState, useMemo } from 'react';
import * as Flex from '@twilio/flex-ui';
import { Box } from '@twilio-paste/core/box';
import { Label } from '@twilio-paste/core/label';
import { Select, Option } from '@twilio-paste/core/select';
import { Text } from '@twilio-paste/core/text';
import { useTrackedMap } from '../../utils/sync-to-redux/hooks';
import { getRealtimeOperatorKeys, getPostCallOperatorKeys, getOperatorDisplayName } from '../AiPlayground/utils';
import OperatorResultCard from '../AiPlayground/OperatorResultCard';
import type { OperatorResult } from '../AiPlayground/types';
import { getMapName } from '../../utils/syncMapHelpers';

interface SupervisorOperatorResultsTabProps {
  task?: Flex.ITask;
}

const SupervisorOperatorResultsTab: React.FC<SupervisorOperatorResultsTabProps> = ({ task }) => {
  const callSid = task?.attributes?.call_sid;
  const mapName = callSid ? getMapName(callSid) : '';

  // Access Redux state for this call
  const trackedMap = useTrackedMap(mapName);
  const syncObjects = trackedMap?.syncObjects || {};

  // Get all operator keys (combine realtime and post-call)
  const allOperatorKeys = useMemo(() => {
    const realtimeKeys = getRealtimeOperatorKeys(syncObjects);
    const postCallKeys = getPostCallOperatorKeys(syncObjects);
    return [...realtimeKeys, ...postCallKeys];
  }, [syncObjects]);

  // State for selected operator
  const [selectedOperatorKey, setSelectedOperatorKey] = useState<string>('');

  // Auto-select first operator when available
  React.useEffect(() => {
    if (allOperatorKeys.length > 0 && !selectedOperatorKey) {
      setSelectedOperatorKey(allOperatorKeys[0]);
    }
  }, [allOperatorKeys, selectedOperatorKey]);

  // Handle dropdown change
  const handleOperatorChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedOperatorKey(event.target.value);
  };

  // Get selected operator data
  const selectedOperatorItems: OperatorResult[] = selectedOperatorKey
    ? syncObjects[selectedOperatorKey]?.items || []
    : [];

  // No call_sid case
  if (!callSid) {
    return (
      <Box padding="space60">
        <Text as="p" color="colorTextWeak">No call selected</Text>
      </Box>
    );
  }

  // No operators available yet
  if (allOperatorKeys.length === 0) {
    return (
      <Box padding="space60">
        <Text as="p" color="colorTextWeak">Waiting for operator results...</Text>
      </Box>
    );
  }

  return (
    <Box padding="space60" style={{ maxWidth: '420px', width: '100%' }}>
      <Box marginBottom="space60">
        <Label htmlFor="operator-selector">Select Operator</Label>
        <Select
          id="operator-selector"
          value={selectedOperatorKey}
          onChange={handleOperatorChange}
        >
          {allOperatorKeys.map((key) => {
            const items: OperatorResult[] = syncObjects[key]?.items || [];
            const displayName = getOperatorDisplayName(key, items);
            const count = items.length;
            return (
              <Option key={key} value={key}>
                {displayName} ({count} result{count !== 1 ? 's' : ''})
              </Option>
            );
          })}
        </Select>
      </Box>

      {selectedOperatorKey && (
        <OperatorResultCard items={selectedOperatorItems} />
      )}
    </Box>
  );
};

export default Flex.withTaskContext(SupervisorOperatorResultsTab);
