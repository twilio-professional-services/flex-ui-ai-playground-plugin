import React from 'react';
import { Box } from '@twilio-paste/core/box';
import { Text } from '@twilio-paste/core/text';
import { Button } from '@twilio-paste/core/button';
import { Badge } from '@twilio-paste/core/badge';
import { Spinner } from '@twilio-paste/core/spinner';
import { Alert } from '@twilio-paste/core/alert';
import { useTraits } from './useMemora';

interface TraitsPanelProps {
  profileId: string;
}

const TraitsPanel: React.FC<TraitsPanelProps> = ({ profileId }) => {
  const { items, loading, error, hasNext, hasPrevious, fetchNext, fetchPrevious } = useTraits(profileId);

  if (loading && items.length === 0) {
    return (
      <Box display="flex" justifyContent="center" padding="space60">
        <Spinner decorative={false} title="Loading traits" />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert variant="error">
        <Text as="span">{error}</Text>
      </Alert>
    );
  }

  if (items.length === 0) {
    return (
      <Box padding="space60">
        <Text as="p" color="colorTextWeak">No traits found.</Text>
      </Box>
    );
  }

  return (
    <Box paddingTop="space40">
      <Box display="flex" justifyContent="space-between" alignItems="center" marginBottom="space30">
        <Button
          variant="secondary"
          size="small"
          onClick={fetchPrevious}
          disabled={!hasPrevious || loading}
        >
          Previous
        </Button>
        {loading && <Spinner decorative={false} title="Loading" size="sizeIcon30" />}
        <Text as="span" fontSize="fontSize20" color="colorTextWeak">
          {items.length} items
        </Text>
        <Button
          variant="secondary"
          size="small"
          onClick={fetchNext}
          disabled={!hasNext || loading}
        >
          Next
        </Button>
      </Box>

      <Box overflowY="auto" style={{ maxHeight: 'calc(100vh - 350px)' }}>
        {items.map((trait) => (
          <Box
            key={`${trait.traitGroup}-${trait.name}`}
            padding="space30"
            marginBottom="space20"
            borderWidth="borderWidth10"
            borderColor="colorBorderWeaker"
            borderStyle="solid"
            borderRadius="borderRadius20"
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Box>
              <Text as="span" fontWeight="fontWeightSemibold" fontSize="fontSize30">
                {trait.name}
              </Text>
              <Text as="span" fontSize="fontSize30" color="colorText">
                {' = '}
                {Array.isArray(trait.value) ? trait.value.join(', ') : String(trait.value)}
              </Text>
            </Box>
            <Badge as="span" variant="decorative20">{trait.traitGroup}</Badge>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default TraitsPanel;
