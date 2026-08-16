import styled from 'styled-components';

export const Logo = styled.svg`
  display: block;
  flex: 0 0 auto;
  color: ${({ theme }) => theme.logo.color};
  fill: currentColor;
  transition: color 160ms ease;
`;
