import React from 'react';
import * as Flex from '@twilio/flex-ui';
import { Box } from '@twilio-paste/core/box';
import { Heading } from '@twilio-paste/core/heading';
import { Tabs, Tab, TabList, TabPanel, TabPanels, useTabState } from '@twilio-paste/core/tabs';
import { useUID } from '@twilio-paste/core/uid-library';
import RealtimeOperatorsTab from './RealtimeOperatorsTab';
import PostCallOperatorsTab from './PostCallOperatorsTab';

interface AiPlaygroundPanelProps {
  tasks?: Map<string, Flex.ITask>;
  selectedTaskSid?: string;
}

const AiPlaygroundPanel: React.FC<AiPlaygroundPanelProps> = ({ tasks, selectedTaskSid }) => {
  const task = selectedTaskSid ? tasks?.get(selectedTaskSid) : undefined;
  const realtimeOperatorsId = useUID();
  const postCallOperatorsId = useUID();
  const tabState = useTabState();

  return (
    <Box display="flex" flexDirection="column" style={{ height: '100%' }}>
      <Box paddingX="space60" paddingTop="space60">
        <Heading as="h3" variant="heading30" marginBottom="space0">
          Flex UI AI Playground
        </Heading>
      </Box>
      <Tabs selectedId={realtimeOperatorsId} baseId="ai-playground-tabs" state={tabState}>
        <Box paddingX="space60">
          <TabList aria-label="AI Playground tabs">
            <Tab id={realtimeOperatorsId}>Realtime Operators</Tab>
            <Tab id={postCallOperatorsId}>Post Call Operators</Tab>
          </TabList>
        </Box>
        <Box flex="1" minHeight="0" overflowY="auto" paddingX="space60" paddingBottom="space60">
          <TabPanels>
            <TabPanel>
              <RealtimeOperatorsTab task={task} />
            </TabPanel>
            <TabPanel>
              <PostCallOperatorsTab task={task} />
            </TabPanel>
          </TabPanels>
        </Box>
      </Tabs>
    </Box>
  );
};

export default AiPlaygroundPanel;
