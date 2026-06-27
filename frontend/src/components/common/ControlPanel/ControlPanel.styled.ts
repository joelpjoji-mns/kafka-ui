import styled from 'styled-components';

interface Props {
  hasInput?: boolean;
}

export const ControlPanelWrapper = styled.div<Props>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  padding: 0 16px;
  margin: 0 0 16px;
  width: 100%;
  gap: 16px;
  color: ${({ theme }) => theme.default.color.normal};
  & > *:first-child {
    width: ${(props) => (props.hasInput ? '38%' : 'auto')};
    min-width: 0;
  }

  @media screen and (max-width: ${({ theme }) => theme.breakpoints.M}px) {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;

    & > *:first-child {
      width: 100%;
    }
  }
`;
