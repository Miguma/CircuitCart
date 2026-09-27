import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isValidOrigin } from "../../lib/payments/origin.ts";

function createMockRequest({
  url = "http://localhost:3000/api/payments/demo/confirm",
  origin = "http://localhost:3000",
  secFetchSite = "same-origin",
  forwardedHost = null,
  forwardedProto = null,
  host = null,
} = {}) {
  const headers = new Headers();
  if (origin !== null) headers.set("origin", origin);
  if (secFetchSite !== null) headers.set("sec-fetch-site", secFetchSite);
  if (forwardedHost !== null) headers.set("x-forwarded-host", forwardedHost);
  if (forwardedProto !== null) headers.set("x-forwarded-proto", forwardedProto);
  if (host !== null) headers.set("host", host);

  return {
    url,
    headers,
    nextUrl: new URL(url),
  };
}

describe("Origin validation for payment endpoints", () => {
  it("allows direct local development requests (http://localhost:3000)", () => {
    const req = createMockRequest({
      url: "http://localhost:3000/api/payments/demo/confirm",
      origin: "http://localhost:3000",
      host: "localhost:3000",
      secFetchSite: "same-origin",
    });
    assert.equal(isValidOrigin(req), true);
  });

  it("allows local requests on 127.0.0.1", () => {
    const req = createMockRequest({
      url: "http://127.0.0.1:3000/api/payments/demo/confirm",
      origin: "http://127.0.0.1:3000",
      host: "127.0.0.1:3000",
      secFetchSite: "same-origin",
    });
    assert.equal(isValidOrigin(req), true);
  });

  it("allows reverse proxy / Cloudflare Tunnel requests (https://circuitcart.artecloud.site)", () => {
    // In Cloudflare Tunnel, internal Next.js server sees localhost:3000 in request.url,
    // but the incoming browser request carries the tunnel's forwarded host and proto.
    const req = createMockRequest({
      url: "http://localhost:3000/api/payments/demo/confirm",
      origin: "https://circuitcart.artecloud.site",
      forwardedHost: "circuitcart.artecloud.site",
      forwardedProto: "https",
      host: "circuitcart.artecloud.site",
      secFetchSite: "same-origin",
    });
    assert.equal(isValidOrigin(req), true);
  });

  it("handles comma-separated multi-proxy x-forwarded-host header", () => {
    const req = createMockRequest({
      url: "http://localhost:3000/api/payments/demo/confirm",
      origin: "https://circuitcart.artecloud.site",
      forwardedHost: "circuitcart.artecloud.site, 10.0.0.1",
      forwardedProto: "https",
      secFetchSite: "same-origin",
    });
    assert.equal(isValidOrigin(req), true);
  });

  it("blocks cross-site fetch explicitly (sec-fetch-site: cross-site)", () => {
    const req = createMockRequest({
      url: "http://localhost:3000/api/payments/demo/confirm",
      origin: "https://attacker.invalid",
      forwardedHost: "circuitcart.artecloud.site",
      forwardedProto: "https",
      secFetchSite: "cross-site",
    });
    assert.equal(isValidOrigin(req), false);
  });

  it("blocks mismatched / malicious origins even without sec-fetch-site", () => {
    const req = createMockRequest({
      url: "http://localhost:3000/api/payments/demo/confirm",
      origin: "https://evil-site.com",
      forwardedHost: "circuitcart.artecloud.site",
      forwardedProto: "https",
      secFetchSite: null,
    });
    assert.equal(isValidOrigin(req), false);
  });

  it("blocks requests missing the origin header", () => {
    const req = createMockRequest({
      url: "http://localhost:3000/api/payments/demo/confirm",
      origin: null,
      forwardedHost: "circuitcart.artecloud.site",
      forwardedProto: "https",
      secFetchSite: "same-origin",
    });
    assert.equal(isValidOrigin(req), false);
  });

  it("supports CHECKOUT_TRUSTED_ORIGIN environment variable", () => {
    const oldEnv = process.env.CHECKOUT_TRUSTED_ORIGIN;
    try {
      process.env.CHECKOUT_TRUSTED_ORIGIN = "https://custom-domain.example.com";
      const req = createMockRequest({
        url: "http://localhost:3000/api/payments/demo/confirm",
        origin: "https://custom-domain.example.com",
        secFetchSite: "same-origin",
      });
      assert.equal(isValidOrigin(req), true);
    } finally {
      process.env.CHECKOUT_TRUSTED_ORIGIN = oldEnv;
    }
  });

  it("supports NEXT_PUBLIC_APP_URL environment variable", () => {
    const oldEnv = process.env.NEXT_PUBLIC_APP_URL;
    try {
      process.env.NEXT_PUBLIC_APP_URL = "https://circuitcart.artecloud.site";
      const req = createMockRequest({
        url: "http://localhost:3000/api/payments/demo/confirm",
        origin: "https://circuitcart.artecloud.site",
        secFetchSite: "same-origin",
      });
      assert.equal(isValidOrigin(req), true);
    } finally {
      process.env.NEXT_PUBLIC_APP_URL = oldEnv;
    }
  });
});
