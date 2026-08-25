import {
  getConsumerGroupLagPollingInterval,
  isRetryableConsumerGroupLagError,
} from 'lib/hooks/api/consumers';

describe('Consumer group lag polling', () => {
  it.each([
    [{ statusText: 'Network error' }, true],
    [{ status: 408, statusText: 'Request timeout' }, true],
    [{ status: 429, statusText: 'Too many requests' }, true],
    [{ status: 500, statusText: 'Server error' }, true],
    [{ status: 400, statusText: 'Bad request' }, false],
    [{ status: 403, statusText: 'Forbidden' }, false],
  ])('retries transient status %#', (error, expected) => {
    expect(isRetryableConsumerGroupLagError(error)).toBe(expected);
  });

  it('backs off polling after failures and caps the delay', () => {
    expect(getConsumerGroupLagPollingInterval(0, 0)).toBe(false);
    expect(getConsumerGroupLagPollingInterval(2, 0)).toBe(2_000);
    expect(getConsumerGroupLagPollingInterval(2, 1)).toBe(4_000);
    expect(getConsumerGroupLagPollingInterval(2, 4)).toBe(30_000);
  });
});
