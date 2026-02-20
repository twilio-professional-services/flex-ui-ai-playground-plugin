import React, { useState, useEffect } from 'react';
import { Box } from '@twilio-paste/core/box';
import { Text } from '@twilio-paste/core/text';
import { Button } from '@twilio-paste/core/button';
import { Badge } from '@twilio-paste/core/badge';
import { Checkbox } from '@twilio-paste/core/checkbox';
import { Spinner } from '@twilio-paste/core/spinner';
import { Alert } from '@twilio-paste/core/alert';
import { useObservations, useDeleteItems } from './useMemora';

interface ObservationsPanelProps {
  profileId: string;
}

const ObservationsPanel: React.FC<ObservationsPanelProps> = ({ profileId }) => {
  const { items, loading, error, hasNext, hasPrevious, fetchNext, fetchPrevious, refetch } = useObservations(profileId);
  const { deleting, deleteProgress, deleteError, deleteItems } = useDeleteItems(profileId);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Clear selection when items change (page navigation or refresh)
  useEffect(() => {
    setSelected(new Set());
  }, [items]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    const ids = Array.from(selected);
    const deleted = await deleteItems('deleteObservation', ids);
    if (deleted > 0) {
      setSelected(new Set());
      refetch();
    }
  };

  if (loading && items.length === 0) {
    return (
      <Box display="flex" justifyContent="center" padding="space60">
        <Spinner decorative={false} title="Loading observations" />
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
        <Text as="p" color="colorTextWeak">No observations found.</Text>
      </Box>
    );
  }

  return (
    <Box paddingTop="space40">
      {deleteError && (
        <Alert variant="error">
          <Text as="span">{deleteError}</Text>
        </Alert>
      )}

      <Box display="flex" justifyContent="space-between" alignItems="center" marginBottom="space30">
        <Box display="flex" columnGap="space20" alignItems="center">
          <Button
            variant="secondary"
            size="small"
            onClick={fetchPrevious}
            disabled={!hasPrevious || loading || deleting}
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
            disabled={!hasNext || loading || deleting}
          >
            Next
          </Button>
        </Box>
        <Box display="flex" columnGap="space20" alignItems="center">
          {deleting && (
            <Text as="span" fontSize="fontSize20" color="colorTextWeak">
              Deleting {deleteProgress.done}/{deleteProgress.total}...
            </Text>
          )}
          <Button
            variant="destructive_secondary"
            size="small"
            onClick={handleDeleteSelected}
            disabled={selected.size === 0 || deleting}
          >
            Delete Selected ({selected.size})
          </Button>
        </Box>
      </Box>

      <Box overflowY="auto" style={{ maxHeight: 'calc(100vh - 400px)' }}>
        {items.map((obs) => (
          <Box
            key={obs.id}
            padding="space30"
            marginBottom="space20"
            borderWidth="borderWidth10"
            borderColor={selected.has(obs.id) ? 'colorBorderPrimary' : 'colorBorderWeaker'}
            borderStyle="solid"
            borderRadius="borderRadius20"
            display="flex"
            columnGap="space30"
            alignItems="flex-start"
          >
            <Box paddingTop="space10">
              <Checkbox
                id={`obs-${obs.id}`}
                checked={selected.has(obs.id)}
                onChange={() => toggleSelect(obs.id)}
                disabled={deleting}
              >
                {/* visually hidden label */}
                <Box as="span" display="none">Select observation</Box>
              </Checkbox>
            </Box>
            <Box flex="1">
              <Text as="p" fontSize="fontSize30">{obs.content}</Text>
              <Box display="flex" columnGap="space20" marginTop="space20">
                {obs.source && <Badge as="span" variant="decorative10">{obs.source}</Badge>}
                {obs.occurredAt && (
                  <Text as="span" fontSize="fontSize20" color="colorTextWeak">
                    {new Date(obs.occurredAt).toLocaleString()}
                  </Text>
                )}
              </Box>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default ObservationsPanel;
