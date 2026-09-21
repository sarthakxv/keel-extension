import { describe, expect, it } from "vitest";
import { buildJevGatewayOptions } from "./jev-evaluator";

describe("Jev gateway options", () => {
  it("omits zero-data-retention outside production so hobby keys can evaluate", () => {
    expect(buildJevGatewayOptions({ NODE_ENV: "development" })).toEqual({
      only: ["typesafe-ai"],
    });
  });

  it("requests zero-data-retention in production", () => {
    expect(buildJevGatewayOptions({ NODE_ENV: "production" })).toEqual({
      only: ["typesafe-ai"],
      zeroDataRetention: true,
    });
  });

  it("lets an explicit env flag override the Node environment", () => {
    expect(
      buildJevGatewayOptions({
        NODE_ENV: "production",
        AI_GATEWAY_ZERO_DATA_RETENTION: "false",
      }),
    ).toEqual({ only: ["typesafe-ai"] });
    expect(
      buildJevGatewayOptions({
        NODE_ENV: "development",
        AI_GATEWAY_ZERO_DATA_RETENTION: "true",
      }),
    ).toEqual({
      only: ["typesafe-ai"],
      zeroDataRetention: true,
    });
  });
});
