import React from 'react';
import { render } from 'lib/testHelpers';
import NavBar from 'components/NavBar/NavBar';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('components/Version/Version', () => () => <div>Version</div>);
jest.mock('components/NavBar/UserInfo/UserInfo', () => () => (
  <div>UserInfo</div>
));

describe('NavBar', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(() => ({
        matches: false,
        addListener: jest.fn(),
      })),
    });

    render(<NavBar onBurgerClick={jest.fn()} />);
  });

  it('correctly renders header', () => {
    const header = screen.getByLabelText('Page Header');
    expect(header).toBeInTheDocument();
    expect(within(header).getByText('Custom Kafka UI')).toBeInTheDocument();
    expect(within(header).getByText('UserInfo')).toBeInTheDocument();
  });

  it('offers the additional named theme presets', async () => {
    await userEvent.click(
      screen.getByRole('listbox', { name: 'Theme selection' })
    );

    expect(
      screen.getByRole('option', { name: 'Midnight' })
    ).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Harbor' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Ember' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'AMOLED' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Glass' })).toBeInTheDocument();
  });
});
