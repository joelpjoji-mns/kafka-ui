import React, { useContext } from 'react';
import Select from 'components/common/Select/Select';
import Logo from 'components/common/Logo/Logo';
import Version from 'components/Version/Version';
import GitHubIcon from 'components/common/Icons/GitHubIcon';
import { ThemeModeContext } from 'components/contexts/ThemeModeContext';
import { Button } from 'components/common/Button/Button';
import MenuIcon from 'components/common/Icons/MenuIcon';
import { GIT_REPO_LINK } from 'lib/constants';

import { UserTimezone } from './UserTimezone/UserTimezone';
import UserInfo from './UserInfo/UserInfo';
import * as S from './NavBar.styled';

interface Props {
  onBurgerClick: () => void;
}

export type ThemeDropDownValue =
  | 'auto_theme'
  | 'light_theme'
  | 'dark_theme'
  | 'midnight_theme'
  | 'harbor_theme'
  | 'ember_theme'
  | 'amoled_theme'
  | 'glass_theme';

const themeOption = (label: string, primary: string, secondary?: string) => (
  <S.ThemeOption>
    <S.ThemeSwatch $primary={primary} $secondary={secondary} />
    <span>{label}</span>
  </S.ThemeOption>
);

const options = [
  {
    label: themeOption('Auto', '#FFFFFF', '#171A1C'),
    value: 'auto_theme',
  },
  {
    label: themeOption('Light', '#FFFFFF'),
    value: 'light_theme',
  },
  {
    label: themeOption('Dark', '#171A1C'),
    value: 'dark_theme',
  },
  {
    label: themeOption('Midnight', '#171717', '#F4C95D'),
    value: 'midnight_theme',
  },
  {
    label: themeOption('Harbor', '#F7FBFC', '#006D77'),
    value: 'harbor_theme',
  },
  {
    label: themeOption('Ember', '#FFFFFF', '#9C2F1A'),
    value: 'ember_theme',
  },
  {
    label: themeOption('AMOLED', '#000000', '#E8E8E8'),
    value: 'amoled_theme',
  },
  {
    label: themeOption('Glass', '#D8F0E4', '#F6E7CF'),
    value: 'glass_theme',
  },
];

const NavBar: React.FC<Props> = ({ onBurgerClick }) => {
  const { themeMode, setThemeMode } = useContext(ThemeModeContext);

  return (
    <S.Navbar role="navigation" aria-label="Page Header">
      <S.NavbarBrand>
        <S.NavbarBrand>
          <Button buttonType="text" buttonSize="S" onClick={onBurgerClick}>
            <MenuIcon />
          </Button>

          <S.Hyperlink to="/">
            <Logo />
            <S.BrandName>
              <span className="full">Custom Kafka UI</span>
              <span className="compact">Custom Kafka</span>
            </S.BrandName>
          </S.Hyperlink>

          <S.NavbarItem>
            <Version />
          </S.NavbarItem>
        </S.NavbarBrand>
      </S.NavbarBrand>
      <S.NavbarSocial>
        <S.TimezoneItem>
          <UserTimezone />
        </S.TimezoneItem>

        <Select
          aria-label="Theme selection"
          options={options}
          value={themeMode}
          onChange={setThemeMode}
          isThemeMode
        />
        <S.SocialLink
          href={GIT_REPO_LINK}
          target="_blank"
          rel="noreferrer"
          aria-label="Custom Kafka UI on GitHub"
        >
          <GitHubIcon />
        </S.SocialLink>
        <UserInfo />
      </S.NavbarSocial>
    </S.Navbar>
  );
};

export default NavBar;
