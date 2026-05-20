import styled, { css, DefaultTheme } from 'styled-components';
import { Link } from 'react-router-dom';
import {
  TopicDeveloperMetricTone,
  TopicDeveloperRecommendationSeverity,
} from 'generated-sources';

const toneColor = (theme: DefaultTheme, tone: TopicDeveloperMetricTone) => {
  switch (tone) {
    case TopicDeveloperMetricTone.CRITICAL:
      return theme.circularAlert.color.error;
    case TopicDeveloperMetricTone.WARNING:
      return theme.circularAlert.color.warning;
    case TopicDeveloperMetricTone.SUCCESS:
      return theme.circularAlert.color.success;
    case TopicDeveloperMetricTone.INFO:
      return theme.link.color;
    default:
      return theme.default.color.normal;
  }
};

const recommendationColor = (
  theme: DefaultTheme,
  severity: TopicDeveloperRecommendationSeverity
) => {
  switch (severity) {
    case TopicDeveloperRecommendationSeverity.CRITICAL:
      return theme.circularAlert.color.error;
    case TopicDeveloperRecommendationSeverity.WARNING:
      return theme.circularAlert.color.warning;
    default:
      return theme.link.color;
  }
};

export const Page = styled.div`
  min-width: 0;
  padding: 24px 16px;
`;

export const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;

  @media screen and (max-width: ${({ theme }) => theme.breakpoints.S}px) {
    align-items: stretch;
    flex-direction: column;
  }
`;

export const ReportTitle = styled.div`
  display: grid;
  gap: 4px;

  span {
    color: ${({ theme }) => theme.default.color.normal};
    font-size: 22px;
    font-weight: 600;
  }

  small {
    color: ${({ theme }) => theme.default.color.normal};
    font-size: 12px;
    opacity: 0.7;
  }
`;

export const HealthBand = styled.section<{ $tone: TopicDeveloperMetricTone }>(
  ({ theme, $tone }) => css`
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 16px;
    margin-bottom: 16px;
    padding: 16px;
    border: 1px solid ${toneColor(theme, $tone)};
    background: ${theme.metrics.backgroundColor};

    @media screen and (max-width: ${theme.breakpoints.S}px) {
      grid-template-columns: auto minmax(0, 1fr);
    }
  `
);

export const HealthScore = styled.strong`
  color: ${({ theme }) => theme.default.color.normal};
  font-size: 34px;
  font-weight: 600;
`;

export const HealthCopy = styled.div`
  display: grid;
  gap: 4px;
  min-width: 0;

  strong {
    color: ${({ theme }) => theme.default.color.normal};
    font-size: 16px;
  }

  span {
    color: ${({ theme }) => theme.default.color.normal};
    font-size: 13px;
    opacity: 0.72;
  }
`;

export const HealthMeta = styled.div`
  display: grid;
  gap: 4px;
  color: ${({ theme }) => theme.default.color.normal};
  font-size: 12px;
  text-align: right;
  opacity: 0.78;

  @media screen and (max-width: ${({ theme }) => theme.breakpoints.S}px) {
    grid-column: 1 / -1;
    text-align: left;
  }
`;

export const WorkflowSection = styled.section`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
`;

export const WorkflowLink = styled(Link)`
  padding: 7px 10px;
  border: 1px solid ${({ theme }) => theme.layout.stuffBorderColor};
  color: ${({ theme }) => theme.link.color};
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;

  &:hover {
    border-color: ${({ theme }) => theme.link.color};
    color: ${({ theme }) => theme.link.hoverColor};
  }
`;

export const Recommendations = styled.section`
  margin-bottom: 24px;
`;

export const SectionTitle = styled.h2`
  margin: 0 0 10px;
  color: ${({ theme }) => theme.default.color.normal};
  font-size: 17px;
  font-weight: 600;
`;

export const RecommendationList = styled.div`
  display: grid;
  gap: 8px;
`;

export const Recommendation = styled.article<{
  $severity: TopicDeveloperRecommendationSeverity;
}>(
  ({ theme, $severity }) => css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 14px;
    border-left: 3px solid ${recommendationColor(theme, $severity)};
    background: ${theme.metrics.backgroundColor};

    @media screen and (max-width: ${theme.breakpoints.S}px) {
      align-items: flex-start;
      flex-direction: column;
    }
  `
);

export const RecommendationCopy = styled.div`
  display: grid;
  gap: 4px;
  min-width: 0;

  strong {
    color: ${({ theme }) => theme.default.color.normal};
    font-size: 14px;
  }

  span {
    color: ${({ theme }) => theme.default.color.normal};
    font-size: 13px;
    opacity: 0.75;
  }
`;

export const RecommendationLink = styled(Link)`
  color: ${({ theme }) => theme.link.color};
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
`;

export const MetricSection = styled.section`
  margin-bottom: 24px;
`;

export const MetricGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  border-top: 1px solid ${({ theme }) => theme.layout.stuffBorderColor};
  border-left: 1px solid ${({ theme }) => theme.layout.stuffBorderColor};

  @media screen and (max-width: ${({ theme }) => theme.breakpoints.L}px) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  @media screen and (max-width: ${({ theme }) => theme.breakpoints.M}px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media screen and (max-width: ${({ theme }) => theme.breakpoints.S}px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

export const Metric = styled.article<{ $tone: TopicDeveloperMetricTone }>(
  ({ theme, $tone }) => css`
    display: grid;
    align-content: start;
    gap: 6px;
    min-width: 0;
    min-height: 124px;
    padding: 14px;
    border-right: 1px solid ${theme.layout.stuffBorderColor};
    border-bottom: 1px solid ${theme.layout.stuffBorderColor};
    background: ${theme.default.backgroundColor};

    span {
      color: ${theme.metrics.indicator.titleColor};
      font-size: 12px;
      font-weight: 500;
    }

    strong {
      color: ${toneColor(theme, $tone)};
      font-size: 21px;
      font-weight: 600;
      overflow-wrap: anywhere;
    }

    small {
      color: ${theme.default.color.normal};
      font-size: 12px;
      line-height: 1.4;
      opacity: 0.68;
    }
  `
);
