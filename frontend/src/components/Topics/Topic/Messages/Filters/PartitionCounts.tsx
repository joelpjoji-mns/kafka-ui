import React, { useMemo } from 'react';
import styled from 'styled-components';

export interface PartitionCountsProps {
  partitionCounts: Record<number, number>;
  total: number;
}

const CountsBar = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  padding: 4px 0 0;
  color: ${({ theme }) => theme.metrics.filters.color.normal};
  font-size: 12px;
`;

const TotalPill = styled.span`
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 8px;
  border-radius: 4px;
  background-color: ${({ theme }) => theme.layout.stuffColor};
  color: ${({ theme }) => theme.default.color.normal};
  font-size: 12px;
  font-weight: 600;
`;

const PartitionPill = styled.span`
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 6px;
  border-radius: 4px;
  border: 1px solid ${({ theme }) => theme.select.borderColor.normal};
  color: ${({ theme }) => theme.default.color.normal};
  font-size: 12px;
  font-weight: 400;

  strong {
    margin-left: 4px;
    font-weight: 600;
  }
`;

const Label = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.metrics.filters.color.normal};
  margin-right: 2px;
`;

const PartitionCounts: React.FC<PartitionCountsProps> = ({
  partitionCounts,
  total,
}) => {
  const entries = useMemo(
    () =>
      Object.entries(partitionCounts)
        .map(([p, c]) => ({ partition: Number(p), count: c }))
        .sort((a, b) => a.partition - b.partition),
    [partitionCounts]
  );

  if (total === 0) return null;

  return (
    <CountsBar>
      <Label>Loaded</Label>
      <TotalPill data-testid="partition-counts-total">{total}</TotalPill>
      {entries.map(({ partition, count }) => (
        <PartitionPill
          key={partition}
          data-testid={`partition-count-${partition}`}
          title={`Messages loaded from partition #${partition}`}
        >
          P{partition}
          <strong>{count}</strong>
        </PartitionPill>
      ))}
    </CountsBar>
  );
};

export default PartitionCounts;
