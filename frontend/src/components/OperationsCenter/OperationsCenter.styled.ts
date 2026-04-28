import styled, { css, DefaultTheme } from 'styled-components';
import { Link } from 'react-router-dom';

type Tone = 'danger' | 'good' | 'neutral' | 'warning';

const toneColor = (theme: DefaultTheme, tone: Tone) => {
  switch (tone) {
    case 'danger':
      return theme.metrics.indicator.warningTextColor;
    case 'good':
      return theme.circularAlert.color.success;
    case 'warning':
      return theme.circularAlert.color.warning;
    default:
      return theme.default.color.normal;
  }
};

export const Page = styled.div`
  min-width: 0;
  padding: 0 16px 24px;
`;

export const Controls = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;

  @media screen and (max-width: ${({ theme }) => theme.breakpoints.S}px) {
    align-items: stretch;
    flex-direction: column;
  }
`;

export const Toggle = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: ${({ theme }) => theme.default.color.normal};
  font-size: 14px;
`;

export const SampledAt = styled.span`
  color: ${({ theme }) => theme.default.color.normal};
  font-size: 13px;
  opacity: 0.75;
`;

export const Band = styled.section`
  margin-bottom: 20px;
  min-width: 0;
`;

export const BandHeader = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
`;

export const BandTitle = styled.h2`
  margin: 0;
  color: ${({ theme }) => theme.default.color.normal};
  font-size: 18px;
  font-weight: 600;
`;

export const HealthGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  border: 1px solid ${({ theme }) => theme.layout.stuffBorderColor};
  background: ${({ theme }) => theme.metrics.backgroundColor};

  @media screen and (max-width: ${({ theme }) => theme.breakpoints.M}px) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  @media screen and (max-width: ${({ theme }) => theme.breakpoints.S}px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

export const Metric = styled.div<{ $tone?: Tone }>(
  ({ theme, $tone = 'neutral' }) => css`
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
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;

  @media screen and (max-width: ${({ theme }) => theme.breakpoints.M}px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

export const Surface = styled.div`
  min-width: 0;
  border: 1px solid ${({ theme }) => theme.layout.stuffBorderColor};
  background: ${({ theme }) => theme.default.backgroundColor};
`;

export const SurfaceHeading = styled.h3`
  margin: 0;
  padding: 12px 16px;
  border-bottom: 1px solid ${({ theme }) => theme.layout.stuffBorderColor};
  color: ${({ theme }) => theme.default.color.normal};
  font-size: 14px;
  font-weight: 600;
`;

export const TableViewport = styled.div`
  max-width: 100%;
  overflow-x: auto;
`;

export const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  color: ${({ theme }) => theme.table.td.color.normal};
  font-size: 13px;

  th,
  td {
    padding: 10px 12px;
    border-bottom: 1px solid ${({ theme }) => theme.table.td.borderTop};
    text-align: left;
    vertical-align: top;
    white-space: nowrap;
  }

  th {
    color: ${({ theme }) => theme.table.th.color.normal};
    font-size: 12px;
    font-weight: 500;
  }

  td:last-child,
  th:last-child {
    text-align: right;
  }
`;

export const ResourceLink = styled(Link)`
  color: ${({ theme }) => theme.link.color};
  font-weight: 500;

  &:hover {
    color: ${({ theme }) => theme.link.hoverColor};
  }
`;

export const RiskSignals = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
`;

export const Risk = styled.span`
  padding: 2px 6px;
  border: 1px solid ${({ theme }) => theme.metrics.indicator.warningTextColor};
  color: ${({ theme }) => theme.metrics.indicator.warningTextColor};
  font-size: 11px;
  font-weight: 500;
`;

export const StateList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 16px;
`;

export const State = styled.span`
  padding: 5px 8px;
  background: ${({ theme }) => theme.layout.stuffColor};
  color: ${({ theme }) => theme.default.color.normal};
  font-size: 12px;
`;

export const Empty = styled.p`
  margin: 0;
  padding: 16px;
  color: ${({ theme }) => theme.default.color.normal};
  font-size: 13px;
  opacity: 0.75;
`;

export const IntegrationGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  border: 1px solid ${({ theme }) => theme.layout.stuffBorderColor};
`;

export const Integration = styled.div<{ $tone: Tone }>(
  ({ theme, $tone }) => css`
    min-width: 0;
    padding: 16px;
    border-right: 1px solid ${theme.layout.stuffBorderColor};
    border-bottom: 1px solid ${theme.layout.stuffBorderColor};

    strong {
      display: block;
      color: ${theme.default.color.normal};
      font-size: 14px;
    }

    span {
      color: ${toneColor(theme, $tone)};
      font-size: 12px;
      font-weight: 500;
    }
  `
);
