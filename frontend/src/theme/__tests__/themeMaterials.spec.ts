import { amoledTheme, glassTheme, theme } from 'theme/theme';

describe('theme materials', () => {
  it('keeps Glass navigation adaptive while preserving regular content surfaces', () => {
    expect(glassTheme.effects.navigationBackdropFilter).toContain('blur');
    expect(glassTheme.effects.transientBackdropFilter).toContain('blur');
    expect(glassTheme.effects.reducedTransparencyNavigationSurface).toBe(
      '#F6FBF8'
    );
    expect(glassTheme.table).toEqual(theme.table);
    expect(glassTheme.default.backgroundColor).toBe('#F9FCFB');
  });

  it('keeps AMOLED surfaces opaque', () => {
    expect(amoledTheme.effects.navigationBackdropFilter).toBe('none');
    expect(amoledTheme.effects.navigationSurface).toBe('#000000');
  });
});