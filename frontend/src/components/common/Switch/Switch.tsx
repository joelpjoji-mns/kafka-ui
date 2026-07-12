import React from 'react';

import * as S from './Switch.styled';

export interface SwitchProps {
  onChange(): void;
  checked: boolean;
  name: string;
  ariaLabel?: string;
}
const Switch: React.FC<SwitchProps> = ({
  name,
  checked,
  onChange,
  ariaLabel,
}) => {
  return (
    <S.StyledLabel>
      <S.StyledInput
        name={name}
        type="checkbox"
        onChange={onChange}
        checked={checked}
        aria-label={ariaLabel}
      />
      <S.StyledSlider checked={checked} />
    </S.StyledLabel>
  );
};

export default Switch;
