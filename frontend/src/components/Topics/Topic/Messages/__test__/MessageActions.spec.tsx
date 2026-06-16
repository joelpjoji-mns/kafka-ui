import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from 'lib/testHelpers';
import MessageActions from 'components/Topics/Topic/Messages/MessageActions';
import { TopicActionsProvider } from 'components/contexts/TopicActionsContext';
import useAppParams from 'lib/hooks/useAppParams';

import { mockMessage } from './Message.fixtures';

jest.mock('lib/hooks/useAppParams', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock(
  'components/Topics/Topic/Messages/MessageResetOffsetsModal',
  () => () => <div>reset-offsets-modal</div>
);

describe('MessageActions', () => {
  beforeEach(() => {
    (useAppParams as jest.Mock).mockReturnValue({
      clusterName: 'test-cluster',
      topicName: 'orders',
    });
  });

  it('opens the consumer offset reset flow from the message actions menu', async () => {
    render(
      <TopicActionsProvider openSidebarWithMessage={jest.fn()}>
        <MessageActions message={mockMessage} />
      </TopicActionsProvider>
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Dropdown Toggle' })
    );
    await userEvent.click(
      screen.getByRole('menuitem', { name: 'Reset consumer offset' })
    );

    expect(screen.getByText('reset-offsets-modal')).toBeInTheDocument();
  });
});
