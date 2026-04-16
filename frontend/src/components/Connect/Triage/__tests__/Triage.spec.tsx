import React from 'react';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ConnectorState,
  ConnectorTaskStatus,
  ConnectorTriageSeverity,
  ConnectorTriageSnapshot,
} from 'generated-sources';
import { render } from 'lib/testHelpers';
import useAppParams from 'lib/hooks/useAppParams';
import { useConnectorTriage } from 'lib/hooks/api/kafkaConnect';
import Triage from 'components/Connect/Triage/Triage';

const refetch = jest.fn();

jest.mock('lib/hooks/api/kafkaConnect', () => ({
  useConnectorTriage: jest.fn(),
}));

jest.mock('lib/hooks/useAppParams', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const snapshot: ConnectorTriageSnapshot = {
  collectedAtMs: Date.UTC(2026, 7, 15, 10, 0),
  summary: {
    totalConnectors: 3,
    healthyConnectors: 1,
    warningConnectors: 1,
    criticalConnectors: 1,
    failedTasks: 1,
  },
  connectors: [
    {
      connect: 'connect-west',
      name: 'orders-sink',
      connectorState: ConnectorState.TASK_FAILED,
      severity: ConnectorTriageSeverity.CRITICAL,
      tasksCount: 2,
      failedTasksCount: 1,
      failedTasks: [
        {
          id: 1,
          state: ConnectorTaskStatus.FAILED,
          traceExcerpt: 'Cannot reach orders database',
        },
      ],
      traceExcerpt: 'Connector exhausted retries',
    },
    {
      connect: 'connect-east',
      name: 'payments-source',
      connectorState: ConnectorState.RESTARTING,
      severity: ConnectorTriageSeverity.WARNING,
      tasksCount: 1,
      failedTasksCount: 0,
      failedTasks: [],
    },
    {
      connect: 'connect-west',
      name: 'inventory-sink',
      connectorState: ConnectorState.RUNNING,
      severity: ConnectorTriageSeverity.HEALTHY,
      tasksCount: 1,
      failedTasksCount: 0,
      failedTasks: [],
    },
  ],
};

describe('Triage', () => {
  beforeEach(() => {
    refetch.mockReset();
    (useAppParams as jest.Mock).mockReturnValue({ clusterName: 'local' });
    (useConnectorTriage as jest.Mock).mockReturnValue({
      data: snapshot,
      error: undefined,
      isLoading: false,
      isRefetching: false,
      refetch,
    });
  });

  it('renders task failure evidence and a safe connector drilldown', () => {
    render(<Triage />);

    expect(screen.getByText('Connector posture')).toBeInTheDocument();
    expect(
      screen.getByText('Cannot reach orders database')
    ).toBeInTheDocument();
    expect(screen.getByText('Connector exhausted retries')).toBeInTheDocument();
    expect(screen.queryByText('inventory-sink')).not.toBeInTheDocument();
    const ordersRow = screen.getByText('orders-sink').closest('tr');
    expect(ordersRow).not.toBeNull();
    expect(
      within(ordersRow as HTMLTableRowElement).getByRole('link', {
        name: 'Inspect',
      })
    ).toHaveAttribute(
      'href',
      '/ui/clusters/local/connects/connect-west/connectors/orders-sink'
    );
  });

  it('filters connectors, includes healthy state on demand, and refreshes', async () => {
    const user = userEvent.setup();
    render(<Triage />);

    await user.type(
      screen.getByRole('textbox', { name: 'Filter connector triage' }),
      'payments'
    );
    expect(screen.getByText('payments-source')).toBeInTheDocument();
    expect(screen.queryByText('orders-sink')).not.toBeInTheDocument();

    await user.clear(
      screen.getByRole('textbox', { name: 'Filter connector triage' })
    );
    await user.click(
      screen.getByRole('checkbox', { name: 'Show healthy connectors' })
    );
    expect(screen.getByText('inventory-sink')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
