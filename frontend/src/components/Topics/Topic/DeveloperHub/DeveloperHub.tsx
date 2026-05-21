import React from 'react';
import { Button } from 'components/common/Button/Button';
import ErrorPage from 'components/ErrorPage/ErrorPage';
import PageLoader from 'components/common/PageLoader/PageLoader';
import {
  TopicDeveloperMetricCategory,
  TopicDeveloperMetricTone,
} from 'generated-sources';
import { useTopicDeveloperInsights } from 'lib/hooks/api/topics';
import useAppParams from 'lib/hooks/useAppParams';
import {
  clusterTopicAclsPath,
  clusterTopicConsumerGroupsPath,
  clusterTopicDataProfilePath,
  clusterTopicDownloadPath,
  clusterTopicMessagesPath,
  clusterTopicSettingsPath,
  clusterTopicStatisticsPath,
  clusterTopicUploadPath,
  RouteParamsClusterTopic,
} from 'lib/paths';

import * as S from './DeveloperHub.styled';

const categoryLabels: Record<TopicDeveloperMetricCategory, string> = {
  [TopicDeveloperMetricCategory.HEALTH]: 'Health and readiness',
  [TopicDeveloperMetricCategory.TOPOLOGY]: 'Topology and replication',
  [TopicDeveloperMetricCategory.STORAGE]: 'Storage and retention',
  [TopicDeveloperMetricCategory.CONFIGURATION]: 'Configuration safety',
  [TopicDeveloperMetricCategory.TRAFFIC]: 'Traffic and producers',
  [TopicDeveloperMetricCategory.CONSUMERS]: 'Consumers and lag',
  [TopicDeveloperMetricCategory.INTEGRATIONS]: 'Integrations',
};

const categoryOrder = Object.values(TopicDeveloperMetricCategory);

const recommendationPaths = (clusterName: string, topicName: string) => ({
  SETTINGS: clusterTopicSettingsPath(clusterName, topicName),
  STATISTICS: clusterTopicStatisticsPath(clusterName, topicName),
  CONSUMERS: clusterTopicConsumerGroupsPath(clusterName, topicName),
  PROFILE: clusterTopicDataProfilePath(clusterName, topicName),
  MESSAGES: clusterTopicMessagesPath(clusterName, topicName),
});

const workflows = (clusterName: string, topicName: string) => [
  { label: 'Messages', to: clusterTopicMessagesPath(clusterName, topicName) },
  { label: 'Profile', to: clusterTopicDataProfilePath(clusterName, topicName) },
  {
    label: 'Statistics',
    to: clusterTopicStatisticsPath(clusterName, topicName),
  },
  {
    label: 'Consumers',
    to: clusterTopicConsumerGroupsPath(clusterName, topicName),
  },
  { label: 'Settings', to: clusterTopicSettingsPath(clusterName, topicName) },
  { label: 'Download', to: clusterTopicDownloadPath(clusterName, topicName) },
  { label: 'Upload', to: clusterTopicUploadPath(clusterName, topicName) },
  { label: 'ACLs', to: clusterTopicAclsPath(clusterName, topicName) },
];

const healthTone = (health: string): TopicDeveloperMetricTone => {
  if (health === 'CRITICAL') return TopicDeveloperMetricTone.CRITICAL;
  if (health === 'ATTENTION') return TopicDeveloperMetricTone.WARNING;
  return TopicDeveloperMetricTone.SUCCESS;
};

const DeveloperHub: React.FC = () => {
  const params = useAppParams<RouteParamsClusterTopic>();
  const { data, error, isLoading, isRefetching, refetch } =
    useTopicDeveloperInsights(params);

  if (isLoading) return <PageLoader offsetY={300} />;

  if (!data) {
    return (
      <ErrorPage
        offsetY={300}
        text={
          error?.message || 'Developer report is unavailable for this topic.'
        }
        onClick={() => refetch()}
      />
    );
  }

  const metricsByCategory = categoryOrder.map((category) => ({
    category,
    metrics: data.metrics.filter((metric) => metric.category === category),
  }));
  const actionPaths = recommendationPaths(params.clusterName, params.topicName);

  return (
    <S.Page>
      <S.Header>
        <S.ReportTitle>
          <span>Developer Hub</span>
          <small>
            Updated {new Date(data.generatedAtMs).toLocaleTimeString()}
          </small>
        </S.ReportTitle>
        <Button
          buttonType="secondary"
          buttonSize="M"
          onClick={() => refetch()}
          disabled={isRefetching}
        >
          {isRefetching ? 'Refreshing' : 'Refresh report'}
        </Button>
      </S.Header>

      <S.HealthBand $tone={healthTone(data.health)}>
        <S.HealthScore>{data.healthScore}</S.HealthScore>
        <S.HealthCopy>
          <strong>{data.health}</strong>
          <span>Topic operational readiness score</span>
        </S.HealthCopy>
        <S.HealthMeta>
          {data.metrics.length} developer signals
          <span>{data.recommendations.length} recommended actions</span>
        </S.HealthMeta>
      </S.HealthBand>

      <S.WorkflowSection aria-label="Developer workflows">
        {workflows(params.clusterName, params.topicName).map((workflow) => (
          <S.WorkflowLink key={workflow.label} to={workflow.to}>
            {workflow.label}
          </S.WorkflowLink>
        ))}
      </S.WorkflowSection>

      <S.Recommendations aria-labelledby="developer-recommendations">
        <S.SectionTitle id="developer-recommendations">
          Recommended next actions
        </S.SectionTitle>
        <S.RecommendationList>
          {data.recommendations.map((recommendation) => {
            const actionPath = recommendation.action
              ? actionPaths[recommendation.action as keyof typeof actionPaths]
              : undefined;
            return (
              <S.Recommendation
                key={recommendation.id}
                $severity={recommendation.severity}
              >
                <S.RecommendationCopy>
                  <strong>{recommendation.title}</strong>
                  <span>{recommendation.detail}</span>
                </S.RecommendationCopy>
                {actionPath && (
                  <S.RecommendationLink to={actionPath}>
                    Open
                  </S.RecommendationLink>
                )}
              </S.Recommendation>
            );
          })}
        </S.RecommendationList>
      </S.Recommendations>

      {metricsByCategory.map(({ category, metrics }) => (
        <S.MetricSection
          key={category}
          aria-labelledby={`developer-${category}`}
        >
          <S.SectionTitle id={`developer-${category}`}>
            {categoryLabels[category]}
          </S.SectionTitle>
          <S.MetricGrid>
            {metrics.map((metric) => (
              <S.Metric
                key={metric.id}
                $tone={metric.tone}
                title={metric.detail}
              >
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                {metric.detail && <small>{metric.detail}</small>}
              </S.Metric>
            ))}
          </S.MetricGrid>
        </S.MetricSection>
      ))}
    </S.Page>
  );
};

export default DeveloperHub;
