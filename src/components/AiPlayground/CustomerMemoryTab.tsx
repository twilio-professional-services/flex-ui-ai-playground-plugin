import React from 'react';
import { Box } from '@twilio-paste/core/box';
import { Text } from '@twilio-paste/core/text';
import { Tabs, Tab, TabList, TabPanel, TabPanels, useTabState } from '@twilio-paste/core/tabs';

const PLACEHOLDER_TEXT =
  'Plugin implementation in progress. Will fetch data via API from the new Twilio Customer Memory endpoints';

const CustomerMemoryTab: React.FC = () => {
  const tabState = useTabState();

  return (
    <Box paddingTop="space40">
      <Tabs baseId="customer-memory-tabs" state={tabState}>
        <TabList aria-label="Customer Memory tabs" element="OPERATOR_TAB_LIST">
          <Tab element="OPERATOR_TAB">Memories</Tab>
          <Tab element="OPERATOR_TAB">Observations</Tab>
          <Tab element="OPERATOR_TAB">Traits</Tab>
          <Tab element="OPERATOR_TAB">Conversation Summaries</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <Box padding="space60">
              <Text as="p" color="colorTextWeak">{PLACEHOLDER_TEXT}</Text>
            </Box>
          </TabPanel>
          <TabPanel>
            <Box padding="space60">
              <Text as="p" color="colorTextWeak">{PLACEHOLDER_TEXT}</Text>
            </Box>
          </TabPanel>
          <TabPanel>
            <Box padding="space60">
              <Text as="p" color="colorTextWeak">{PLACEHOLDER_TEXT}</Text>
            </Box>
          </TabPanel>
          <TabPanel>
            <Box padding="space60">
              <Text as="p" color="colorTextWeak">{PLACEHOLDER_TEXT}</Text>
            </Box>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
};

export default CustomerMemoryTab;
