import React from 'react';
import styled, { css } from 'styled-components';
import Tooltip from 'components/common/Tooltip/Tooltip';
import WarningRedIcon from 'components/common/Icons/WarningRedIcon';
import { useLocalStorage } from 'lib/hooks/useLocalStorage';

export const CONSUMER_LAG_THRESHOLD_KEY = 'consumer-lag-threshold';

export type LagTrend = 'up' | 'down' | 'same' | 'none';
export type LagValue = number | undefined;
export type LagMap = Record<string, LagValue>;
export type PartitionsLagMap = Record<string, LagMap>;
export type TopicPartitions = Record<
  string,
  { partitions?: LagMap } | undefined
>;
export type LagTrends = {
  groupLagTrends: Record<string, LagTrend>;
  topicsLagTrends: Record<string, LagTrend>;
  partitionsLagTrends: Record<string, Record<string, LagTrend>>;
};

const areLagTrendMapsEqual = (
  first: Record<string, LagTrend>,
  second: Record<string, LagTrend>
) => {
  const firstKeys = Object.keys(first);
  return (
    firstKeys.length === Object.keys(second).length &&
    firstKeys.every((key) => first[key] === second[key])
  );
};

export const areLagTrendsEqual = (first: LagTrends, second: LagTrends) =>
  areLagTrendMapsEqual(first.groupLagTrends, second.groupLagTrends) &&
  areLagTrendMapsEqual(first.topicsLagTrends, second.topicsLagTrends) &&
  Object.keys(first.partitionsLagTrends).length ===
    Object.keys(second.partitionsLagTrends).length &&
  Object.keys(first.partitionsLagTrends).every(
    (topicName) =>
      second.partitionsLagTrends[topicName] !== undefined &&
      areLagTrendMapsEqual(
        first.partitionsLagTrends[topicName],
        second.partitionsLagTrends[topicName]
      )
  );

export function computeSingleLagTrend(
  prev: LagValue,
  next: LagValue
): LagTrend {
  if (
    prev === null ||
    prev === undefined ||
    next === null ||
    next === undefined
  ) {
    return 'none';
  }

  if (next > prev) return 'up';
  if (next < prev) return 'down';
  return 'same';
}

export function computeLagTrends<T>(
  prevLagMap: LagMap,
  source: Record<string, T | undefined>,
  selectLag: (value: T | undefined) => LagValue,
  pollingEnabled = true
): Record<string, LagTrend> {
  if (!pollingEnabled) return {};

  return Object.fromEntries(
    Object.keys(source).map((key) => [
      key,
      computeSingleLagTrend(prevLagMap[key], selectLag(source[key])),
    ])
  );
}

export function computePartitionsLagTrends(
  prevPartitionsMap: PartitionsLagMap,
  topicPartitions: TopicPartitions,
  isPolling: boolean
): Record<string, Record<string, LagTrend>> {
  return Object.fromEntries(
    Object.entries(topicPartitions).map(([topicName, topicLag]) => [
      topicName,
      computeLagTrends(
        prevPartitionsMap[topicName] ?? {},
        topicLag?.partitions ?? {},
        (lag) => lag,
        isPolling
      ),
    ])
  );
}

export function buildNextLagMap<T>(
  source: Record<string, T | undefined>,
  selectLag: (value: T | undefined) => LagValue
): LagMap {
  return Object.fromEntries(
    Object.keys(source).map((key) => [key, selectLag(source[key])])
  );
}

export function buildNextPartitionsLagMap(
  topicPartitions: TopicPartitions
): PartitionsLagMap {
  return Object.fromEntries(
    Object.entries(topicPartitions).map(([topicName, topicLag]) => [
      topicName,
      buildNextLagMap(topicLag?.partitions ?? {}, (lag) => lag),
    ])
  );
}

export const LagContainer = styled.div<{
  $lagTrend: LagTrend;
  $alert?: boolean;
}>`
  display: flex;
  align-items: center;
  gap: 4px;
  color: ${({ theme, $lagTrend }) => theme.lag[$lagTrend]};
  ${({ $alert }) =>
    $alert &&
    css`
      font-weight: 700;
    `}
`;

export const LagTrendComponent = ({
  lag,
  trend,
}: {
  lag: number | string | undefined | null;
  trend?: LagTrend;
}) => {
  const [threshold] = useLocalStorage<number>(CONSUMER_LAG_THRESHOLD_KEY, 0);

  if (lag === undefined || lag === null) return 'N/A';

  const effectiveTrend: LagTrend = trend ?? 'none';
  let trendElement = null;

  if (trend === 'up') {
    trendElement = '▲';
  } else if (trend === 'down') {
    trendElement = '▼';
  }

  const numericLag = typeof lag === 'number' ? lag : Number(lag);
  const exceedsThreshold =
    threshold > 0 && Number.isFinite(numericLag) && numericLag >= threshold;

  return (
    <LagContainer $lagTrend={effectiveTrend} $alert={exceedsThreshold}>
      <span>{lag}</span>
      {trendElement && <span>{trendElement}</span>}
      {exceedsThreshold && (
        <Tooltip
          value={
            <span role="img" aria-label="lag alert">
              <WarningRedIcon />
            </span>
          }
          content={`Lag is at or above the alert threshold (${threshold})`}
          placement="top"
        />
      )}
    </LagContainer>
  );
};
