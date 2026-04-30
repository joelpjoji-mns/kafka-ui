import React from 'react';
import { Button } from 'components/common/Button/Button';
import ErrorPage from 'components/ErrorPage/ErrorPage';
import PageLoader from 'components/common/PageLoader/PageLoader';
import ResourcePageHeading from 'components/common/ResourcePageHeading/ResourcePageHeading';
import Select, { SelectOption } from 'components/common/Select/Select';
import {
  OperationsBroker,
  OperationsConsumerGroup,
  OperationsIntegration,
  OperationsTopic,
} from 'generated-sources';
import { useOperationsCenter } from 'lib/hooks/api/operations';
import useAppParams from 'lib/hooks/useAppParams';
import {
  clusterBrokerPath,
  clusterConsumerGroupDetailsPath,
  clusterSchemasPath,
  clusterTopicPath,
  kafkaConnectPath,
  RouteParamsClusterTopic,
} from 'lib/paths';

import * as S from './OperationsCenter.styled';

const limitOptions: SelectOption<number>[] = [
  { label: 'Show top 5', value: 5 },
  { label: 'Show top 10', value: 10 },
  { label: 'Show top 20', value: 20 },
  { label: 'Show top 50', value: 50 },
];

const numberFormatter = new Intl.NumberFormat();

const formatNumber = (value?: number) =>
  value === undefined || value === null ? 'N/A' : numberFormatter.format(value);

const formatBytes = (value?: number) => {
  if (value === undefined || value === null) return 'N/A';
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length
  );
  const scaled = value / 1024 ** exponent;
  return `${scaled.toFixed(scaled >= 10 ? 0 : 1)} ${units[exponent - 1]}`;
};

const formatRate = (value?: number) =>
  value === undefined || value === null ? 'N/A' : `${formatBytes(value)}/s`;

const scoreTone = (score: number) => {
  if (score < 60) return 'danger';
  if (score < 90) return 'warning';
  return 'good';
};

const statusTone = (status: OperationsIntegration['status']) => {
  if (status === 'AVAILABLE') return 'good';
  if (status === 'UNAVAILABLE') return 'danger';
  if (status === 'UNKNOWN') return 'warning';
  return 'neutral';
};

const riskLabel = (signal: string) => signal.replaceAll('_', ' ');

