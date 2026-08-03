import { LOCAL_STORAGE_KEY_PREFIX } from 'lib/constants';
import { ClusterName } from 'lib/interfaces/cluster';
import { TopicName } from 'lib/interfaces/topic';

const storageKey = `${LOCAL_STORAGE_KEY_PREFIX}-message-view-filter-snapshots`;

type Snapshots = Record<string, string>;

const snapshotId = (clusterName: ClusterName, topicName: TopicName) =>
  `${clusterName}:${topicName}`;

const readSnapshots = (): Snapshots => {
  try {
    const serialized = sessionStorage.getItem(storageKey);
    if (!serialized) {
      return {};
    }

    const parsed: unknown = JSON.parse(serialized);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => typeof value === 'string')
    );
  } catch {
    return {};
  }
};

export const saveMessageViewFilterSnapshot = (
  clusterName: ClusterName,
  topicName: TopicName,
  searchParams: URLSearchParams
) => {
  try {
    const snapshots = readSnapshots();
    snapshots[snapshotId(clusterName, topicName)] = searchParams.toString();
    sessionStorage.setItem(storageKey, JSON.stringify(snapshots));
  } catch {
    // Session storage is optional in embedded or privacy-restricted browser contexts.
  }
};

export const getMessageViewFilterSnapshot = (
  clusterName: ClusterName,
  topicName: TopicName
): URLSearchParams | undefined => {
  const serialized = readSnapshots()[snapshotId(clusterName, topicName)];
  return serialized === undefined ? undefined : new URLSearchParams(serialized);
};
