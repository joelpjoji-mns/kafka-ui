import "@typespec/openapi";
import "./clusters.tsp";
import "./responses.tsp";

namespace Api;

using TypeSpec.Http;
using OpenAPI;

@route("/api/clusters/{clusterName}/operations")
@tag("Operations Center")
interface OperationsCenterApi {
  @get
  @operationId("getOperationsCenter")
  @summary("getOperationsCenter")
  getOperationsCenter(
    @path clusterName: string,
    @query limit?: int32,
    @query includeInternal?: boolean,
  ): OperationsCenterSnapshot | ApiNotFoundResponse | ApiBadRequestResponse;
}

model OperationsCenterSnapshot {
  collectedAtMs: int64;
  health: OperationsHealth;
  brokers: OperationsBrokers;
  topics: OperationsTopics;
  consumers: OperationsConsumers;
  integrations: OperationsIntegrations;
}

model OperationsHealth {
  status: ServerStatus;
  controller?: ControllerType;
  score: int32;
  brokerCount: int32;
  offlinePartitions: int32;
  inSyncReplicas: int32;
  outOfSyncReplicas: int32;
  underReplicatedPartitions: int32;
  lastError?: string;
}

model OperationsBrokers {
  skewAvailable: boolean;
  totalBytes?: int64;
  usableBytes?: int64;
  brokers: OperationsBroker[];
}

model OperationsBroker {
  id: int32;
  host?: string;
  port?: int32;
  leaderCount: int32;
  replicaCount: int32;
  inSyncReplicaCount: int32;
  segmentBytes?: int64;
  totalBytes?: int64;
  usableBytes?: int64;
  partitionSkew?: float64;
  leaderSkew?: float64;
}

model OperationsTopics {
  visibleCount: int32;
  internalCount: int32;
  partitions: int32;
  storageBytes?: int64;
  inboundBytesPerSec?: float64;
  outboundBytesPerSec?: float64;
  atRisk: OperationsTopic[];
  largest: OperationsTopic[];
}

model OperationsTopic {
  name: string;
  internal: boolean;
  partitionCount: int32;
  replicationFactor: int32;
  underReplicatedPartitions: int32;
  messageCount?: int64;
  storageBytes?: int64;
  inboundBytesPerSec?: float64;
  outboundBytesPerSec?: float64;
  cleanupPolicy?: string;
  riskSignals: string[];
}

model OperationsConsumers {
  visibleCount: int32;
  totalLag?: int64;
  states: OperationsConsumerStateCount[];
  worstLagging: OperationsConsumerGroup[];
}

model OperationsConsumerStateCount {
  state: string;
  count: int32;
}

model OperationsConsumerGroup {
  groupId: string;
  state?: string;
  lag?: int64;
  committedPartitions: int32;
}

model OperationsIntegrations {
  schemaRegistry: OperationsIntegration;
  connects: OperationsIntegration[];
}

model OperationsIntegration {
  name: string;
  status: "AVAILABLE" | "NOT_CONFIGURED" | "UNAVAILABLE" | "UNKNOWN";
  connectorCount?: int32;
  failingConnectorCount?: int32;
}