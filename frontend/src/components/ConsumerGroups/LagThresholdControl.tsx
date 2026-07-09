import React, { ChangeEvent } from 'react';
import styled from 'styled-components';
import Input from 'components/common/Input/Input';
import { useLocalStorage } from 'lib/hooks/useLocalStorage';
import { CONSUMER_LAG_THRESHOLD_KEY } from 'lib/consumerGroups';

const Wrapper = styled.label`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  white-space: nowrap;
  color: ${({ theme }) => theme.input.label.color};
`;

const LagThresholdControl: React.FC = () => {
  const [threshold, setThreshold] = useLocalStorage<number>(
    CONSUMER_LAG_THRESHOLD_KEY,
    0
  );

  const handleChange = ({
    target: { value },
  }: ChangeEvent<HTMLInputElement>) => {
    const digitsOnly = value.replace(/\D/g, '');
    const parsed = Number(digitsOnly);
    setThreshold(Number.isFinite(parsed) && parsed > 0 ? parsed : 0);
  };

  return (
    <Wrapper>
      Lag alert ≥
      <Input
        type="text"
        inputMode="numeric"
        inputSize="M"
        value={threshold === 0 ? '' : String(threshold)}
        placeholder="off"
        aria-label="Consumer lag alert threshold"
        style={{ width: '96px' }}
        onChange={handleChange}
      />
    </Wrapper>
  );
};

export default LagThresholdControl;
