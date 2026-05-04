import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecordExplorerResponse } from 'generated-sources';
import { render } from 'lib/testHelpers';
import { useRecordExplorer } from 'lib/hooks/api/recordExplorer';
import useAppParams from 'lib/hooks/useAppParams';
import RecordExplorer from 'components/RecordExplorer/RecordExplorer';

const refetch = jest.fn();

jest.mock('lib/hooks/api/recordExplorer', () => ({
  useRecordExplorer: jest.fn(),
}));

jest.mock('lib/hooks/useAppParams', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const response: RecordExplorerResponse = {
  query: 'customer',
  collectedAtMs: Date.UTC(2026, 7, 15, 10, 0),
  visibleTopicCount: 10,
  topicLimit: 8,
  topicLimitReached: true,
  topicsScanned: 8,
  perTopicSampleLimit: 25,
  sampledRecords: 200,
  resultLimit: 100,
  resultLimitReached: false,
  coverage: [
    { topic: 'orders', sampledRecords: 25, matchedRecords: 1 },
    { topic: 'payments', sampledRecords: 25, matchedRecords: 0 },
  ],
  records: [
    {
      topic: 'orders',
      partition: 1,
      offset: 42,
      timestamp: new Date(Date.UTC(2026, 7, 15, 10, 0)),
      key: 'order-42',
      value: '{"customer":"customer-42"}',
      headers: { source: 'web' },
      keySize: 8,
      valueSize: 26,
      headersSize: 9,
    },
  ],
};

describe('RecordExplorer', () => {
  beforeEach(() => {
    refetch.mockReset();
    (useAppParams as jest.Mock).mockReturnValue({ clusterName: 'local' });
    (useRecordExplorer as jest.Mock).mockReturnValue({
      data: response,
      error: undefined,
      isLoading: false,
      isRefetching: false,
      refetch,
    });
  });

  it('waits for an explicit query before rendering record evidence', () => {
    render(<RecordExplorer />);

    expect(
      screen.getByText(
        'Enter a search term to inspect a bounded recent sample of readable topics.'
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Matching record evidence')
    ).not.toBeInTheDocument();
  });

  it('searches bounded evidence, reports scope, and links to topic messages', async () => {
    const user = userEvent.setup();
    render(<RecordExplorer />);

    await user.type(
      screen.getByRole('textbox', { name: 'Search text' }),
      'customer'
    );
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(useRecordExplorer).toHaveBeenLastCalledWith(
      'local',
      expect.objectContaining({ query: 'customer', topicLimit: 8 })
    );
    expect(screen.getByText('Matching record evidence')).toBeInTheDocument();
    expect(
      screen.getByText('Only the first 8 readable topics were sampled.', {
        exact: false,
      })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'orders' })).toHaveAttribute(
      'href',
      '/ui/clusters/local/all-topics/orders/messages'
    );
    expect(
      screen.getByText('customer-42', { exact: false })
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(
      screen.getByText(
        'Enter a search term to inspect a bounded recent sample of readable topics.'
      )
    ).toBeInTheDocument();
  });
});
