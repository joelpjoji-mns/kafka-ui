import { act, renderHook, waitFor } from '@testing-library/react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { renderQueryHook, TestQueryClientProvider } from 'lib/testHelpers';
import * as hooks from 'lib/hooks/api/topicMessages';
import fetchMock from 'fetch-mock';
import { UseQueryResult, UseSuspenseQueryResult } from '@tanstack/react-query';
import { SerdeUsage, TopicMessageEventTypeEnum } from 'generated-sources';
import { MessagesFilterKeys } from 'lib/constants';
import { MemoryRouter } from 'react-router-dom';
import { createElement, type PropsWithChildren } from 'react';

const clusterName = 'test-cluster';
const topicName = 'test-topic';

const expectQueryWorks = async (
  mock: fetchMock.FetchMockStatic,
  result: {
    current:
      | UseQueryResult<unknown, unknown>
      | UseSuspenseQueryResult<unknown, unknown>;
  }
) => {
  await waitFor(() => expect(result.current.isFetched).toBeTruthy());
  expect(mock.calls()).toHaveLength(1);
  expect(result.current.data).toBeDefined();
};

jest.mock('lib/errorHandling', () => ({
  ...jest.requireActual('lib/errorHandling'),
  showServerError: jest.fn(),
}));

jest.mock('@microsoft/fetch-event-source', () => ({
  fetchEventSource: jest.fn(),
}));

const MessagesHookRouter = ({ children }: PropsWithChildren) =>
  createElement(MemoryRouter, null, children);

const TimeRangeMessagesHookRouter = ({ children }: PropsWithChildren) =>
  createElement(
    MemoryRouter,
    {
      initialEntries: [
        '/?mode=FROM_TIMESTAMP&timestamp=1704067200000&timestampTo=1704153600000',
      ],
    },
    children
  );

