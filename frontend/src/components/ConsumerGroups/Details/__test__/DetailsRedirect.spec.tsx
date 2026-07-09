import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Details from 'components/ConsumerGroups/Details/Details';
import { render, WithRoute } from 'lib/testHelpers';
import {
  clusterConsumerGroupDetailsPath,
  clusterConsumerGroupsPath,
  clusterTopicConsumerGroupsPath,
} from 'lib/paths';
import {
  useConsumerGroupDetails,
  useDeleteConsumerGroupMutation,
} from 'lib/hooks/api/consumers';
import { useConnectors } from 'lib/hooks/api/kafkaConnect';
import { useGetConsumerGroupLagsInfo } from 'components/ConsumerGroups/Details/useGetConsumerGroupLagsInfo';
import { ConsumerGroupState } from 'generated-sources';

const clusterName = 'local';
const groupId = 'groupId1';
const topicName = 'my-topic';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('lib/hooks/api/consumers', () => ({
  useConsumerGroupDetails: jest.fn(),
  useDeleteConsumerGroupMutation: jest.fn(),
}));
jest.mock('lib/hooks/api/kafkaConnect', () => ({
  useConnectors: jest.fn(),
}));
jest.mock(
  'components/ConsumerGroups/Details/useGetConsumerGroupLagsInfo',
  () => ({ useGetConsumerGroupLagsInfo: jest.fn() })
);

const deleteMutateAsync = jest.fn().mockResolvedValue(undefined);

const renderComponent = (state?: { goBackPath: string; goBackText: string }) =>
  render(
    <WithRoute path={clusterConsumerGroupDetailsPath()}>
      <Details />
    </WithRoute>,
    {
      initialEntries: [
        {
          pathname: clusterConsumerGroupDetailsPath(clusterName, groupId),
          state,
        },
      ],
    }
  );

const openDeleteAndConfirm = async () => {
  await userEvent.click(
    screen.getByRole('button', { name: 'Dropdown Toggle' })
  );
  await userEvent.click(
    screen.getByRole('menuitem', { name: 'Delete consumer group' })
  );
  const confirmBtn = screen.getByRole('button', { name: 'Confirm' });
  await waitFor(() => userEvent.click(confirmBtn));
};

describe('ConsumerGroup Details redirect after delete', () => {
  beforeEach(() => {
    (useConsumerGroupDetails as jest.Mock).mockReturnValue({
      data: {
        groupId,
        members: 0,
        topics: 1,
        partitions: [],
        state: ConsumerGroupState.STABLE,
        coordinator: { id: 1 },
      },
      isSuccess: true,
      isLoading: false,
      refetch: jest.fn(),
    });
    (useDeleteConsumerGroupMutation as jest.Mock).mockReturnValue({
      mutateAsync: deleteMutateAsync,
    });
    (useConnectors as jest.Mock).mockReturnValue({ data: [] });
    (useGetConsumerGroupLagsInfo as jest.Mock).mockReturnValue({
      consumerGroupLagInfo: { lag: 0, trend: undefined },
      topicsLagInfo: {},
      partitionsLagInfo: {},
    });
  });

  afterEach(() => jest.clearAllMocks());

  it('returns to the origin topic consumer groups tab when opened from a topic', async () => {
    const goBackPath = clusterTopicConsumerGroupsPath(clusterName, topicName);
    renderComponent({ goBackPath, goBackText: topicName });

    // origin topic name shown as the back link
    expect(screen.getByText(topicName)).toBeInTheDocument();

    await openDeleteAndConfirm();

    await waitFor(() => expect(deleteMutateAsync).toHaveBeenCalled());
    expect(mockNavigate).toHaveBeenCalledWith(goBackPath);
  });

  it('falls back to the global consumers list when opened without a topic origin', async () => {
    renderComponent(undefined);

    expect(screen.getByText('Consumers')).toBeInTheDocument();

    await openDeleteAndConfirm();

    await waitFor(() => expect(deleteMutateAsync).toHaveBeenCalled());
    expect(mockNavigate).toHaveBeenCalledWith(
      clusterConsumerGroupsPath(clusterName)
    );
  });
});
