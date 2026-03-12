import "@typespec/openapi";
import "./responses.tsp";

namespace Api;

using TypeSpec.Http;
using OpenAPI;

@route("/api/clusters/{clusterName}/topic-governance")
@tag("Topic Governance Advisor")
interface TopicGovernanceApi {
  @get
  @operationId("getTopicGovernanceReport")
  @summary("getTopicGovernanceReport")
  getTopicGovernanceReport(
    @path clusterName: string,
    @query includeInternal?: boolean,
  ): TopicGovernanceReport | ApiNotFoundResponse | ApiBadRequestResponse;
}

model TopicGovernanceReport {
  collectedAtMs: int64;
  brokerCount: int32;
  includedInternalTopics: boolean;
  namingRule: string;
  summary: TopicGovernanceSummary;
  topics: TopicGovernanceTopic[];
}

model TopicGovernanceSummary {
  totalTopics: int32;
  criticalTopics: int32;
  warningTopics: int32;
  infoTopics: int32;
  healthyTopics: int32;
}

model TopicGovernanceTopic {
  name: string;
  classification: "SYSTEM" | "APPLICATION";
  namingCompliant: boolean;
  score: int32;
  severity: "CRITICAL" | "WARNING" | "INFO" | "HEALTHY";
  partitionCount: int32;
  replicationFactor: int32;
  underReplicatedPartitions: int32;
  noInSyncReplicaPartitions: int32;
  messageCount?: int64;
  storageBytes?: int64;
  offsetDataAvailable: boolean;
  storageDataAvailable: boolean;
  settings: TopicGovernanceSettings;
  recommendations: TopicGovernanceRecommendation[];
}

model TopicGovernanceSettings {
  configurationAvailable: boolean;
  cleanupPolicy?: string;
  retentionMs?: int64;
  retentionBytes?: int64;
  segmentMs?: int64;
  segmentBytes?: int64;
  maxMessageBytes?: int64;
}

model TopicGovernanceRecommendation {
  code: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
  message: string;
  evidence?: string;
}