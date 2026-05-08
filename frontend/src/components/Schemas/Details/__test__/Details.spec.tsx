import React from 'react';
import Details from 'components/Schemas/Details/Details';
import { render, WithRoute } from 'lib/testHelpers';
import {
  clusterConnectConnectorPath,
  clusterSchemaPath,
  clusterTopicPath,
} from 'lib/paths';
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import {
  schemaVersion,
  schemaVersionWithNonAsciiChars,
  schemaVersionWithTopic,
} from 'components/Schemas/Edit/__tests__/fixtures';
import ClusterContext, {
  ContextProps,
  initialValue as contextInitialValue,
} from 'components/contexts/ClusterContext';
import {
  useDeleteSchema,
  useGetSchemaImpact,
  useGetLatestSchema,
  useGetSchemasVersions,
} from 'lib/hooks/api/schemas';

import { versionPayload, versionEmptyPayload } from './fixtures';

const clusterName = 'testClusterName';

const mockHistoryPush = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockHistoryPush,
}));

jest.mock('lib/hooks/api/schemas', () => ({
  useGetSchemasVersions: jest.fn(),
  useGetLatestSchema: jest.fn(),
  useGetSchemaImpact: jest.fn(),
  useDeleteSchema: jest.fn(),
}));

const renderComponent = (context: ContextProps = contextInitialValue) =>
  render(
    <WithRoute path={clusterSchemaPath()}>
      <ClusterContext.Provider value={context}>
        <Details />
      </ClusterContext.Provider>
    </WithRoute>,
    {
      initialEntries: [clusterSchemaPath(clusterName, schemaVersion.subject)],
    }
  );

describe('Details', () => {
  const deleteMockfn = jest.fn();
  beforeEach(() => {
    deleteMockfn.mockClear();

    // TODO test case should be added for this
    (useDeleteSchema as jest.Mock).mockImplementation(() => ({
      mutateAsync: deleteMockfn,
    }));
    (useGetSchemaImpact as jest.Mock).mockImplementation(() => ({
      data: {
        available: true,
        schema: schemaVersionWithTopic,
        topics: [{ name: schemaVersionWithTopic.topic }],
        references: [
          {
            name: 'address',
            subject: 'address-value',
            version: 2,
            accessible: true,
          },
          {
            name: 'private',
            subject: 'private-value',
            version: 1,
            accessible: false,
          },
        ],
        connectors: [
          {
            connect: 'connect-a',
            name: 'orders-sink',
            topics: [schemaVersionWithTopic.topic],
          },
        ],
      },
      error: null,
      isLoading: false,
      refetch: jest.fn(),
    }));
  });

  describe('fetch success', () => {
    describe('has schema topic', () => {
      it('renders button that navigate to topic', async () => {
        (useGetSchemasVersions as jest.Mock).mockImplementation(() => ({
          data: versionPayload,
          isFetching: false,
          isError: false,
        }));
        (useGetLatestSchema as jest.Mock).mockImplementation(() => ({
          data: schemaVersionWithTopic,
          isFetching: false,
          isError: false,
        }));
        renderComponent();
        const button = screen.getByRole('link', {
          name: `Go to topic "${schemaVersionWithTopic.topic}"`,
        });
        expect(button).toBeInTheDocument();
        expect(button).toHaveAttribute(
          'href',
          clusterTopicPath(clusterName, schemaVersionWithTopic.topic!)
        );
      });

      it('shows contract-backed impact links for accessible resources', async () => {
        (useGetSchemasVersions as jest.Mock).mockImplementation(() => ({
          data: versionPayload,
          isFetching: false,
          isError: false,
          isSuccess: true,
        }));
        (useGetLatestSchema as jest.Mock).mockImplementation(() => ({
          data: schemaVersionWithTopic,
          isFetching: false,
          isError: false,
          isSuccess: true,
        }));
        renderComponent();

        await userEvent.click(
          screen.getByRole('button', { name: 'View Impact' })
        );

        expect(
          screen.getByRole('link', { name: schemaVersionWithTopic.topic! })
        ).toHaveAttribute(
          'href',
          clusterTopicPath(clusterName, schemaVersionWithTopic.topic!)
        );
        expect(
          screen.getByRole('link', { name: /address-value/i })
        ).toHaveAttribute(
          'href',
          clusterSchemaPath(clusterName, 'address-value')
        );
        expect(
          screen.getByRole('link', { name: 'orders-sink' })
        ).toHaveAttribute(
          'href',
          clusterConnectConnectorPath(clusterName, 'connect-a', 'orders-sink')
        );
        expect(
          screen.queryByRole('link', { name: /private-value/i })
        ).not.toBeInTheDocument();
      });
    });
    describe('has schema versions', () => {
      it('renders component with schema info', async () => {
        (useGetSchemasVersions as jest.Mock).mockImplementation(() => ({
          data: versionPayload,
          isFetching: false,
          isError: false,
          isSuccess: true,
        }));
        (useGetLatestSchema as jest.Mock).mockImplementation(() => ({
          data: useGetSchemasVersions,
          isFetching: false,
          isError: false,
          isSuccess: true,
        }));
        renderComponent();
        expect(screen.getByText('Edit Schema')).toBeInTheDocument();
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        expect(screen.getByRole('table')).toBeInTheDocument();
      });
    });

    describe('fetch success schema with non ascii characters', () => {
      describe('has schema versions', () => {
        it('renders component with schema info', async () => {
          (useGetSchemasVersions as jest.Mock).mockImplementation(() => ({
            data: versionPayload,
            isFetching: false,
            isError: false,
            isSuccess: true,
          }));
          (useGetLatestSchema as jest.Mock).mockImplementation(() => ({
            data: schemaVersionWithNonAsciiChars,
            isFetching: false,
            isError: false,
            isSuccess: true,
          }));
          renderComponent();
          expect(screen.getByText('Edit Schema')).toBeInTheDocument();
          expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
          expect(screen.getByRole('table')).toBeInTheDocument();
        });
      });
    });

    describe('empty schema versions', () => {
      beforeEach(async () => {
        (useGetSchemasVersions as jest.Mock).mockImplementation(() => ({
          data: versionEmptyPayload,
          isFetching: false,
          isError: false,
          isSuccess: true,
        }));
        (useGetLatestSchema as jest.Mock).mockImplementation(() => ({
          data: schemaVersionWithNonAsciiChars,
          isFetching: false,
          isError: false,
          isSuccess: true,
        }));
        renderComponent();
      });

      // seems like incorrect behaviour
      it('renders versions table with 0 items', () => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });
    });
  });
});
