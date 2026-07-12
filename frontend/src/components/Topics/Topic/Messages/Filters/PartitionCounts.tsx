import React, { useMemo } from 'react';
import styled from 'styled-components';
import FlexBox from 'components/common/FlexBox/FlexBox';

export interface PartitionCountsProps {
  partitionCounts: Record<number, number>;
  total: number;
}

const CountsBar = styled(FlexBox)`
  border-top: 1px dashed ${({ theme }) => theme.select.borderColor.normal};
  padding: 8px 0 0 0;
`;

const TotalPill = styled.span`
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 10px;
  border-radius: 11px;
  background-color: ${({ theme }) => theme.layout.stuffColor};
  color: ${({ theme }) => theme.default.color.normal};
  font-size: 12px;
  font-weight: 600;
`;

const PartitionPill = styled.span`
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border-radius: 11px;
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
  margin-right: 4px;
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
    <CountsBar
      gap="8px"
      alignItems="center"
      flexWrap="wrap"
      padding="8px 0 0"
    >
      <Label>Loaded messages:</Label>
      <TotalPill data-testid="partition-counts-total">Total {total}</TotalPill>
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
