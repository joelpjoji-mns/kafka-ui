import React from 'react';
import { Button } from 'components/common/Button/Button';
import ErrorPage from 'components/ErrorPage/ErrorPage';
import PageLoader from 'components/common/PageLoader/PageLoader';
import ResourcePageHeading from 'components/common/ResourcePageHeading/ResourcePageHeading';
import {
  TopicGovernanceRecommendation,
  TopicGovernanceRecommendationSeverityEnum,
  TopicGovernanceTopic,
  TopicGovernanceTopicSeverityEnum,
} from 'generated-sources';
import useAppParams from 'lib/hooks/useAppParams';
import { useTopicGovernance } from 'lib/hooks/api/topicGovernance';
import { clusterTopicPath, ClusterNameRoute } from 'lib/paths';

import * as S from './TopicGovernance.styled';

type SeverityFilter = 'ALL' | TopicGovernanceTopicSeverityEnum;
type Tone = 'critical' | 'good' | 'info' | 'warning';

const numberFormatter = new Intl.NumberFormat();

const formatNumber = (value?: number) =>
  value === undefined || value === null
    ? 'Unavailable'
    : numberFormatter.format(value);

const formatBytes = (value?: number) => {
  if (value === undefined || value === null) return 'Unavailable';
  if (value === -1) return 'Unlimited';
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length
  );
  const scaled = value / 1024 ** exponent;
  return `${scaled.toFixed(scaled >= 10 ? 0 : 1)} ${units[exponent - 1]}`;
};

const formatDuration = (value?: number) => {
  if (value === undefined || value === null) return 'Unavailable';
  if (value === -1) return 'Unlimited';
  if (value < 60_000) return `${value} ms`;
  if (value < 3_600_000) return `${Math.round(value / 60_000)} min`;
  if (value < 86_400_000) return `${Math.round(value / 3_600_000)} h`;
  return `${Math.round(value / 86_400_000)} d`;
};

const label = (value: string) => value.replaceAll('_', ' ');

const severityTone = (severity: TopicGovernanceTopicSeverityEnum): Tone => {
  if (severity === TopicGovernanceTopicSeverityEnum.CRITICAL) return 'critical';
  if (severity === TopicGovernanceTopicSeverityEnum.WARNING) return 'warning';
  if (severity === TopicGovernanceTopicSeverityEnum.INFO) return 'info';
  return 'good';
};

const recommendationTone = (
  severity: TopicGovernanceRecommendationSeverityEnum
): Tone => {
  if (severity === TopicGovernanceRecommendationSeverityEnum.CRITICAL) {
    return 'critical';
  }
  if (severity === TopicGovernanceRecommendationSeverityEnum.WARNING) {
    return 'warning';
  }
  return 'info';
};

const scoreTone = (score: number): Tone => {
  if (score < 60) return 'critical';
  if (score < 90) return 'warning';
  return 'good';
};

const availability = (topic: TopicGovernanceTopic) => [
  {
    available: topic.settings.configurationAvailable,
    label: topic.settings.configurationAvailable
      ? 'Config sampled'
      : 'Config unavailable',
  },
  {
    available: topic.offsetDataAvailable,
    label: topic.offsetDataAvailable
      ? 'Offsets sampled'
      : 'Offsets unavailable',
  },
  {
    available: topic.storageDataAvailable,
    label: topic.storageDataAvailable
      ? 'Storage sampled'
      : 'Storage unavailable',
  },
];

const SettingsEvidence: React.FC<{ topic: TopicGovernanceTopic }> = ({
  topic,
}) => {
  const { settings } = topic;
  return (
    <S.EvidenceList>
      <span>Cleanup: {settings.cleanupPolicy || 'Unavailable'}</span>
      <span>
        Retention: {formatDuration(settings.retentionMs)} /{' '}
        {formatBytes(settings.retentionBytes)}
      </span>
      <span>
        Segment: {formatDuration(settings.segmentMs)} /{' '}
        {formatBytes(settings.segmentBytes)}
      </span>
      <span>Max message: {formatBytes(settings.maxMessageBytes)}</span>
    </S.EvidenceList>
  );
};

const Recommendations: React.FC<{
  recommendations: TopicGovernanceRecommendation[];
}> = ({ recommendations }) => {
  if (recommendations.length === 0) {
    return <S.Detail>No advisor recommendations for this topic.</S.Detail>;
  }

  return (
    <S.RecommendationList>
      {recommendations.map((recommendation) => (
        <S.Recommendation key={recommendation.code}>
          <S.RecommendationCode
            $tone={recommendationTone(recommendation.severity)}
          >
            {label(recommendation.code)}
          </S.RecommendationCode>
          <span>{recommendation.message}</span>
          {recommendation.evidence && <small>{recommendation.evidence}</small>}
        </S.Recommendation>
      ))}
    </S.RecommendationList>
  );
};