const OperationsCenter: React.FC = () => {
  const { clusterName } = useAppParams<RouteParamsClusterTopic>();
  const [includeInternal, setIncludeInternal] = React.useState(false);
  const [limit, setLimit] = React.useState(10);
  const { data, error, isLoading, refetch } = useOperationsCenter(
    clusterName,
    includeInternal,
    limit
  );

  if (isLoading) {
    return <PageLoader offsetY={260} />;
  }

  if (!data) {
    return (
      <ErrorPage
        text={
          error?.message || 'Operations data is unavailable for this cluster.'
        }
        onClick={() => refetch()}
      />
    );
  }

  const { health, brokers, topics, consumers, integrations } = data;
  const allIntegrations = [
    integrations.schemaRegistry,
    ...integrations.connects,
  ];

  return (
    <>
      <ResourcePageHeading text="Operations Center">
        <Button buttonType="secondary" buttonSize="M" onClick={() => refetch()}>
          Refresh
        </Button>
      </ResourcePageHeading>
      <S.Page>
        <S.Controls>
          <S.Toggle>
            <input
              type="checkbox"
              checked={includeInternal}
              onChange={({ target: { checked } }) =>
                setIncludeInternal(checked)
              }
            />
            Include internal topics
          </S.Toggle>
          <Select
            id="operationsLimit"
            aria-label="Operations result limit"
            options={limitOptions}
            value={limit}
            onChange={setLimit}
            minWidth="160px"
          />
          <S.SampledAt>
            Sampled {new Date(data.collectedAtMs).toLocaleTimeString()}
          </S.SampledAt>
        </S.Controls>

        <S.Band aria-labelledby="operations-health-heading">
          <S.BandHeader>
            <S.BandTitle id="operations-health-heading">
              Cluster health
            </S.BandTitle>
            {health.lastError && (
              <S.SampledAt>Last error: {health.lastError}</S.SampledAt>
            )}
          </S.BandHeader>
          <S.HealthGrid>
            <S.Metric $tone={scoreTone(health.score)}>
              <strong>{health.score}</strong>
              <span>Health score</span>
            </S.Metric>
            <S.Metric $tone={health.offlinePartitions > 0 ? 'danger' : 'good'}>
              <strong>{formatNumber(health.offlinePartitions)}</strong>
              <span>Offline partitions</span>
            </S.Metric>
            <S.Metric
              $tone={health.underReplicatedPartitions > 0 ? 'danger' : 'good'}
            >
              <strong>{formatNumber(health.underReplicatedPartitions)}</strong>
              <span>Under replicated</span>
            </S.Metric>
            <S.Metric $tone={health.outOfSyncReplicas > 0 ? 'warning' : 'good'}>
              <strong>{formatNumber(health.outOfSyncReplicas)}</strong>
              <span>Out of sync replicas</span>
            </S.Metric>
            <S.Metric>
              <strong>{formatNumber(health.brokerCount)}</strong>
              <span>{health.controller || 'Unknown'} controller</span>
            </S.Metric>
          </S.HealthGrid>
        </S.Band>

        <S.Band aria-labelledby="operations-brokers-heading">
          <S.BandHeader>
            <S.BandTitle id="operations-brokers-heading">
              Broker capacity and distribution
            </S.BandTitle>
            <S.SampledAt>
              {brokers.skewAvailable
                ? 'Skew is based on the visible partition set.'
                : 'Skew appears after 50 visible partitions.'}
            </S.SampledAt>
          </S.BandHeader>
          <S.TableViewport>
            <S.Table>
              <thead>
                <tr>
                  <th>Broker</th>
                  <th>Leaders</th>
                  <th>Replicas</th>
                  <th>ISR</th>
                  <th>Stored</th>
                  <th>Usable</th>
                  <th>Replica skew</th>
                  <th>Leader skew</th>
                </tr>
              </thead>
              <tbody>
                {brokers.brokers.map((broker: OperationsBroker) => (
                  <tr key={broker.id}>
                    <td>
                      <S.ResourceLink
                        to={clusterBrokerPath(clusterName, broker.id)}
                      >
                        #{broker.id}
                        {broker.host ? ` (${broker.host})` : ''}
                      </S.ResourceLink>
                    </td>
                    <td>{formatNumber(broker.leaderCount)}</td>
                    <td>{formatNumber(broker.replicaCount)}</td>
                    <td>{formatNumber(broker.inSyncReplicaCount)}</td>
                    <td>{formatBytes(broker.segmentBytes)}</td>
                    <td>{formatBytes(broker.usableBytes)}</td>
                    <td>
                      {broker.partitionSkew === undefined
                        ? 'N/A'
                        : `${broker.partitionSkew}%`}
                    </td>
                    <td>
                      {broker.leaderSkew === undefined
                        ? 'N/A'
                        : `${broker.leaderSkew}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </S.Table>
          </S.TableViewport>
        </S.Band>

        <S.Split>
          <S.Band aria-labelledby="operations-topics-heading">
            <S.BandHeader>
              <S.BandTitle id="operations-topics-heading">
                Topic posture
              </S.BandTitle>
              <S.SampledAt>
                {formatNumber(topics.visibleCount)} topics ·{' '}
                {formatNumber(topics.partitions)} partitions ·{' '}
                {formatBytes(topics.storageBytes)} · in{' '}
                {formatRate(topics.inboundBytesPerSec)} · out{' '}
                {formatRate(topics.outboundBytesPerSec)}
              </S.SampledAt>
            </S.BandHeader>
            <S.Surface>
              <S.SurfaceHeading>At-risk topics</S.SurfaceHeading>
              {topics.atRisk.length === 0 ? (
                <S.Empty>
                  No topic risks were identified in the visible set.
                </S.Empty>
              ) : (
                <S.TableViewport>
                  <S.Table>
                    <thead>
                      <tr>
                        <th>Topic</th>
                        <th>Signals</th>
                        <th>Stored</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topics.atRisk.map((topic: OperationsTopic) => (
                        <tr key={topic.name}>
                          <td>
                            <S.ResourceLink
                              to={clusterTopicPath(clusterName, topic.name)}
                            >
                              {topic.name}
                            </S.ResourceLink>
                          </td>
                          <td>
                            <S.RiskSignals>
                              {topic.riskSignals.map((signal) => (
                                <S.Risk key={signal}>
                                  {riskLabel(signal)}
                                </S.Risk>
                              ))}
                            </S.RiskSignals>
                          </td>
                          <td>{formatBytes(topic.storageBytes)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </S.Table>
                </S.TableViewport>
              )}
            </S.Surface>
            <S.Surface>
              <S.SurfaceHeading>Largest topics</S.SurfaceHeading>
              {topics.largest.length === 0 ? (
                <S.Empty>
                  Storage data is unavailable for the visible topic set.
                </S.Empty>
              ) : (
                <S.TableViewport>
                  <S.Table>
                    <thead>
                      <tr>
                        <th>Topic</th>
                        <th>Messages</th>
                        <th>Stored</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topics.largest.map((topic: OperationsTopic) => (
                        <tr key={topic.name}>
                          <td>
                            <S.ResourceLink
                              to={clusterTopicPath(clusterName, topic.name)}
                            >
                              {topic.name}
                            </S.ResourceLink>
                          </td>
                          <td>{formatNumber(topic.messageCount)}</td>
                          <td>{formatBytes(topic.storageBytes)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </S.Table>
                </S.TableViewport>
              )}
            </S.Surface>
          </S.Band>

          <S.Band aria-labelledby="operations-consumers-heading">
            <S.BandHeader>
              <S.BandTitle id="operations-consumers-heading">
                Consumer posture
              </S.BandTitle>
              <S.SampledAt>
                {formatNumber(consumers.visibleCount)} groups ·{' '}
                {formatNumber(consumers.totalLag)} sampled lag
              </S.SampledAt>
            </S.BandHeader>
            <S.Surface>
              <S.SurfaceHeading>Group states</S.SurfaceHeading>
              <S.StateList>
                {consumers.states.length === 0 ? (
                  <S.Empty>No visible consumer groups were sampled.</S.Empty>
                ) : (
                  consumers.states.map((state) => (
                    <S.State key={state.state}>
                      {state.state}: {formatNumber(state.count)}
                    </S.State>
                  ))
                )}
              </S.StateList>
            </S.Surface>
            <S.Surface>
              <S.SurfaceHeading>Highest sampled lag</S.SurfaceHeading>
              {consumers.worstLagging.length === 0 ? (
                <S.Empty>No visible consumer groups were sampled.</S.Empty>
              ) : (
                <S.TableViewport>
                  <S.Table>
                    <thead>
                      <tr>
                        <th>Consumer group</th>
                        <th>State</th>
                        <th>Lag</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consumers.worstLagging.map(
                        (group: OperationsConsumerGroup) => (
                          <tr key={group.groupId}>
                            <td>
                              <S.ResourceLink
                                to={clusterConsumerGroupDetailsPath(
                                  clusterName,
                                  group.groupId
                                )}
                              >
                                {group.groupId}
                              </S.ResourceLink>
                            </td>
                            <td>{group.state || 'UNKNOWN'}</td>
                            <td>{formatNumber(group.lag)}</td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </S.Table>
                </S.TableViewport>
              )}
            </S.Surface>
          </S.Band>
        </S.Split>

        <S.Band aria-labelledby="operations-integrations-heading">
          <S.BandHeader>
            <S.BandTitle id="operations-integrations-heading">
              Integration posture
            </S.BandTitle>
          </S.BandHeader>
          <S.IntegrationGrid>
            {allIntegrations.map((integration: OperationsIntegration) => {
              const configured = integration.status !== 'NOT_CONFIGURED';
              const destination =
                integration.name === 'Schema Registry'
                  ? clusterSchemasPath(clusterName)
                  : kafkaConnectPath(clusterName);
              return (
                <S.Integration
                  key={integration.name}
                  $tone={statusTone(integration.status)}
                >
                  <strong>
                    {configured ? (
                      <S.ResourceLink to={destination}>
                        {integration.name}
                      </S.ResourceLink>
                    ) : (
                      integration.name
                    )}
                  </strong>
                  <span>{integration.status.replaceAll('_', ' ')}</span>
                  {integration.connectorCount !== undefined && (
                    <S.SampledAt>
                      {formatNumber(integration.connectorCount)} connectors ·{' '}
                      {formatNumber(integration.failingConnectorCount)} failing
                    </S.SampledAt>
                  )}
                </S.Integration>
              );
            })}
          </S.IntegrationGrid>
        </S.Band>
      </S.Page>
    </>
  );
};

export default OperationsCenter;
