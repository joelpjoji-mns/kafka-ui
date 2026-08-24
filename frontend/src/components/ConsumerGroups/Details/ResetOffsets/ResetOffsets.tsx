import React from 'react';
import {
  clusterConsumerGroupsPath,
  ClusterGroupParam,
  ConsumerGroupBackReference,
} from 'lib/paths';
import { buildPageTitle } from 'lib/pageTitles';
import 'react-datepicker/dist/react-datepicker.css';
import { useLocation } from 'react-router-dom';
import useAppParams from 'lib/hooks/useAppParams';
import { useConsumerGroupDetails } from 'lib/hooks/api/consumers';
import PageLoader from 'components/common/PageLoader/PageLoader';
import ResourcePageHeading from 'components/common/ResourcePageHeading/ResourcePageHeading';
import {
  ConsumerGroupOffsetsReset,
  ConsumerGroupOffsetsResetType,
} from 'generated-sources';

import Form from './Form';

const ResetOffsets: React.FC = () => {
  const routerParams = useAppParams<ClusterGroupParam>();
  const location = useLocation();
  const backReference = (location.state as ConsumerGroupBackReference) ?? null;

  const { consumerGroupID } = routerParams;
  const consumerGroup = useConsumerGroupDetails(routerParams);

  if (consumerGroup.isLoading || !consumerGroup.isSuccess)
    return <PageLoader />;

  const partitions = consumerGroup.data.partitions || [];
  const { topic } = partitions[0] || '';

  const uniqTopics = Array.from(
    new Set(partitions.map((partition) => partition.topic))
  );

  const defaultValues: ConsumerGroupOffsetsReset = {
    resetType: ConsumerGroupOffsetsResetType.EARLIEST,
    topic,
    partitionsOffsets: [],
    resetToTimestamp: new Date().getTime(),
    waitForInactive: true,
  };

  return (
    <>
      <ResourcePageHeading
        text={consumerGroupID}
        backTo={
          backReference?.goBackPath ??
          clusterConsumerGroupsPath(routerParams.clusterName)
        }
        backText={backReference?.goBackText ?? 'Consumers'}
        documentTitle={buildPageTitle(
          'Reset Offsets',
          consumerGroupID,
          routerParams.clusterName
        )}
      />
      <Form
        defaultValues={defaultValues}
        topics={uniqTopics}
        partitions={partitions}
      />
    </>
  );
};

export default ResetOffsets;