describe('Topic Messages hooks', () => {
  const createObjectURL = jest.fn(() => 'blob:messages');
  const revokeObjectURL = jest.fn();
  const click = jest
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation();

  beforeEach(() => {
    fetchMock.restore();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURL,
    });
    createObjectURL.mockClear();
    createObjectURL.mockReturnValue('blob:messages');
    revokeObjectURL.mockClear();
    click.mockClear();
    (fetchEventSource as jest.Mock).mockResolvedValue(undefined);
  });

  it('handles useSerdes', async () => {
    const path = `/api/clusters/${clusterName}/topics/${topicName}/serdes?use=SERIALIZE`;

    const mock = fetchMock.getOnce(path, {});
    const { result } = renderQueryHook(() =>
      hooks.useSerdes({ clusterName, topicName, use: SerdeUsage.SERIALIZE })
    );
    await expectQueryWorks(mock, result);
  });

  it('appends primary and refinement string filters as repeated params', () => {
    const requestParams = new URLSearchParams({ limit: '100' });

    hooks.appendStringFilters(requestParams, 'primary', [
      'secondary',
      '',
      'third',
    ]);

    expect(requestParams.getAll(MessagesFilterKeys.stringFilter)).toEqual([
      'primary',
      'secondary',
      'third',
    ]);
  });

  it('starts a fresh message stream in tailing mode', async () => {
    const { unmount } = renderHook(
      () => hooks.useTopicMessages({ clusterName, topicName }),
      { wrapper: MessagesHookRouter }
    );

    await waitFor(() => {
      expect(fetchEventSource).toHaveBeenCalledWith(
        expect.stringContaining('mode=TAILING'),
        expect.objectContaining({ method: 'GET' })
      );
    });

    unmount();
  });

  it('keeps the recent tailing snapshot ordered before prepending live records', async () => {
    const historicalNewest = { partition: 0, offset: 2, value: 'history-newest' };
    const historicalOldest = { partition: 0, offset: 1, value: 'history-oldest' };
    const liveMessage = { partition: 0, offset: 3, value: 'live-message' };
    const { result, unmount } = renderHook(
      () => hooks.useTopicMessages({ clusterName, topicName }),
      { wrapper: MessagesHookRouter }
    );

    await waitFor(() => expect(fetchEventSource).toHaveBeenCalledTimes(1));

    const options = (fetchEventSource as jest.Mock).mock.calls[0][1];
    await act(async () => {
      await options.onopen({ ok: true, status: 200 });
      options.onmessage({
        data: JSON.stringify({
          type: TopicMessageEventTypeEnum.MESSAGE,
          message: historicalNewest,
        }),
      });
      options.onmessage({
        data: JSON.stringify({
          type: TopicMessageEventTypeEnum.MESSAGE,
          message: historicalOldest,
        }),
      });
      options.onmessage({
        data: JSON.stringify({
          type: TopicMessageEventTypeEnum.PHASE,
          phase: { name: 'Live polling' },
        }),
      });
      options.onmessage({
        data: JSON.stringify({
          type: TopicMessageEventTypeEnum.MESSAGE,
          message: liveMessage,
        }),
      });
    });

    expect(result.current.messages).toEqual([
      liveMessage,
      historicalNewest,
      historicalOldest,
    ]);
    expect(result.current.isLiveStreamReady).toBe(true);

    unmount();
  });

  it('forwards the selected end timestamp to the message stream', async () => {
    const { unmount } = renderHook(
      () => hooks.useTopicMessages({ clusterName, topicName }),
      { wrapper: TimeRangeMessagesHookRouter }
    );

    await waitFor(() => {
      expect(fetchEventSource).toHaveBeenCalledWith(
        expect.stringContaining('timestampTo=1704153600000'),
        expect.objectContaining({ method: 'GET' })
      );
    });

    unmount();
  });

  it('downloads topic messages zip with repeated string filters', async () => {
    const path = `/api/clusters/${clusterName}/topics/${topicName}/messages/download?limit=2&partitions=0%2C1&stringFilter=payload&stringFilter=secondary&smartFilterId=abc123&keySerde=String&valueSerde=String`;
    const mock = fetchMock.getOnce(path, {
      body: 'zip-content',
      headers: {
        'content-type': 'application/zip',
        'content-disposition': "attachment; filename*=UTF-8''messages.zip",
      },
    });
    const { result } = renderHook(() => hooks.useDownloadMessagesZip(), {
      wrapper: TestQueryClientProvider,
    });

    await act(() =>
      result.current.mutateAsync({
        clusterName,
        topicName,
        limit: 2,
        partitions: ['0', '1'],
        stringFilters: ['payload', 'secondary'],
        smartFilterId: 'abc123',
        keySerde: 'String',
        valueSerde: 'String',
      })
    );

    expect(mock.calls()).toHaveLength(1);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:messages');
  });

  it('uploads topic message files', async () => {
    const path = `/api/clusters/${clusterName}/topics/${topicName}/messages/upload`;
    const response = {
      dryRun: true,
      filesReceived: 1,
      entriesRead: 1,
      messagesParsed: 1,
      messagesProduced: 0,
      failures: 0,
      files: [],
      previews: [],
      errors: [],
    };
    const mock = fetchMock.postOnce(path, response);
    const file = new File(['hello'], 'message.txt', { type: 'text/plain' });
    const { result } = renderHook(() => hooks.useUploadMessages(), {
      wrapper: TestQueryClientProvider,
    });

    await act(() =>
      result.current.mutateAsync({
        clusterName,
        topicName,
        files: [file],
        parseMode: 'FILE_PER_MESSAGE',
        partitionStrategy: 'ANY',
        keyMode: 'NONE',
        keySerde: 'String',
        valueSerde: 'String',
        includeMetadataHeaders: true,
        dryRun: true,
        messageLimit: '1000',
      })
    );

    const body = mock.lastCall()?.[1]?.body as FormData;

    expect(mock.calls()).toHaveLength(1);
    expect(body.getAll('files')).toHaveLength(1);
    expect(body.get('parseMode')).toBe('FILE_PER_MESSAGE');
    expect(body.get('dryRun')).toBe('true');
  });
});
