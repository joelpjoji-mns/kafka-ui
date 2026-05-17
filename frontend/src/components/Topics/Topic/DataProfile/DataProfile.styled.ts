import styled, { css, DefaultTheme } from 'styled-components';

type Tone = 'good' | 'warning';

const toneColor = (theme: DefaultTheme, tone: Tone) =>
  tone === 'good'
    ? theme.circularAlert.color.success
    : theme.circularAlert.color.warning;

export const Page = styled.div`
  min-width: 0;
  padding: 24px 16px;
`;

export const Controls = styled.section`
  display: grid;
  grid-template-columns: minmax(180px, 240px) auto;
  align-items: end;
  gap: 12px;
  margin-bottom: 16px;

  @media screen and (max-width: ${({ theme }) => theme.breakpoints.S}px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

export const ControlLabel = styled.label`
  display: grid;
  gap: 6px;
  min-width: 0;
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
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-bottom: 18px;
  border: 1px solid ${({ theme }) => theme.layout.stuffBorderColor};
  background: ${({ theme }) => theme.metrics.backgroundColor};

  @media screen and (max-width: ${({ theme }) => theme.breakpoints.M}px) {
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

export const Split = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;

  @media screen and (max-width: ${({ theme }) => theme.breakpoints.M}px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

export const Section = styled.section`
  min-width: 0;
  margin-bottom: 18px;
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
  min-width: 680px;
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

export const NameList = styled.ul`
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 12px;
  border: 1px solid ${({ theme }) => theme.layout.stuffBorderColor};
  list-style: none;

  li {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 8px;
  }

  span {
    color: ${({ theme }) => theme.default.color.normal};
    font-size: 12px;
    opacity: 0.72;
  }
`;

export const TypeList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;

  span {
    color: ${({ theme }) => theme.link.color};
    font-size: 12px;
    font-weight: 600;
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
