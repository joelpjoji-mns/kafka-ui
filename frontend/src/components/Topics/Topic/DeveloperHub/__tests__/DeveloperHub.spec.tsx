import React from 'react';
import { render } from 'lib/testHelpers';
import { screen } from '@testing-library/react';
import DeveloperHub from 'components/Topics/Topic/DeveloperHub/DeveloperHub';
import {
  TopicDeveloperHealth,
  TopicDeveloperMetricCategory,
  TopicDeveloperMetricTone,
  TopicDeveloperRecommendationSeverity,
} from 'generated-sources';
import { useTopicDeveloperInsights } from 'lib/hooks/api/topics';
import useAppParams from 'lib/hooks/useAppParams';

jest.mock('lib/hooks/api/topics', () => ({
  useTopicDeveloperInsights: jest.fn(),
}));

jest.mock('lib/hooks/useAppParams', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('DeveloperHub', () => {
  beforeEach(() => {
    (useAppParams as jest.Mock).mockReturnValue({
      clusterName: 'local',
      topicName: 'orders',
    });
    (useTopicDeveloperInsights as jest.Mock).mockReturnValue({
      data: {
        generatedAtMs: Date.parse('2026-01-01T00:00:00Z'),
        healthScore: 82,
        health: TopicDeveloperHealth.ATTENTION,
        metrics: [
          {
            id: 'partitions',
            category: TopicDeveloperMetricCategory.TOPOLOGY,
            label: 'Partitions',
            value: '12',
            detail: 'Topic partitions available to producers and consumers',
            tone: TopicDeveloperMetricTone.NEUTRAL,
          },
          {
            id: 'total-lag',
            category: TopicDeveloperMetricCategory.CONSUMERS,
            label: 'Total consumer lag',
            value: '25,000',
            detail: 'Aggregate lag for related consumer groups',
            tone: TopicDeveloperMetricTone.WARNING,
          },
        ],
        recommendations: [
          {
            id: 'consumer-lag',
            severity: TopicDeveloperRecommendationSeverity.WARNING,
            title: 'Investigate consumer lag',
            detail:
              'At least one related consumer group is behind the topic head.',
            action: 'CONSUMERS',
          },
        ],
      },
      isLoading: false,
      isRefetching: false,
      refetch: jest.fn(),
    });
  });

  it('renders operational signals, recommendations, and developer workflows', () => {
    render(<DeveloperHub />);

    expect(screen.getByText('Developer Hub')).toBeInTheDocument();
    expect(screen.getByText('82')).toBeInTheDocument();
    expect(screen.getByText('Partitions')).toBeInTheDocument();
    expect(screen.getByText('Total consumer lag')).toBeInTheDocument();
    expect(screen.getByText('Investigate consumer lag')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Consumers' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Messages' })).toBeInTheDocument();
  });
});
