import React from 'react';
import { render, WithRoute } from 'lib/testHelpers';
import Messages from 'components/Topics/Topic/Messages/Messages';
import { useTopicMessages } from 'lib/hooks/api/topicMessages';
import { screen } from '@testing-library/react';
import { clusterTopicPath } from 'lib/paths';
import { MessagesFilterKeys } from 'lib/constants';

const mockFilterComponents = 'mockFilterComponents';
const mockMessagesTable = 'mockMessagesTable';
const clusterName = 'cluster-name';
const topicName = 'topic-name';

jest.mock('lib/hooks/api/topicMessages', () => ({
  useTopicMessages: jest.fn(),
}));

jest.mock('components/Topics/Topic/Messages/MessagesTable', () => () => (
  <div>{mockMessagesTable}</div>
));

jest.mock('components/Topics/Topic/Messages/Filters/Filters', () => () => (
  <div>{mockFilterComponents}</div>
));

describe('Messages', () => {
  const renderComponent = (queryString = '') => {
    return render(
      <WithRoute path={clusterTopicPath()}>
        <Messages />
      </WithRoute>,
      {
        initialEntries: [
          `${clusterTopicPath(clusterName, topicName)}${queryString}`,
        ],
      }
    );
  };

  beforeEach(() => {
    (useTopicMessages as jest.Mock).mockImplementation(() => ({
      messages: [],
      isFetching: false,
      consumptionStats: undefined,
      phase: undefined,
      abortFetchData: jest.fn(),
    }));
  });

  describe('component rendering default behavior with the search params', () => {
    beforeEach(() => {
      renderComponent();
    });

    it('should check if the filters are shown in the messages', () => {
      expect(screen.getByText(mockFilterComponents)).toBeInTheDocument();
    });

    it('should check if the table of messages are shown in the messages', () => {
      expect(screen.getByText(mockMessagesTable)).toBeInTheDocument();
    });

    it('passes repeated stringFilter params as refinement filters', () => {
      renderComponent(
        `?${MessagesFilterKeys.stringFilter}=first&${MessagesFilterKeys.stringFilter}=second&${MessagesFilterKeys.stringFilter}=third`
      );

      expect(useTopicMessages).toHaveBeenLastCalledWith(
        expect.objectContaining({
          stringFilters: ['second', 'third'],
        })
      );
    });
  });
});
