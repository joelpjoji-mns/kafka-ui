import React from 'react';
import { Button } from 'components/common/Button/Button';
import ErrorPage from 'components/ErrorPage/ErrorPage';
import PageLoader from 'components/common/PageLoader/PageLoader';
import ResourcePageHeading from 'components/common/ResourcePageHeading/ResourcePageHeading';
import { useRecordExplorer } from 'lib/hooks/api/recordExplorer';
import useAppParams from 'lib/hooks/useAppParams';
import { clusterTopicMessagesPath, ClusterNameRoute } from 'lib/paths';

import * as S from './RecordExplorer.styled';

type ExplorerDraft = {
  query: string;
  topic: string;
  includeInternal: boolean;
  topicLimit: number;
  perTopicSampleLimit: number;
  resultLimit: number;
};

const defaultDraft: ExplorerDraft = {
  query: '',
  topic: '',
  includeInternal: false,
  topicLimit: 8,
  perTopicSampleLimit: 25,
  resultLimit: 100,
};

const formatTimestamp = (timestamp: Date) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(timestamp);

const RecordExplorer: React.FC = () => {
  const { clusterName } = useAppParams<ClusterNameRoute>();
  const [draft, setDraft] = React.useState<ExplorerDraft>(defaultDraft);
  const [filters, setFilters] = React.useState<ExplorerDraft>();
  const { data, error, isLoading, isRefetching, refetch } = useRecordExplorer(
    clusterName,
    filters
  );

  const search = () => {
    const query = draft.query.trim();
    if (!query) return;
    setFilters({ ...draft, query, topic: draft.topic.trim() });
  };

  const clear = () => {
    setDraft(defaultDraft);
    setFilters(undefined);
  };

  return (
    <>
      <ResourcePageHeading text="Record Explorer" />
      <S.Page>
        <S.Controls aria-label="Record explorer controls">
          <S.FilterLabel>
            <span>Search text</span>
            <S.FilterInput
              aria-label="Search text"
              placeholder="Key, value, header name, or header value"
              value={draft.query}
              onChange={({ target }) =>
                setDraft((current) => ({ ...current, query: target.value }))
              }
            />
          </S.FilterLabel>
          <S.FilterLabel>
            <span>Topic filter</span>
            <S.FilterInput
              aria-label="Topic filter"
              placeholder="Optional topic name"
              value={draft.topic}
              onChange={({ target }) =>
                setDraft((current) => ({ ...current, topic: target.value }))
              }
            />
          </S.FilterLabel>
          <S.FilterLabel>
            <span>Topics</span>
            <S.FilterSelect
              aria-label="Topic sample limit"
              value={draft.topicLimit}
              onChange={({ target }) =>
                setDraft((current) => ({
                  ...current,
                  topicLimit: Number(target.value),
                }))
              }
            >
              <option value={4}>4</option>
              <option value={8}>8</option>
              <option value={12}>12</option>
            </S.FilterSelect>
          </S.FilterLabel>
          <S.FilterLabel>
            <span>Recent records per topic</span>
            <S.FilterSelect
              aria-label="Per-topic sample limit"
              value={draft.perTopicSampleLimit}
              onChange={({ target }) =>
                setDraft((current) => ({
                  ...current,
                  perTopicSampleLimit: Number(target.value),
                }))
              }
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </S.FilterSelect>
          </S.FilterLabel>
          <S.FilterLabel>
            <span>Maximum matches</span>
            <S.FilterSelect
              aria-label="Result limit"
              value={draft.resultLimit}
              onChange={({ target }) =>
                setDraft((current) => ({
                  ...current,
                  resultLimit: Number(target.value),
                }))
              }
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </S.FilterSelect>
          </S.FilterLabel>
          <S.Toggle>
            <input
              type="checkbox"
              checked={draft.includeInternal}
              onChange={({ target }) =>
                setDraft((current) => ({
                  ...current,
                  includeInternal: target.checked,
                }))
              }
            />
            Include system topics
          </S.Toggle>
          <S.Actions>
            <Button
              buttonType="primary"
              buttonSize="M"
              disabled={!draft.query.trim() || isLoading || isRefetching}
              onClick={search}
            >
              Search
            </Button>
            <Button buttonType="secondary" buttonSize="M" onClick={clear}>
              Clear
            </Button>
          </S.Actions>
        </S.Controls>

        {!filters && (
          <S.Empty>
            Enter a search term to inspect a bounded recent sample of readable
            topics.
          </S.Empty>
        )}
        {filters && isLoading && !data && <PageLoader offsetY={360} />}
        {filters && !isLoading && !data && (
          <ErrorPage
            offsetY={360}
            text={
              error?.message ||
              'Record evidence is unavailable for this cluster.'
            }
            onClick={() => refetch()}
          />
        )}
        {filters && data && (
          <>
            <S.Summary aria-label="Record explorer sampling summary">
              <S.Metric>
                <strong>{data.records.length}</strong>
                <span>Matching records</span>
              </S.Metric>
              <S.Metric>
                <strong>{data.sampledRecords}</strong>
                <span>Recent records sampled</span>
              </S.Metric>
              <S.Metric>
                <strong>{data.topicsScanned}</strong>
                <span>of {data.visibleTopicCount} readable topics</span>
              </S.Metric>
              <S.Metric>
                <strong>{data.perTopicSampleLimit}</strong>
                <span>Records sampled per topic</span>
              </S.Metric>
            </S.Summary>

            {(data.topicLimitReached || data.resultLimitReached) && (
              <S.Notice role="status">
                {data.topicLimitReached &&
                  `Only the first ${data.topicLimit} readable topics were sampled. `}
                {data.resultLimitReached &&
                  `Only the first ${data.resultLimit} matching records are shown. `}
                Narrow the topic filter or search text to inspect a smaller
                scope.
              </S.Notice>
            )}

            <S.Section aria-labelledby="record-evidence-heading">
              <S.SectionHeader>
                <S.SectionTitle id="record-evidence-heading">
                  Matching record evidence
                </S.SectionTitle>
                <S.SectionHint>
                  Search is evaluated against the current text representation
                  from the configured serdes.
                </S.SectionHint>
              </S.SectionHeader>
              {data.records.length === 0 ? (
                <S.Empty>
                  No records matched in the bounded recent sample.
                </S.Empty>
              ) : (
                <S.TableViewport>
                  <S.Table>
                    <thead>
                      <tr>
                        <th>Topic</th>
                        <th>Partition / offset</th>
                        <th>Timestamp</th>
                        <th>Key</th>
                        <th>Value</th>
                        <th>Headers</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.records.map((record) => (
                        <tr
                          key={`${record.topic}-${record.partition}-${record.offset}`}
                        >
                          <td>
                            <S.ResourceLink
                              to={clusterTopicMessagesPath(
                                clusterName,
                                record.topic
                              )}
                            >
                              {record.topic}
                            </S.ResourceLink>
                          </td>
                          <td>
                            {record.partition} / {record.offset}
                          </td>
                          <td>{formatTimestamp(record.timestamp)}</td>
                          <td>
                            <S.Content>{record.key || 'No key'}</S.Content>
                          </td>
                          <td>
                            <S.Content>{record.value || 'No value'}</S.Content>
                          </td>
                          <td>
                            {record.headers &&
                            Object.keys(record.headers).length > 0 ? (
                              <S.Content>
                                {JSON.stringify(record.headers)}
                              </S.Content>
                            ) : (
                              <S.Muted>No headers</S.Muted>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </S.Table>
                </S.TableViewport>
              )}
            </S.Section>

            <S.Section aria-labelledby="record-coverage-heading">
              <S.SectionHeader>
                <S.SectionTitle id="record-coverage-heading">
                  Sample coverage
                </S.SectionTitle>
              </S.SectionHeader>
              <S.TableViewport>
                <S.Table>
                  <thead>
                    <tr>
                      <th>Topic</th>
                      <th>Recent records sampled</th>
                      <th>Matches</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.coverage.map((coverage) => (
                      <tr key={coverage.topic}>
                        <td>{coverage.topic}</td>
                        <td>{coverage.sampledRecords}</td>
                        <td>{coverage.matchedRecords}</td>
                      </tr>
                    ))}
                  </tbody>
                </S.Table>
              </S.TableViewport>
            </S.Section>
          </>
        )}
      </S.Page>
    </>
  );
};

export default RecordExplorer;
