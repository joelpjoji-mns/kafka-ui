import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from 'lib/testHelpers';
import DownloadPresets, {
  DownloadConfig,
} from 'components/Topics/Topic/Download/DownloadPresets';

const config: DownloadConfig = {
  partitionMode: 'ALL',
  selectedPartitions: [],
  downloadMode: 'LATEST',
  limit: '100',
  offset: '0',
  fromTime: '',
  toTime: '',
  format: 'CSV',
  search: '',
  smartFilterId: '',
  keySerde: 'String',
  valueSerde: 'String',
};

const savePreset = async (name: string) => {
  await userEvent.type(screen.getByLabelText('New preset name'), name);
  await userEvent.click(
    screen.getByRole('button', { name: 'Save download preset' })
  );
};

describe('DownloadPresets', () => {
  beforeEach(() => localStorage.clear());

  it('shows an empty state initially', () => {
    render(<DownloadPresets currentConfig={config} onApply={jest.fn()} />);
    expect(screen.getByText('No saved presets yet.')).toBeInTheDocument();
  });

  it('disables save until a name is entered', () => {
    render(<DownloadPresets currentConfig={config} onApply={jest.fn()} />);
    expect(
      screen.getByRole('button', { name: 'Save download preset' })
    ).toBeDisabled();
  });

  it('saves, applies and deletes a preset', async () => {
    const onApply = jest.fn();
    render(<DownloadPresets currentConfig={config} onApply={onApply} />);

    await savePreset('nightly');
    expect(screen.getByText('nightly')).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Apply preset nightly' })
    );
    expect(onApply).toHaveBeenCalledWith(config);

    await userEvent.click(
      screen.getByRole('button', { name: 'Delete preset nightly' })
    );
    expect(screen.queryByText('nightly')).not.toBeInTheDocument();
    expect(screen.getByText('No saved presets yet.')).toBeInTheDocument();
  });

  it('persists a saved preset across remounts', async () => {
    const { unmount } = render(
      <DownloadPresets currentConfig={config} onApply={jest.fn()} />
    );
    await savePreset('weekly');
    unmount();

    render(<DownloadPresets currentConfig={config} onApply={jest.fn()} />);
    expect(screen.getByText('weekly')).toBeInTheDocument();
  });
});
