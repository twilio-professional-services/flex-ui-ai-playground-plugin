import React from 'react';
import { ITask } from '@twilio/flex-ui';
import { Box } from '@twilio-paste/core/box';
import { Text } from '@twilio-paste/core/text';
import { Spinner } from '@twilio-paste/core/spinner';
import { Alert } from '@twilio-paste/core/alert';
import { Tabs, Tab, TabList, TabPanel, TabPanels, useTabState } from '@twilio-paste/core/tabs';
import { useProfileLookup } from './useMemora';
import MemoriesPanel from './MemoriesPanel';
import ObservationsPanel from './ObservationsPanel';
import TraitsPanel from './TraitsPanel';
import ConversationSummariesPanel from './ConversationSummariesPanel';

interface CustomerMemoryTabProps {
  task?: ITask;
}

const CustomerMemoryTab: React.FC<CustomerMemoryTabProps> = ({ task }) => {
  const callerNumber: string | undefined = task?.attributes?.from;
  const { profileId, loading, error } = useProfileLookup(callerNumber);
  const tabState = useTabState();

  if (!task) {
    return (
      <Box padding="space60">
        <Text as="p" color="colorTextWeak">No active task selected.</Text>
      </Box>
    );
  }

  if (!callerNumber) {
    return (
      <Box padding="space60">
        <Text as="p" color="colorTextWeak">No caller number available on this task.</Text>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box display="flex" alignItems="center" columnGap="space30" padding="space60">
        <Spinner decorative={false} title="Resolving profile" />
        <Text as="p" color="colorTextWeak">Looking up profile for {callerNumber}...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box padding="space60">
        <Alert variant="warning">
          <Text as="span">{error}</Text>
        </Alert>
      </Box>
    );
  }

  if (!profileId) {
    return (
      <Box padding="space60">
        <Text as="p" color="colorTextWeak">No profile found for {callerNumber}.</Text>
      </Box>
    );
  }

  return (
    <Box paddingTop="space40">
      <Text as="p" fontSize="fontSize20" color="colorTextWeak" marginBottom="space30">
        Profile: {profileId}
      </Text>
      <Tabs baseId="customer-memory-tabs" state={tabState}>
        <TabList aria-label="Customer Memory tabs" element="OPERATOR_TAB_LIST">
          <Tab element="OPERATOR_TAB">Memory Retrieval</Tab>
          <Tab element="OPERATOR_TAB">Observations</Tab>
          <Tab element="OPERATOR_TAB">Conversation Summaries</Tab>
          <Tab element="OPERATOR_TAB">Traits</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <MemoriesPanel profileId={profileId} />
          </TabPanel>
          <TabPanel>
            <ObservationsPanel profileId={profileId} />
          </TabPanel>
          <TabPanel>
            <ConversationSummariesPanel profileId={profileId} />
          </TabPanel>
          <TabPanel>
            <TraitsPanel profileId={profileId} />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
};

export default CustomerMemoryTab;
