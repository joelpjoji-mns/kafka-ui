import styled from 'styled-components';

export const Description = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.modal.contentColor};
  line-height: 1.5;
`;

export const MessagePosition = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin: 16px 0;
  color: ${({ theme }) => theme.table.td.color.normal};
  font-size: 14px;
`;

export const Fields = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;

  @media screen and (max-width: ${({ theme }) => theme.breakpoints.S}px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

export const Field = styled.div`
  min-width: 0;

  & > div {
    width: 100%;
  }
`;

export const ActiveGroupOption = styled.label`
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: 8px;
  cursor: pointer;

  input {
    margin: 3px 0 0;
  }
`;

export const ActiveGroupOptionContent = styled.span`
  display: grid;
  gap: 2px;
`;

export const ActiveGroupOptionTitle = styled.span`
  color: ${({ theme }) => theme.modal.contentColor};
  font-size: 14px;
  font-weight: 600;
`;

export const ActiveGroupOptionHint = styled.span`
  color: ${({ theme }) => theme.input.label.color};
  font-size: 12px;
  line-height: 1.4;
`;

export const Label = styled.label`
  display: block;
  margin-bottom: 6px;
  color: ${({ theme }) => theme.input.label.color};
  font-size: 12px;
  font-weight: 600;
`;

export const Empty = styled.p`
  grid-column: 1 / -1;
  margin: 0;
  color: ${({ theme }) => theme.default.color.normal};
  font-size: 14px;
`;

export const ChangePlan = styled.section`
  grid-column: 1 / -1;
  border: 1px solid ${({ theme }) => theme.input.label.color};
  border-radius: 6px;
  padding: 16px;
`;

export const ChangePlanTitle = styled.h3`
  margin: 0 0 12px;
  color: ${({ theme }) => theme.modal.contentColor};
  font-size: 14px;
`;

export const PlanGrid = styled.dl`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 16px;
  margin: 0;

  @media screen and (max-width: ${({ theme }) => theme.breakpoints.S}px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

export const PlanMetric = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;

  dt {
    color: ${({ theme }) => theme.input.label.color};
    font-size: 12px;
    font-weight: 600;
  }

  dd {
    margin: 0;
    color: ${({ theme }) => theme.table.td.color.normal};
    font-size: 13px;
    text-align: right;
  }
`;

export const PlanStatus = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.default.color.normal};
  font-size: 14px;
`;

export const PlanImpact = styled.p`
  margin: 12px 0 0;
  color: ${({ theme }) => theme.table.td.color.normal};
  font-size: 14px;
  font-weight: 600;
`;

export const PlanWarning = styled.p`
  margin: 8px 0 0;
  color: ${({ theme }) => theme.default.color.normal};
  font-size: 13px;
`;

export const PlanNotice = styled.p`
  margin: 8px 0 0;
  color: ${({ theme }) => theme.default.color.normal};
  font-size: 12px;
`;

export const PlanError = styled(PlanStatus)`
  color: ${({ theme }) => theme.default.color.normal};
`;

export const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  width: 100%;

  @media screen and (max-width: ${({ theme }) => theme.breakpoints.S}px) {
    flex-direction: column-reverse;

    & > * {
      width: 100%;
    }
  }
`;
