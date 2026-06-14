import { Table } from 'components/common/table/Table/Table.styled';
import styled from 'styled-components';

export const TableViewport = styled.div`
  position: relative;
  max-width: 100%;
  overflow-x: auto;
  overscroll-behavior-x: contain;
`;

export const ResizableTable = styled(Table)<{ $width: number }>`
  width: ${({ $width }) => `${$width}px`};
  min-width: 100%;
  table-layout: fixed;

  & td {
    min-width: 0;
    max-width: none;
    overflow: hidden;
  }
`;
