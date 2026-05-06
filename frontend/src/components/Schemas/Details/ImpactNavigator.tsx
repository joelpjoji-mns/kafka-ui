import React from 'react';
import { Button } from 'components/common/Button/Button';
import PageLoader from 'components/common/PageLoader/PageLoader';
import { TableTitle } from 'components/common/table/TableTitle/TableTitle.styled';
import { useGetSchemaImpact } from 'lib/hooks/api/schemas';
import {
  clusterConnectConnectorPath,
  clusterSchemaPath,
  clusterTopicPath,
} from 'lib/paths';
import type { ClusterName } from 'lib/interfaces/cluster';

interface ImpactNavigatorProps {
  clusterName: ClusterName;
  subject: string;
  version: number;
}

const ImpactNavigator: React.FC<ImpactNavigatorProps> = ({
  clusterName,
  subject,
  version,
}) => {
  const impact = useGetSchemaImpact({ clusterName, subject, version });

  if (impact.isLoading) {
    return <PageLoader />;
  }

  if (impact.error) {
    return (
      <section aria-label="Schema impact">
        <TableTitle>Schema impact</TableTitle>
        <p role="alert">Unable to load schema impact.</p>
        <Button
          buttonSize="M"
          buttonType="secondary"
          onClick={() => impact.refetch()}
        >
          Retry
        </Button>
      </section>
    );
  }

  if (!impact.data?.available) {
    return (
      <section aria-label="Schema impact">
        <TableTitle>Schema impact</TableTitle>
        <p>
          {impact.data?.unavailableReason ||
            'Schema Registry is not configured for this cluster.'}
        </p>
      </section>
    );
  }

  const { data } = impact;
  const topics = data.topics || [];
  const references = data.references || [];
  const connectors = data.connectors || [];

  return (
    <section aria-label="Schema impact">
      <TableTitle>Schema impact</TableTitle>
      <p>
        <strong>Compatibility:</strong> {data.schema?.compatibilityLevel}
      </p>

      <h3>Associated topics</h3>
      {topics.length === 0 ? (
        <p>No accessible associated topics.</p>
      ) : (
        <ul>
          {topics.map((topic) => (
            <li key={topic.name}>
              <Button
                buttonSize="M"
                buttonType="secondary"
                to={clusterTopicPath(clusterName, topic.name)}
              >
                {topic.name}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <h3>Referenced schemas</h3>
      {references.length === 0 ? (
        <p>No schema references for this version.</p>
      ) : (
        <ul>
          {references.map((reference) => (
            <li
              key={`${reference.subject}-${reference.version}-${reference.name}`}
            >
              {reference.accessible ? (
                <Button
                  buttonSize="M"
                  buttonType="secondary"
                  to={clusterSchemaPath(clusterName, reference.subject)}
                >
                  {`${reference.subject} (version ${reference.version})`}
                </Button>
              ) : (
                `${reference.subject} (version ${reference.version})`
              )}
            </li>
          ))}
        </ul>
      )}

      <h3>Connectors using associated topics</h3>
      {connectors.length === 0 ? (
        <p>No accessible connectors using the associated topics.</p>
      ) : (
        <ul>
          {connectors.map((connector) => (
            <li key={`${connector.connect}-${connector.name}`}>
              <Button
                buttonSize="M"
                buttonType="secondary"
                to={clusterConnectConnectorPath(
                  clusterName,
                  connector.connect,
                  connector.name
                )}
              >
                {connector.name}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default ImpactNavigator;
