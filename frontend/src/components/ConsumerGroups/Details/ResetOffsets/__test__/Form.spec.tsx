import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from 'lib/testHelpers';
import { ConsumerGroupOffsetsResetType } from 'generated-sources';
import useAppParams from 'lib/hooks/useAppParams';
import {
  useCooperativeResetConsumerGroupOffsetsMutation,
  useResetConsumerGroupOffsetsMutation,
} from 'lib/hooks/api/consumers';
import Form from 'components/ConsumerGroups/Details/ResetOffsets/Form';

jest.mock('lib/hooks/useAppParams', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('lib/hooks/api/consumers', () => ({
  useCooperativeResetConsumerGroupOffsetsMutation: jest.fn(),
  useResetConsumerGroupOffsetsMutation: jest.fn(),
}));

jest.mock('lib/hooks/useTimezones', () => ({
  useTimezone: () => ({
    getDateInCurrentTimezone: (date: Date) => date,
  }),
}));

describe('ResetOffsets Form', () => {
  beforeEach(() => {
    (useAppParams as jest.Mock).mockReturnValue({
      clusterName: 'test-cluster',
      consumerGroupID: 'orders-group',
    });
    (useResetConsumerGroupOffsetsMutation as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    });
    (
      useCooperativeResetConsumerGroupOffsetsMutation as jest.Mock
    ).mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    });
  });

  it('makes stable mode mutually exclusive with waiting for inactivity', async () => {
    render(
      <Form
        defaultValues={{
          topic: 'orders',
          resetType: ConsumerGroupOffsetsResetType.EARLIEST,
          partitionsOffsets: [],
          resetToTimestamp: Date.now(),
          waitForInactive: true,
        }}
        topics={['orders']}
        partitions={[
          {
            topic: 'orders',
            partition: 0,
          },
        ]}
      />,
      {
        globalSettings: {
          hasDynamicConfig: false,
          hasCooperativeOffsetReset: true,
        },
      }
    );

    expect(
      screen.getByRole('checkbox', {
        name: /Wait for an active consumer group to become inactive/,
      })
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('checkbox', {
        name: /Keep the consumer group STABLE/,
      })
    );

    expect(
      screen.queryByRole('checkbox', {
        name: /Wait for an active consumer group to become inactive/,
      })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Reset and keep STABLE' })
    ).toBeInTheDocument();
  });

  it('hides stable mode when cooperative reset is disabled', () => {
    render(
      <Form
        defaultValues={{
          topic: 'orders',
          resetType: ConsumerGroupOffsetsResetType.EARLIEST,
          partitionsOffsets: [],
          resetToTimestamp: Date.now(),
          waitForInactive: true,
        }}
        topics={['orders']}
        partitions={[{ topic: 'orders', partition: 0 }]}
      />
    );

    expect(
      screen.queryByRole('checkbox', {
        name: /Keep the consumer group STABLE/,
      })
    ).not.toBeInTheDocument();
  });
});
