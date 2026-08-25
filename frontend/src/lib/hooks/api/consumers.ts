import {
  consumerGroupsApiClient as api,
  cooperativeConsumerGroupsApiClient as cooperativeApi,
} from 'lib/api';
import {
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryOptions,
} from '@tanstack/react-query';
import { ClusterName } from 'lib/interfaces/cluster';
import {
  CooperativeConsumerGroupOffsetsResetResponse,
  ConsumerGroup,
  ConsumerGroupDetails,
  ConsumerGroupLag,
  ConsumerGroupOffsetsReset,
  ConsumerGroupOffsetsResetPreview,
  ConsumerGroupOrdering,
  ConsumerGroupsLagResponse,
  ConsumerGroupState,
  ConsumerGroupsPageResponse,
  SortOrder,
} from 'generated-sources';
import { apiFetch, ServerResponse, showSuccessAlert } from 'lib/errorHandling';
import { useEffect, useRef } from 'react';

const MAX_CONSUMER_GROUP_LAG_POLLING_INTERVAL_MS = 30_000;

export type ConsumerGroupID = ConsumerGroup['groupId'];

export const isRetryableConsumerGroupLagError = (error: ServerResponse) => {
  const { status } = error;
  return (
    status === undefined || status === 408 || status === 429 || status >= 500
  );
};

export const getConsumerGroupLagPollingInterval = (
  pollingIntervalSec: number,
  failureCount: number
) => {
  if (pollingIntervalSec <= 0) return false;

  return Math.min(
    pollingIntervalSec * 1000 * 2 ** Math.max(failureCount, 0),
    MAX_CONSUMER_GROUP_LAG_POLLING_INTERVAL_MS
  );
};

type UseConsumerGroupsProps = {
  clusterName: ClusterName;
  orderBy?: ConsumerGroupOrdering;
  sortOrder?: SortOrder;
  page?: number;
  perPage?: number;
  search: string;
  fts?: boolean;
  state?: ConsumerGroupState[];
};

type UseConsumerGroupDetailsProps = {
  clusterName: ClusterName;
  consumerGroupID: ConsumerGroupID;
};

export function useConsumerGroups(
  props: UseConsumerGroupsProps,
  queryOptions?: Omit<
    UseQueryOptions<ConsumerGroupsPageResponse, ServerResponse>,
    'queryKey' | 'queryFn'
  >
) {
  const { clusterName, ...rest } = props;
  return useQuery<ConsumerGroupsPageResponse, ServerResponse>({
    queryKey: ['clusters', clusterName, 'consumerGroups', rest],
    queryFn: () => apiFetch(() => api.getConsumerGroupsPage(props)),
    placeholderData: (previousData) => previousData,
    ...queryOptions,
  });
}

export function useConsumerGroupDetails(
  props: UseConsumerGroupDetailsProps,
  queryOptions?: Omit<
    UseQueryOptions<ConsumerGroupDetails, ServerResponse>,
    'queryKey' | 'queryFn'
  >
) {
  const { clusterName, consumerGroupID } = props;
  return useQuery<ConsumerGroupDetails, ServerResponse>({
    queryKey: ['clusters', clusterName, 'consumerGroups', consumerGroupID],
    queryFn: () =>
      apiFetch(() =>
        api.getConsumerGroup({ clusterName, id: consumerGroupID })
      ),
    ...queryOptions,
  });
}

export const useDeleteConsumerGroupMutation = ({
  clusterName,
  consumerGroupID,
}: UseConsumerGroupDetailsProps) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.deleteConsumerGroup({ clusterName, id: consumerGroupID }),
    onSuccess: () => {
      showSuccessAlert({
        message: `Consumer ${consumerGroupID} group deleted`,
      });
      queryClient.invalidateQueries({
        queryKey: ['clusters', clusterName, 'consumerGroups'],
      });
    },
  });
};

export const useResetConsumerGroupOffsetsMutation = ({
  clusterName,
  consumerGroupID,
}: UseConsumerGroupDetailsProps) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (props: ConsumerGroupOffsetsReset) =>
      api.resetConsumerGroupOffsets({
        clusterName,
        id: consumerGroupID,
        consumerGroupOffsetsReset: props,
      }),
    onSuccess: () => {
      showSuccessAlert({
        message: `Consumer ${consumerGroupID} group offsets reset`,
      });
      queryClient.invalidateQueries({
        queryKey: ['clusters', clusterName, 'consumerGroups'],
      });
    },
  });
};

