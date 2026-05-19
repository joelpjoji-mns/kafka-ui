import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TopicDataProfile, TopicDataProfileJsonType } from 'generated-sources';
import { render } from 'lib/testHelpers';
import { useTopicDataProfile } from 'lib/hooks/api/topics';
import useAppParams from 'lib/hooks/useAppParams';
import DataProfile from 'components/Topics/Topic/DataProfile/DataProfile';

const refetch = jest.fn();

jest.mock('lib/hooks/api/topics', () => ({
  useTopicDataProfile: jest.fn(),
}));

jest.mock('lib/hooks/useAppParams', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const profile: TopicDataProfile = {
  sampled: true,
  sampledAtMs: Date.UTC(2026, 7, 15, 10, 0),
  sampleLimit: 250,
  sampleLimitReached: true,
  sampledRecords: 250,
  totalPartitions: 3,
  sampledPartitions: 3,
  key: {
    presentCount: 230,
    nullCount: 20,
    size: {
      observedCount: 230,
      minBytes: 4,
      maxBytes: 64,
      averageBytes: 18,
      p95Bytes: 42,
    },
  },
  value: {
    presentCount: 250,
    nullCount: 0,
    size: {
      observedCount: 250,
      minBytes: 58,
      maxBytes: 2_400,
      averageBytes: 240,
      p95Bytes: 880,
    },
  },
  headers: {
    recordsWithHeaders: 180,
    totalHeaders: 300,
    names: [
      { name: 'trace-id', occurrenceCount: 180 },
      { name: 'source', occurrenceCount: 120 },
    ],
  },
  json: {
    parsedValueCount: 220,
    objectValueCount: 200,
    topLevelFields: [
      {
        name: 'id',
        presentCount: 200,
        nullCount: 0,
        types: [TopicDataProfileJsonType.STRING],
      },
      {
        name: 'metadata',
        presentCount: 140,
        nullCount: 20,
        types: [TopicDataProfileJsonType.NULL, TopicDataProfileJsonType.OBJECT],
      },
    ],
  },
};

describe('DataProfile', () => {
  beforeEach(() => {
    refetch.mockReset();
    (useAppParams as jest.Mock).mockReturnValue({
      clusterName: 'local',
      topicName: 'orders',
    });
    (useTopicDataProfile as jest.Mock).mockReturnValue({
      data: profile,
      error: undefined,
      isLoading: false,
      isRefetching: false,
      refetch,
    });
  });

  it('renders sampled aggregate evidence without raw record content', () => {
    render(<DataProfile />);

    expect(
      screen.getByText('Presence and byte distribution')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Recent bounded sample collected', { exact: false })
    ).toBeInTheDocument();
    expect(screen.getByText('trace-id')).toBeInTheDocument();
    expect(screen.getByText('metadata')).toBeInTheDocument();
    expect(screen.getByText('OBJECT')).toBeInTheDocument();
    expect(screen.getByText('Sample limit 250 reached')).toBeInTheDocument();
  });

  it('changes the bounded sample size and refreshes the aggregate profile', async () => {
    const user = userEvent.setup();
    render(<DataProfile />);

    await user.click(
      screen.getByRole('listbox', { name: 'Profile sample size' })
    );
    await user.click(screen.getByRole('option', { name: '500 records' }));
    expect(useTopicDataProfile).toHaveBeenLastCalledWith(
      { clusterName: 'local', topicName: 'orders' },
      500
    );

    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
