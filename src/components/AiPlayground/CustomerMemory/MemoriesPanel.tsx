import React, { useState } from 'react';
import { Box } from '@twilio-paste/core/box';
import { Text } from '@twilio-paste/core/text';
import { Button } from '@twilio-paste/core/button';
import { Input } from '@twilio-paste/core/input';
import { Label } from '@twilio-paste/core/label';
import { Heading } from '@twilio-paste/core/heading';
import { Badge } from '@twilio-paste/core/badge';
import { Spinner } from '@twilio-paste/core/spinner';
import { Alert } from '@twilio-paste/core/alert';
import { useRecall } from './useMemora';

interface MemoriesPanelProps {
  profileId: string;
}

const MemoriesPanel: React.FC<MemoriesPanelProps> = ({ profileId }) => {
  const { data, loading, error, recall } = useRecall(profileId);
  const [query, setQuery] = useState('');
  const [observationsLimit, setObservationsLimit] = useState(20);
  const [summariesLimit, setSummariesLimit] = useState(5);

  const clampLimit = (value: string): number => {
    const num = parseInt(value, 10);
    if (isNaN(num)) return 0;
    return Math.max(0, Math.min(100, num));
  };

  const handleRecall = () => {
    recall({
      query: query || undefined,
      observationsLimit,
      summariesLimit,
    });
  };

  return (
    <Box paddingTop="space40">
      <Box display="flex" flexDirection="column" rowGap="space30" marginBottom="space40">
        <Box>
          <Label htmlFor="recall-query">Query (optional)</Label>
          <Input
            id="recall-query"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. billing concerns"
          />
        </Box>
        <Box display="flex" columnGap="space30">
          <Box flex="1">
            <Label htmlFor="obs-limit">Observations limit</Label>
            <Input
              id="obs-limit"
              type="number"
              min="0"
              max="100"
              value={String(observationsLimit)}
              onChange={(e) => setObservationsLimit(clampLimit(e.target.value))}
            />
          </Box>
          <Box flex="1">
            <Label htmlFor="sum-limit">Summaries limit</Label>
            <Input
              id="sum-limit"
              type="number"
              min="0"
              max="100"
              value={String(summariesLimit)}
              onChange={(e) => setSummariesLimit(clampLimit(e.target.value))}
            />
          </Box>
        </Box>
        <Box>
          <Button variant="primary" onClick={handleRecall} disabled={loading}>
            {loading ? 'Recalling...' : 'Recall'}
          </Button>
        </Box>
      </Box>

      {loading && (
        <Box display="flex" justifyContent="center" padding="space60">
          <Spinner decorative={false} title="Loading memories" />
        </Box>
      )}

      {error && (
        <Alert variant="error">
          <Text as="span">{error}</Text>
        </Alert>
      )}

      {!data && !loading && !error && (
        <Box padding="space60">
          <Text as="p" color="colorTextWeak">
            Click "Recall" to search customer memories. Leave query empty to retrieve recent items.
          </Text>
        </Box>
      )}

      {data && !loading && (
        <Box>
          {data.meta && (
            <Text as="p" color="colorTextWeak" fontSize="fontSize20" marginBottom="space20">
              Query time: {data.meta.queryTime}ms
            </Text>
          )}

          <Box overflowY="auto" style={{ maxHeight: 'calc(100vh - 420px)' }}>
            <Box display="flex" flexDirection="column" rowGap="space50">
              {data.observations.length > 0 && (
                <Box>
                  <Heading as="h5" variant="heading50">
                    Observations ({data.observations.length})
                  </Heading>
                  {data.observations.map((obs) => (
                    <Box
                      key={obs.id}
                      padding="space30"
                      marginBottom="space20"
                      borderWidth="borderWidth10"
                      borderColor="colorBorderWeaker"
                      borderStyle="solid"
                      borderRadius="borderRadius20"
                    >
                      <Text as="p" fontSize="fontSize30">{obs.content}</Text>
                      <Box display="flex" columnGap="space20" marginTop="space20">
                        {obs.source && <Badge as="span" variant="decorative10">{obs.source}</Badge>}
                        {obs.score != null && (
                          <Badge as="span" variant="decorative30">score: {obs.score.toFixed(2)}</Badge>
                        )}
                        {obs.occurredAt && (
                          <Text as="span" fontSize="fontSize20" color="colorTextWeak">
                            {new Date(obs.occurredAt).toLocaleString()}
                          </Text>
                        )}
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}

              {data.summaries.length > 0 && (
                <Box>
                  <Heading as="h5" variant="heading50">
                    Summaries ({data.summaries.length})
                  </Heading>
                  {data.summaries.map((sum) => (
                    <Box
                      key={sum.id}
                      padding="space30"
                      marginBottom="space20"
                      borderWidth="borderWidth10"
                      borderColor="colorBorderWeaker"
                      borderStyle="solid"
                      borderRadius="borderRadius20"
                    >
                      <Text as="p" fontSize="fontSize30">{sum.content}</Text>
                      <Box display="flex" columnGap="space20" marginTop="space20">
                        {sum.source && <Badge as="span" variant="decorative10">{sum.source}</Badge>}
                        {sum.score != null && (
                          <Badge as="span" variant="decorative30">score: {sum.score.toFixed(2)}</Badge>
                        )}
                        {sum.occurredAt && (
                          <Text as="span" fontSize="fontSize20" color="colorTextWeak">
                            {new Date(sum.occurredAt).toLocaleString()}
                          </Text>
                        )}
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}

              {data.observations.length === 0 &&
                data.summaries.length === 0 && (
                  <Text as="p" color="colorTextWeak">No memories found.</Text>
                )}
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default MemoriesPanel;
