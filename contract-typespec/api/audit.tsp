import "@typespec/openapi";
import "./responses.tsp";

namespace Api;

using TypeSpec.Http;
using OpenAPI;

@route("/api/clusters/{clusterName}/audit")
@tag("Audit")
interface AuditApi {
  @get
  @operationId("getAuditTrail")
  @summary("getAuditTrail")
  getAuditTrail(
    @path clusterName: string,
    @query from?: offsetDateTime,
    @query to?: offsetDateTime,
    @query resource?: string,
    @query operation?: string,
    @query outcome?: "SUCCESS" | "FAILURE",
    @query cursor?: string,
    @query limit?: int32,
  ): AuditTrailResponse | ApiNotFoundResponse | ApiBadRequestResponse;
}

model AuditTrailResponse {
  status: "AVAILABLE" | "UNAVAILABLE";
  unavailableReason?: string;
  events: AuditTrailEvent[];
  nextCursor?: string;
  truncated: boolean;
}

model AuditTrailEvent {
  timestamp: offsetDateTime;
  operator: string;
  resources: AuditTrailResource[];
  operation: string;
  outcome: "SUCCESS" | "FAILURE";
  error?: string;
}

model AuditTrailResource {
  type: string;
  resourceId?: string;
  alter: boolean;
  accessType: string[];
}