import React from 'react';

import * as S from './Logo.styled';

const Logo: React.FC = () => {
  return (
    <S.Logo
      width="30"
      height="23"
      viewBox="0 0 30 23"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M1.5 11.2C3.7 8.9 5.8 8.4 8 9.3L9.1 4.8L12.1 7.5L15 2.6L17.9 7.5L20.9 4.8L22 9.3C24.2 8.4 26.3 8.9 28.5 11.2L24.9 10.9L26.4 15C23.8 14 21.8 14.6 20.1 16.5C18.7 18.1 17 19.2 15 19.9C13 19.2 11.3 18.1 9.9 16.5C8.2 14.6 6.2 14 3.6 15L5.1 10.9L1.5 11.2Z" />
    </S.Logo>
  );
};

export default Logo;
