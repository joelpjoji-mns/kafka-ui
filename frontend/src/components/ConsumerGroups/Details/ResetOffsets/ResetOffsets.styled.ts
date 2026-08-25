import styled from 'styled-components';
import SingleDatePicker from 'components/common/SingleDatePicker/SingleDatePicker';

export const OffsetsWrapper = styled.div`
  display: flex;
  width: 100%;
  flex-wrap: wrap;
  gap: 16px;
`;

export const CooperativeOption = styled.label`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: 8px;
  cursor: pointer;

  input {
    margin: 3px 0 0;
  }

  span {
    display: grid;
    gap: 2px;
  }

  strong {
    color: ${({ theme }) => theme.input.label.color};
    font-size: 14px;
  }

  small {
    color: ${({ theme }) => theme.input.label.color};
    font-size: 12px;
    line-height: 1.4;
  }
`;

export const DatePickerInput = styled(SingleDatePicker)`
  height: 40px;
  border: 1px ${({ theme }) => theme.select.borderColor.normal} solid;
  border-radius: 4px;
  font-size: 14px;
  width: min(270px, 100%);
  box-sizing: border-box;
  padding-left: 12px;
  background-color: ${({ theme }) => theme.input.backgroundColor.normal};
  color: ${({ theme }) => theme.input.color.normal};
  &::placeholder {
    color: ${({ theme }) => theme.input.color.normal};
  }
  &:hover {
    cursor: pointer;
  }
  &:focus {
    outline: none;
  }
`;
