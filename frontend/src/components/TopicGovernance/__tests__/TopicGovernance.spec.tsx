import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  TopicGovernanceRecommendationSeverityEnum,
  TopicGovernanceReport,
  TopicGovernanceTopicClassificationEnum,
  TopicGovernanceTopicSeverityEnum,
} from 'generated-sources';
import { render } from 'lib/testHelpers';
import useAppParams from 'lib/hooks/useAppParams';
import { useTopicGovernance } from 'lib/hooks/api/topicGovernance';
import TopicGovernance from 'components/TopicGovernance/TopicGovernance';

const refetch = jest.fn();

jest.mock('lib/hooks/api/topicGovernance', () => ({
  useTopicGovernance: jest.fn(),
}));

jest.mock('lib/hooks/useAppParams', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const report: TopicGovernanceReport = {
  collectedAtMs: Date.UTC(2026, 7, 15, 10, 0),
  brokerCount: 3,
  includedInternalTopics: false,
  namingRule: 'System topics are Kafka-internal or start with _.',
  summary: {
    totalTopics: 2,
    criticalTopics: 1,
    warningTopics: 0,
    infoTopics: 1,
    healthyTopics: 0,
  },
  topics: [
    {
      name: 'orders.billing',
      classification: TopicGovernanceTopicClassificationEnum.APPLICATION,
      namingCompliant: true,
      score: 42,
      severity: TopicGovernanceTopicSeverityEnum.CRITICAL,
      partitionCount: 12,
      replicationFactor: 2,
      underReplicatedPartitions: 1,
      noInSyncReplicaPartitions: 1,
      messageCount: 1_200_000,
      storageBytes: 12_000_000,
      offsetDataAvailable: true,
      storageDataAvailable: true,
      settings: {
        configurationAvailable: true,
        cleanupPolicy: 'delete',
        retentionMs: 604_800_000,
        retentionBytes: -1,
        segmentMs: 3_600_000,
        segmentBytes: 1_073_741_824,
        maxMessageBytes: 1_048_576,
      },
      recommendations: [
        {
          code: 'NO_IN_SYNC_REPLICAS',
          severity: TopicGovernanceRecommendationSeverityEnum.CRITICAL,
          message: 'One or more partitions have no in-sync replicas.',
          evidence: '1 partition without ISR',
        },
      ],
    },
    {
      name: '_consumer_offsets',
      classification: TopicGovernanceTopicClassificationEnum.SYSTEM,
      namingCompliant: true,
      score: 100,
      severity: TopicGovernanceTopicSeverityEnum.INFO,
      partitionCount: 50,
      replicationFactor: 3,
      underReplicatedPartitions: 0,
      noInSyncReplicaPartitions: 0,
      offsetDataAvailable: false,
      storageDataAvailable: false,
      settings: {
        configurationAvailable: false,
      },
      recommendations: [
        {
          code: 'CONFIGURATION_UNAVAILABLE',
          severity: TopicGovernanceRecommendationSeverityEnum.INFO,
          message:
            'Topic configuration evidence is unavailable in the cached snapshot.',
        },
      ],
    },
  ],
};

describe('TopicGovernance', () => {
  beforeEach(() => {
    refetch.mockReset();
    (useAppParams as jest.Mock).mockReturnValue({ clusterName: 'local' });
    (useTopicGovernance as jest.Mock).mockReturnValue({
      data: report,
      error: undefined,
      isLoading: false,
      refetch,
    });
  });

  it('renders cached evidence, recommendations, unavailable indicators, and topic drilldowns', () => {
    render(<TopicGovernance />);

    expect(screen.getByText('Topic Governance Advisor')).toBeInTheDocument();
    expect(
      screen.getByText('System topics are Kafka-internal or start with _.')
    ).toBeInTheDocument();
    expect(screen.getByText('NO IN SYNC REPLICAS')).toBeInTheDocument();
    expect(screen.getByText('Config unavailable')).toBeInTheDocument();
    expect(screen.getByText('Offsets unavailable')).toBeInTheDocument();
    expect(screen.getAllByText('Storage unavailable')).toHaveLength(2);
    expect(
      screen.getByRole('link', { name: 'orders.billing' })
    ).toHaveAttribute('href', '/ui/clusters/local/all-topics/orders.billing');
  });

  it('filters the report and refreshes cached evidence', async () => {
    const user = userEvent.setup();
    render(<TopicGovernance />);

    await user.type(
      screen.getByRole('textbox', { name: 'Filter topics' }),
      'orders'
    );
    expect(screen.getByText('orders.billing')).toBeInTheDocument();
    expect(screen.queryByText('_consumer_offsets')).not.toBeInTheDocument();

    await user.clear(screen.getByRole('textbox', { name: 'Filter topics' }));
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Severity' }),
      TopicGovernanceTopicSeverityEnum.CRITICAL
    );
    expect(screen.getByText('orders.billing')).toBeInTheDocument();
    expect(screen.queryByText('_consumer_offsets')).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('checkbox', { name: 'Include system topics' })
    );
    await user.click(screen.getByRole('button', { name: 'Refresh' }));

    expect(useTopicGovernance).toHaveBeenLastCalledWith('local', true);
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
