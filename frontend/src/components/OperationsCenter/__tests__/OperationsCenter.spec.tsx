import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ControllerType,
  OperationsCenterSnapshot,
  OperationsIntegrationStatusEnum,
  ServerStatus,
} from 'generated-sources';
import { render } from 'lib/testHelpers';
import useAppParams from 'lib/hooks/useAppParams';
import { useOperationsCenter } from 'lib/hooks/api/operations';
import OperationsCenter from 'components/OperationsCenter/OperationsCenter';

const refetch = jest.fn();

jest.mock('lib/hooks/api/operations', () => ({
  useOperationsCenter: jest.fn(),
}));

jest.mock('lib/hooks/useAppParams', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const snapshot: OperationsCenterSnapshot = {
  collectedAtMs: Date.UTC(2026, 7, 15, 10, 0),
  health: {
    status: ServerStatus.ONLINE,
    controller: ControllerType.KRAFT,
    score: 82,
    brokerCount: 3,
    offlinePartitions: 0,
    inSyncReplicas: 18,
    outOfSyncReplicas: 1,
    underReplicatedPartitions: 1,
  },
  brokers: {
    skewAvailable: true,
    totalBytes: 1_000_000,
    usableBytes: 500_000,
    brokers: [
      {
        id: 1,
        host: 'broker-1',
        port: 9092,
        leaderCount: 5,
        replicaCount: 6,
        inSyncReplicaCount: 6,
        segmentBytes: 250_000,
        totalBytes: 500_000,
        usableBytes: 250_000,
        partitionSkew: 10,
        leaderSkew: -5,
      },
    ],
  },
  topics: {
    visibleCount: 2,
    internalCount: 0,
    partitions: 6,
    storageBytes: 500_000,
    inboundBytesPerSec: 128,
    outboundBytesPerSec: 64,
    atRisk: [
      {
        name: 'orders',
        internal: false,
        partitionCount: 3,
        replicationFactor: 1,
        underReplicatedPartitions: 1,
        messageCount: 42,
        storageBytes: 300_000,
        riskSignals: ['UNDER_REPLICATED'],
      },
    ],
    largest: [
      {
        name: 'orders',
        internal: false,
        partitionCount: 3,
        replicationFactor: 1,
        underReplicatedPartitions: 1,
        messageCount: 42,
        storageBytes: 300_000,
        riskSignals: ['UNDER_REPLICATED'],
      },
    ],
  },
  consumers: {
    visibleCount: 1,
    totalLag: 27,
    states: [{ state: 'STABLE', count: 1 }],
    worstLagging: [
      {
        groupId: 'orders-consumer',
        state: 'STABLE',
        lag: 27,
        committedPartitions: 3,
      },
    ],
  },
  integrations: {
    schemaRegistry: {
      name: 'Schema Registry',
      status: OperationsIntegrationStatusEnum.AVAILABLE,
    },
    connects: [
      {
        name: 'primary-connect',
        status: OperationsIntegrationStatusEnum.UNAVAILABLE,
        connectorCount: 3,
        failingConnectorCount: 1,
      },
    ],
  },
};

describe('OperationsCenter', () => {
  beforeEach(() => {
    refetch.mockReset();
    (useAppParams as jest.Mock).mockReturnValue({ clusterName: 'local' });
    (useOperationsCenter as jest.Mock).mockReturnValue({
      data: snapshot,
      error: undefined,
      isLoading: false,
      refetch,
    });
  });

  it('renders health, risk, consumer, and integration posture with drilldown links', () => {
    render(<OperationsCenter />);

    expect(screen.getByText('Cluster health')).toBeInTheDocument();
    expect(screen.getByText('82')).toBeInTheDocument();
    expect(screen.getByText('UNDER REPLICATED')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'orders' })).toHaveLength(2);
    screen.getAllByRole('link', { name: 'orders' }).forEach((link) => {
      expect(link).toHaveAttribute(
        'href',
        '/ui/clusters/local/all-topics/orders'
      );
    });
    expect(
      screen.getByRole('link', { name: 'orders-consumer' })
    ).toHaveAttribute(
      'href',
      '/ui/clusters/local/consumer-groups/orders-consumer'
    );
    expect(screen.getByText('AVAILABLE')).toBeInTheDocument();
    expect(screen.getByText('UNAVAILABLE')).toBeInTheDocument();
  });

  it('updates result options and refreshes the snapshot', async () => {
    render(<OperationsCenter />);

    await userEvent.click(
      screen.getByRole('listbox', { name: 'Operations result limit' })
    );
    await userEvent.click(screen.getByRole('option', { name: 'Show top 20' }));
    await userEvent.click(screen.getByText('Include internal topics'));
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    expect(useOperationsCenter).toHaveBeenLastCalledWith('local', true, 20);
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