export const useCooperativeResetConsumerGroupOffsetsMutation = ({
  clusterName,
  consumerGroupID,
}: UseConsumerGroupDetailsProps) => {
  const queryClient = useQueryClient();
  return useMutation<
    CooperativeConsumerGroupOffsetsResetResponse,
    ServerResponse,
    ConsumerGroupOffsetsReset
  >({
    mutationFn: (props) =>
      apiFetch(() =>
        cooperativeApi.cooperativeResetConsumerGroupOffsets({
          clusterName,
          id: consumerGroupID,
          consumerGroupOffsetsReset: props,
        })
      ),
    onSuccess: (response) => {
      showSuccessAlert({
        message: `Consumer ${consumerGroupID} offsets reset while group remained ${response.groupState}`,
      });
      queryClient.invalidateQueries({
        queryKey: ['clusters', clusterName, 'consumerGroups'],
      });
    },
  });
};

type UseConsumerGroupOffsetsResetPreviewProps = UseConsumerGroupDetailsProps & {
  reset: ConsumerGroupOffsetsReset;
  enabled?: boolean;
};

export function useConsumerGroupOffsetsResetPreview({
  clusterName,
  consumerGroupID,
  reset,
  enabled = true,
}: UseConsumerGroupOffsetsResetPreviewProps) {
  return useQuery<ConsumerGroupOffsetsResetPreview, ServerResponse>({
    queryKey: [
      'clusters',
      clusterName,
      'consumerGroups',
      consumerGroupID,
      'offsets',
      'preview',
      reset,
    ],
    queryFn: () =>
      apiFetch(() =>
        api.previewConsumerGroupOffsetsReset({
          clusterName,
          id: consumerGroupID,
          consumerGroupOffsetsReset: reset,
        })
      ),
    enabled: enabled && Boolean(consumerGroupID),
  });
}

export const useDeleteConsumerGroupOffsetsMutation = ({
  clusterName,
  consumerGroupID,
}: UseConsumerGroupDetailsProps) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (topicName: string) =>
      api.deleteConsumerGroupOffsets({
        clusterName,
        id: consumerGroupID,
        topicName,
      }),
    onSuccess: (_, topicName) => {
      showSuccessAlert({
        message: `Consumer ${consumerGroupID} group offsets in topic ${topicName} deleted`,
      });
      queryClient.invalidateQueries({
        queryKey: ['clusters', clusterName, 'consumerGroups'],
      });
    },
  });
};

interface UseGetConsumerGroupsLagProps {
  clusterName: string;
  ids: string[];
  pollingIntervalSec?: number;
  includePartitions?: boolean;
}

export function useGetConsumerGroupsLag({
  clusterName,
  pollingIntervalSec = 0,
  ids,
  includePartitions,
}: UseGetConsumerGroupsLagProps) {
  const pollingEnabled = pollingIntervalSec > 0;
  const lastUpdateRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    lastUpdateRef.current = undefined;
  }, [clusterName, ids.join(',')]);

  return useQuery<ConsumerGroupsLagResponse, ServerResponse>({
    queryKey: [
      'clusters',
      clusterName,
      'consumerGroupsLag',
      ids,
      includePartitions,
    ],
    queryFn: async () => {
      const response = await apiFetch(() =>
        api.getConsumerGroupsLag({
          clusterName,
          ids,
          lastUpdate: lastUpdateRef.current,
          includePartitions,
        })
      );

      lastUpdateRef.current = response.updateTimestamp;
      return response;
    },
    enabled: ids.length > 0,
    refetchInterval: (query) =>
      pollingEnabled
        ? getConsumerGroupLagPollingInterval(
            pollingIntervalSec,
            query.state.fetchFailureCount
          )
        : false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchIntervalInBackground: false,
    retry: (failureCount, error) =>
      failureCount < 1 && isRetryableConsumerGroupLagError(error),
    retryDelay: 1_000,

    select: (data) => {
      const filtered: Record<string, ConsumerGroupLag | undefined> = {};
      ids.forEach((id) => {
        filtered[id] = data.consumerGroups?.[id];
      });

      return {
        updateTimestamp: data.updateTimestamp,
        consumerGroups: filtered,
      } satisfies ConsumerGroupsLagResponse;
    },
  });
}
