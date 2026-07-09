import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from 'lib/testHelpers';
import {
  LagTrendComponent,
  CONSUMER_LAG_THRESHOLD_KEY,
} from 'lib/consumerGroups';
import { LOCAL_STORAGE_KEY_PREFIX } from 'lib/constants';
import LagThresholdControl from 'components/ConsumerGroups/LagThresholdControl';

const thresholdKey = `${LOCAL_STORAGE_KEY_PREFIX}-${CONSUMER_LAG_THRESHOLD_KEY}`;

describe('Consumer lag threshold alerting', () => {
  beforeEach(() => localStorage.clear());

  describe('LagTrendComponent', () => {
    it('renders N/A when lag is undefined', () => {
      render(<LagTrendComponent lag={undefined} />);
      expect(screen.getByText('N/A')).toBeInTheDocument();
    });

    it('does not show an alert when no threshold is configured', () => {
      render(<LagTrendComponent lag={5000} />);
      expect(screen.getByText('5000')).toBeInTheDocument();
      expect(screen.queryByLabelText('lag alert')).not.toBeInTheDocument();
    });

    it('shows an alert when lag reaches the configured threshold', () => {
      localStorage.setItem(thresholdKey, '1000');
      render(<LagTrendComponent lag={1500} />);
      expect(screen.getByLabelText('lag alert')).toBeInTheDocument();
    });

    it('does not alert when lag is below the threshold', () => {
      localStorage.setItem(thresholdKey, '1000');
      render(<LagTrendComponent lag={999} />);
      expect(screen.queryByLabelText('lag alert')).not.toBeInTheDocument();
    });
  });

  describe('LagThresholdControl', () => {
    it('persists a numeric threshold to local storage', async () => {
      render(<LagThresholdControl />);
      const input = screen.getByLabelText('Consumer lag alert threshold');
      await userEvent.type(input, '2500');
      expect(localStorage.getItem(thresholdKey)).toBe('2500');
    });

    it('ignores non-numeric input', async () => {
      render(<LagThresholdControl />);
      const input = screen.getByLabelText(
        'Consumer lag alert threshold'
      ) as HTMLInputElement;
      await userEvent.type(input, 'abc');
      expect(input.value).toBe('');
    });
  });
});