const TopicGovernance: React.FC = () => {
  const { clusterName } = useAppParams<ClusterNameRoute>();
  const [includeInternal, setIncludeInternal] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [severity, setSeverity] = React.useState<SeverityFilter>('ALL');
  const { data, error, isLoading, refetch } = useTopicGovernance(
    clusterName,
    includeInternal
  );

  if (isLoading) {
    return <PageLoader offsetY={260} />;
  }

  if (!data) {
    return (
      <ErrorPage
        text={
          error?.message ||
          'Topic governance evidence is unavailable for this cluster.'
        }
        onClick={() => refetch()}
      />
    );
  }

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const topics = data.topics.filter((topic) => {
    const matchesQuery =
      !normalizedQuery ||
      topic.name.toLocaleLowerCase().includes(normalizedQuery);
    const matchesSeverity = severity === 'ALL' || topic.severity === severity;
    return matchesQuery && matchesSeverity;
  });

  return (
    <>
      <ResourcePageHeading text="Topic Governance Advisor">
        <Button buttonType="secondary" buttonSize="M" onClick={() => refetch()}>
          Refresh
        </Button>
      </ResourcePageHeading>
      <S.Page>
        <S.Controls aria-label="Topic governance filters">
          <S.FilterLabel>
            <span>Topic</span>
            <S.FilterInput
              aria-label="Filter topics"
              placeholder="Filter by topic name"
              value={query}
              onChange={({ target }) => setQuery(target.value)}
            />
          </S.FilterLabel>
          <S.FilterLabel>
            <span>Severity</span>
            <S.FilterSelect
              aria-label="Severity"
              value={severity}
              onChange={({ target }) =>
                setSeverity(target.value as SeverityFilter)
              }
            >
              <option value="ALL">All severities</option>
              <option value={TopicGovernanceTopicSeverityEnum.CRITICAL}>
                Critical
              </option>
              <option value={TopicGovernanceTopicSeverityEnum.WARNING}>
                Warning
              </option>
              <option value={TopicGovernanceTopicSeverityEnum.INFO}>
                Info
              </option>
              <option value={TopicGovernanceTopicSeverityEnum.HEALTHY}>
                Healthy
              </option>
            </S.FilterSelect>
          </S.FilterLabel>
          <S.Toggle>
            <input
              type="checkbox"
              checked={includeInternal}
              onChange={({ target }) => setIncludeInternal(target.checked)}
            />
            Include system topics
          </S.Toggle>
          <S.SampledAt>
            Sampled {new Date(data.collectedAtMs).toLocaleTimeString()} from{' '}
            {formatNumber(data.brokerCount)} broker(s)
          </S.SampledAt>
        </S.Controls>

        <S.Summary aria-label="Topic governance summary">
          <S.Metric $tone="critical">
            <strong>{formatNumber(data.summary.criticalTopics)}</strong>
            <span>Critical</span>
          </S.Metric>
          <S.Metric $tone="warning">
            <strong>{formatNumber(data.summary.warningTopics)}</strong>
            <span>Warnings</span>
          </S.Metric>
          <S.Metric $tone="info">
            <strong>{formatNumber(data.summary.infoTopics)}</strong>
            <span>Informational</span>
          </S.Metric>
          <S.Metric $tone="good">
            <strong>{formatNumber(data.summary.healthyTopics)}</strong>
            <span>Healthy</span>
          </S.Metric>
          <S.Metric $tone="info">
            <strong>{formatNumber(data.summary.totalTopics)}</strong>
            <span>Visible topics</span>
          </S.Metric>
        </S.Summary>

        <S.Rule>{data.namingRule}</S.Rule>

        <S.Evidence aria-labelledby="topic-governance-topics-heading">
          <S.EvidenceHeader>
            <S.EvidenceTitle id="topic-governance-topics-heading">
              Topic recommendations
            </S.EvidenceTitle>
            <S.PageState>
              Showing {formatNumber(topics.length)} of{' '}
              {formatNumber(data.topics.length)}
            </S.PageState>
          </S.EvidenceHeader>
          {topics.length === 0 ? (
            <S.Empty>No topics match the selected governance filters.</S.Empty>
          ) : (
            <S.TableViewport>
              <S.Table>
                <thead>
                  <tr>
                    <th>Topic</th>
                    <th>Score</th>
                    <th>Posture</th>
                    <th>Partitions / replicas</th>
                    <th>Message / storage</th>
                    <th>Cached settings</th>
                    <th>Evidence availability</th>
                    <th>Recommendations</th>
                  </tr>
                </thead>
                <tbody>
                  {topics.map((topic) => (
                    <tr key={topic.name}>
                      <td>
                        <S.ResourceLink
                          to={clusterTopicPath(clusterName, topic.name)}
                        >
                          {topic.name}
                        </S.ResourceLink>
                        <S.Detail>{topic.classification}</S.Detail>
                      </td>
                      <td>
                        <S.Score $tone={scoreTone(topic.score)}>
                          {topic.score}
                        </S.Score>
                      </td>
                      <td>
                        <S.Severity $tone={severityTone(topic.severity)}>
                          {topic.severity}
                        </S.Severity>
                        <S.Detail>
                          {topic.namingCompliant
                            ? 'Naming matches advisor rule'
                            : 'Naming needs review'}
                        </S.Detail>
                      </td>
                      <td>
                        {formatNumber(topic.partitionCount)} /{' '}
                        {formatNumber(topic.replicationFactor)}
                        <S.Detail>
                          {formatNumber(topic.underReplicatedPartitions)} under
                          replicated ·{' '}
                          {formatNumber(topic.noInSyncReplicaPartitions)}{' '}
                          without ISR
                        </S.Detail>
                      </td>
                      <td>
                        {topic.messageCount === undefined
                          ? 'Message count unavailable'
                          : `${formatNumber(topic.messageCount)} records`}
                        <S.Detail>
                          {topic.storageBytes === undefined
                            ? 'Storage unavailable'
                            : `${formatBytes(topic.storageBytes)} stored`}
                        </S.Detail>
                      </td>
                      <td>
                        <SettingsEvidence topic={topic} />
                      </td>
                      <td>
                        <S.Availability>
                          {availability(topic).map((item) => (
                            <S.AvailabilityItem
                              key={item.label}
                              $available={item.available}
                            >
                              {item.label}
                            </S.AvailabilityItem>
                          ))}
                        </S.Availability>
                      </td>
                      <td>
                        <Recommendations
                          recommendations={topic.recommendations}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </S.Table>
            </S.TableViewport>
          )}
        </S.Evidence>
      </S.Page>
    </>
  );
};

export default TopicGovernance;
