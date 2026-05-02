import styled, { css } from 'styled-components';
import { Link } from 'react-router-dom';

export const Page = styled.div`
  min-width: 0;
  padding: 0 16px 24px;
`;

export const Controls = styled.section`
  display: grid;
  grid-template-columns: minmax(220px, 1.5fr) minmax(180px, 1fr) repeat(
      3,
      minmax(130px, 0.5fr)
    );
  align-items: end;
  gap: 12px;
  margin-bottom: 16px;

  @media screen and (max-width: ${({ theme }) => theme.breakpoints.L}px) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  @media screen and (max-width: ${({ theme }) => theme.breakpoints.S}px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

export const FilterLabel = styled.label`
  display: grid;
  gap: 6px;
  min-width: 0;
  color: ${({ theme }) => theme.default.color.normal};
  font-size: 13px;
  font-weight: 500;
`;

const controlStyles = css`
  width: 100%;
  min-width: 0;
  min-height: 36px;
  border: 1px solid ${({ theme }) => theme.layout.stuffBorderColor};
  border-radius: 3px;
  background: ${({ theme }) => theme.default.backgroundColor};
  color: ${({ theme }) => theme.default.color.normal};
  font: inherit;
  padding: 7px 9px;

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.link.color};
    outline-offset: 1px;
  }
`;

export const FilterInput = styled.input`
  ${controlStyles}
`;

export const FilterSelect = styled.select`
  ${controlStyles}
`;

export const Toggle = styled.label`
  display: inline-flex;
  align-items: center;
  min-height: 36px;
  gap: 8px;
  color: ${({ theme }) => theme.default.color.normal};
  font-size: 13px;
  font-weight: 500;
`;

export const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

export const Summary = styled.section`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-bottom: 18px;
  border: 1px solid ${({ theme }) => theme.layout.stuffBorderColor};
  background: ${({ theme }) => theme.metrics.backgroundColor};

  @media screen and (max-width: ${({ theme }) => theme.breakpoints.M}px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

export const Metric = styled.div`
  min-width: 0;
  padding: 14px 16px;
  border-right: 1px solid ${({ theme }) => theme.layout.stuffBorderColor};
  border-bottom: 1px solid ${({ theme }) => theme.layout.stuffBorderColor};
  background: ${({ theme }) => theme.default.backgroundColor};

  strong {
    display: block;
    color: ${({ theme }) => theme.link.color};
    font-size: 22px;
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  span {
    color: ${({ theme }) => theme.metrics.indicator.titleColor};
    font-size: 12px;
    font-weight: 500;
  }
`;

export const Notice = styled.p`
  margin: 0 0 18px;
  border-left: 3px solid ${({ theme }) => theme.circularAlert.color.warning};
  padding: 10px 12px;
  background: ${({ theme }) => theme.layout.stuffColor};
  color: ${({ theme }) => theme.default.color.normal};
  font-size: 13px;
`;

export const Section = styled.section`
  min-width: 0;
  margin-bottom: 20px;
`;

export const SectionHeader = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
`;

export const SectionTitle = styled.h2`
  margin: 0;
  color: ${({ theme }) => theme.default.color.normal};
  font-size: 18px;
  font-weight: 600;
`;

export const SectionHint = styled.span`
  color: ${({ theme }) => theme.default.color.normal};
  font-size: 12px;
  opacity: 0.75;
`;

export const TableViewport = styled.div`
  max-width: 100%;
  overflow-x: auto;
  border: 1px solid ${({ theme }) => theme.layout.stuffBorderColor};
`;

export const Table = styled.table`
  width: 100%;
  min-width: 1080px;
  border-collapse: collapse;
  color: ${({ theme }) => theme.table.td.color.normal};
  font-size: 13px;

  th,
  td {
    padding: 10px 12px;
    border-bottom: 1px solid ${({ theme }) => theme.table.td.borderTop};
    text-align: left;
    vertical-align: top;
  }

  th {
    color: ${({ theme }) => theme.table.th.color.normal};
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
  }

  tbody tr:last-child td {
    border-bottom: 0;
  }
`;

export const ResourceLink = styled(Link)`
  color: ${({ theme }) => theme.link.color};
  font-weight: 600;

  &:hover {
    color: ${({ theme }) => theme.link.hoverColor};
  }
`;

export const Content = styled.pre`
  max-width: 340px;
  max-height: 180px;
  margin: 0;
  overflow: auto;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  color: ${({ theme }) => theme.default.color.normal};
  font: inherit;
  font-size: 12px;
`;

export const Muted = styled.span`
  color: ${({ theme }) => theme.default.color.normal};
  font-size: 12px;
  opacity: 0.72;
`;

export const Empty = styled.p`
  margin: 0;
  padding: 18px;
  border: 1px solid ${({ theme }) => theme.layout.stuffBorderColor};
  color: ${({ theme }) => theme.default.color.normal};
  font-size: 13px;
  opacity: 0.75;
`;
