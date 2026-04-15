import React from 'react';
import { Button } from 'components/common/Button/Button';
import ErrorPage from 'components/ErrorPage/ErrorPage';
import PageLoader from 'components/common/PageLoader/PageLoader';
import {
  ConnectorTriageConnector,
  ConnectorTriageSeverity,
} from 'generated-sources';
import { useConnectorTriage } from 'lib/hooks/api/kafkaConnect';
import useAppParams from 'lib/hooks/useAppParams';
import { clusterConnectConnectorPath, ClusterNameRoute } from 'lib/paths';

import * as S from './Triage.styled';

type Tone = 'critical' | 'good' | 'warning';

const severityTone = (severity: ConnectorTriageSeverity): Tone => {
  if (severity === ConnectorTriageSeverity.CRITICAL) return 'critical';
  if (severity === ConnectorTriageSeverity.WARNING) return 'warning';
  return 'good';
};

const label = (value: string) => value.replaceAll('_', ' ');

const FailureTasks: React.FC<{ connector: ConnectorTriageConnector }> = ({
  connector,
}) => {
  if (connector.failedTasks.length === 0) {
    return <span>-</span>;
  }

  return (
    <S.TaskList>
      {connector.failedTasks.map((task) => (
        <li key={task.id}>
          <strong>Task #{task.id}</strong>
          <span>{label(task.state)}</span>
          {task.traceExcerpt && <S.Trace>{task.traceExcerpt}</S.Trace>}
        </li>
      ))}
    </S.TaskList>
  );
};

const Triage: React.FC = () => {
  const { clusterName } = useAppParams<ClusterNameRoute>();
  const [query, setQuery] = React.useState('');
  const [showHealthy, setShowHealthy] = React.useState(false);
  const { data, error, isLoading, isRefetching, refetch } =
    useConnectorTriage(clusterName);

  if (isLoading) {
    return <PageLoader offsetY={300} />;
  }

  if (!data) {
    return (
      <ErrorPage
        offsetY={300}
        text={
          error?.message ||
          'Kafka Connect triage evidence is unavailable for this cluster.'
        }
        onClick={() => refetch()}
      />
    );
  }

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const connectors = data.connectors.filter((connector) => {
    const matchesQuery =
      !normalizedQuery ||
      connector.name.toLocaleLowerCase().includes(normalizedQuery) ||
      connector.connect.toLocaleLowerCase().includes(normalizedQuery);
    return (
      matchesQuery &&
      (showHealthy || connector.severity !== ConnectorTriageSeverity.HEALTHY)
    );
  });
  const { summary } = data;

  return (
    <S.Page>
      <S.Controls aria-label="Connector triage filters">
        <S.FilterLabel>
          <span>Connector</span>
          <S.FilterInput
            aria-label="Filter connector triage"
            placeholder="Filter by connector or Connect cluster"
            value={query}
            onChange={({ target }) => setQuery(target.value)}
          />
        </S.FilterLabel>
        <S.Toggle>
          <input
            type="checkbox"
            checked={showHealthy}
            onChange={({ target }) => setShowHealthy(target.checked)}
          />
          Show healthy connectors
        </S.Toggle>
        <Button
          buttonType="secondary"
          buttonSize="M"
          onClick={() => refetch()}
          disabled={isRefetching}
        >
          {isRefetching ? 'Refreshing' : 'Refresh'}
        </Button>
        <S.SampledAt>
          Live status sampled{' '}
          {new Date(data.collectedAtMs).toLocaleTimeString()}
        </S.SampledAt>
      </S.Controls>

      <S.Summary aria-label="Connector triage summary">
        <S.Metric $tone="critical">
          <strong>{summary.criticalConnectors}</strong>
          <span>Critical</span>
        </S.Metric>
        <S.Metric $tone="warning">
          <strong>{summary.warningConnectors}</strong>
          <span>Needs review</span>
        </S.Metric>
        <S.Metric $tone="good">
          <strong>{summary.healthyConnectors}</strong>
          <span>Healthy</span>
        </S.Metric>
        <S.Metric $tone="critical">
          <strong>{summary.failedTasks}</strong>
          <span>Failed tasks</span>
        </S.Metric>
        <S.Metric $tone="good">
          <strong>{summary.totalConnectors}</strong>
          <span>Visible connectors</span>
        </S.Metric>
      </S.Summary>

      <S.Evidence aria-labelledby="connector-triage-heading">
        <S.EvidenceHeader>
          <S.EvidenceTitle id="connector-triage-heading">
            Connector posture
          </S.EvidenceTitle>
          <S.PageState>
            Showing {connectors.length} of {data.connectors.length}
          </S.PageState>
        </S.EvidenceHeader>
        {connectors.length === 0 ? (
          <S.Empty>
            No connector failures or warnings match the selected triage filters.
          </S.Empty>
        ) : (
          <S.TableViewport>
            <S.Table>
              <thead>
                <tr>
                  <th>Connector</th>
                  <th>State</th>
                  <th>Tasks</th>
                  <th>Failed task evidence</th>
                  <th>Connector evidence</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {connectors.map((connector) => (
                  <tr key={`${connector.connect}-${connector.name}`}>
                    <td>
                      <strong>{connector.name}</strong>
                      <S.Detail>{connector.connect}</S.Detail>
                    </td>
                    <td>
                      <S.Severity $tone={severityTone(connector.severity)}>
                        {connector.severity}
                      </S.Severity>
                      <S.Detail>{label(connector.connectorState)}</S.Detail>
                    </td>
                    <td>
                      {connector.tasksCount} total
                      <S.Detail>{connector.failedTasksCount} failed</S.Detail>
                    </td>
                    <td>
                      <FailureTasks connector={connector} />
                    </td>
                    <td>
                      {connector.traceExcerpt ? (
                        <S.Trace>{connector.traceExcerpt}</S.Trace>
                      ) : (
                        <span>No connector trace available</span>
                      )}
                    </td>
                    <td>
                      <S.ResourceLink
                        to={clusterConnectConnectorPath(
                          clusterName,
                          connector.connect,
                          connector.name
                        )}
                      >
                        Inspect
                      </S.ResourceLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </S.Table>
          </S.TableViewport>
        )}
      </S.Evidence>
    </S.Page>
  );
};

export default Triage;
