import styled, { css, DefaultTheme } from 'styled-components';
import { Link } from 'react-router-dom';

type Tone = 'critical' | 'good' | 'warning';

const toneColor = (theme: DefaultTheme, tone: Tone) => {
  switch (tone) {
    case 'critical':
      return theme.metrics.indicator.warningTextColor;
    case 'warning':
      return theme.circularAlert.color.warning;
    default:
      return theme.circularAlert.color.success;
  }
};

export const Page = styled.div`
  min-width: 0;
  padding: 24px 16px;
`;

export const Controls = styled.section`
  display: grid;
  grid-template-columns: minmax(240px, 1fr) auto auto;
  align-items: end;
  gap: 12px;
  margin-bottom: 16px;

  @media screen and (max-width: ${({ theme }) => theme.breakpoints.M}px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
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

export const FilterInput = styled.input`
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

export const Toggle = styled.label`
  display: inline-flex;
  align-items: center;
  min-height: 36px;
  gap: 8px;
  color: ${({ theme }) => theme.default.color.normal};
  font-size: 13px;
  font-weight: 500;
`;

export const SampledAt = styled.span`
  grid-column: 1 / -1;
  color: ${({ theme }) => theme.default.color.normal};
  font-size: 13px;
  opacity: 0.75;
`;

export const Summary = styled.section`
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  margin-bottom: 18px;
  border: 1px solid ${({ theme }) => theme.layout.stuffBorderColor};
  background: ${({ theme }) => theme.metrics.backgroundColor};

  @media screen and (max-width: ${({ theme }) => theme.breakpoints.M}px) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  @media screen and (max-width: ${({ theme }) => theme.breakpoints.S}px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

export const Metric = styled.div<{ $tone: Tone }>(
  ({ theme, $tone }) => css`
    min-width: 0;
    padding: 14px 16px;
    border-right: 1px solid ${theme.layout.stuffBorderColor};
    border-bottom: 1px solid ${theme.layout.stuffBorderColor};
    background: ${theme.default.backgroundColor};

    strong {
      display: block;
      color: ${toneColor(theme, $tone)};
      font-size: 22px;
      font-weight: 600;
      overflow-wrap: anywhere;
    }

    span {
      color: ${theme.metrics.indicator.titleColor};
      font-size: 12px;
      font-weight: 500;
    }
  `
);

export const Evidence = styled.section`
  min-width: 0;
`;

export const EvidenceHeader = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
`;

export const EvidenceTitle = styled.h2`
  margin: 0;
  color: ${({ theme }) => theme.default.color.normal};
  font-size: 18px;
  font-weight: 600;
`;

export const PageState = styled.span`
  color: ${({ theme }) => theme.default.color.normal};
  font-size: 13px;
  opacity: 0.75;
`;

export const TableViewport = styled.div`
  max-width: 100%;
  overflow-x: auto;
  border: 1px solid ${({ theme }) => theme.layout.stuffBorderColor};
`;

export const Table = styled.table`
  width: 100%;
  min-width: 1_060px;
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

export const Severity = styled.span<{ $tone: Tone }>(
  ({ theme, $tone }) => css`
    color: ${toneColor(theme, $tone)};
    font-size: 12px;
    font-weight: 700;
  `
);

export const Detail = styled.span`
  display: block;
  margin-top: 4px;
  color: ${({ theme }) => theme.default.color.normal};
  font-size: 12px;
  opacity: 0.72;
`;

export const TaskList = styled.ul`
  display: grid;
  gap: 8px;
  min-width: 180px;
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    display: grid;
    gap: 2px;
  }

  span {
    color: ${({ theme }) => theme.default.color.normal};
    font-size: 12px;
    opacity: 0.72;
  }
`;

export const Trace = styled.pre`
  max-width: 360px;
  margin: 0;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  color: ${({ theme }) => theme.default.color.normal};
  font: inherit;
  font-size: 12px;
  opacity: 0.8;
`;

export const ResourceLink = styled(Link)`
  color: ${({ theme }) => theme.link.color};
  font-weight: 600;

  &:hover {
    color: ${({ theme }) => theme.link.hoverColor};
  }
`;

export const Empty = styled.p`
  margin: 0;
  padding: 18px;
  border: 1px solid ${({ theme }) => theme.layout.stuffBorderColor};
  color: ${({ theme }) => theme.default.color.normal};
  font-size: 13px;
  opacity: 0.75;
`;
