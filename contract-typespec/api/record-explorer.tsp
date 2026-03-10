import "@typespec/openapi";
import "./responses.tsp";

namespace Api;

using TypeSpec.Http;
using OpenAPI;

@route("/api/clusters/{clusterName}/record-explorer")
@tag("Record Explorer")
interface RecordExplorerApi {
  @get
  @operationId("searchRecords")
  @summary("Search a bounded recent sample across visible topics")
  searchRecords(
    @path clusterName: string,
    @query query: string,
    @query topic?: string,
    @query includeInternal?: boolean,
    @query topicLimit?: int32,
    @query perTopicSampleLimit?: int32,
    @query resultLimit?: int32,
  ): RecordExplorerResponse | ApiBadRequestResponse;
}

model RecordExplorerResponse {
  query: string;
  collectedAtMs: int64;
  visibleTopicCount: int32;
  topicLimit: int32;
  topicLimitReached: boolean;
  topicsScanned: int32;
  perTopicSampleLimit: int32;
  sampledRecords: int32;
  resultLimit: int32;
  resultLimitReached: boolean;
  coverage: RecordExplorerTopicCoverage[];
  records: RecordExplorerRecord[];
}

model RecordExplorerTopicCoverage {
  topic: string;
  sampledRecords: int32;
  matchedRecords: int32;
}

model RecordExplorerRecord {
  topic: string;
  partition: int32;
  offset: int64;
  timestamp: offsetDateTime;
  key?: string;
  value?: string;
  headers?: Record<string>;
  keySize?: int64;
  valueSize?: int64;
  headersSize?: int64;
}