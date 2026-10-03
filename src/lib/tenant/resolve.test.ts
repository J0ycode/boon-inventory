import { describe, expect, it } from "vitest";
import { isValidSlug, resolveTenant, tenantPath, tenantUrl } from "./resolve";

describe("resolveTenant (subdomain mode)", () => {
  it("reads the slug from a tenant subdomain", () => {
    expect(resolveTenant("boonbaby.localhost:3000", "/storeroom", "subdomain")).toEqual({
      slug: "boonbaby",
      pathname: "/storeroom",
    });
  });

  it("treats the root domain as no tenant", () => {
    expect(resolveTenant("localhost:3000", "/", "subdomain").slug).toBeNull();
  });

  it("ignores nested subdomains, reserved names, and foreign hosts", () => {
    expect(resolveTenant("a.b.localhost:3000", "/", "subdomain").slug).toBeNull();
    expect(resolveTenant("www.localhost:3000", "/", "subdomain").slug).toBeNull();
    expect(resolveTenant("evil.example.com", "/", "subdomain").slug).toBeNull();
    expect(resolveTenant(null, "/", "subdomain").slug).toBeNull();
  });

  it("is case-insensitive on the host", () => {
    expect(resolveTenant("BoonBaby.LOCALHOST:3000", "/", "subdomain").slug).toBe("boonbaby");
  });
});

describe("resolveTenant (path mode)", () => {
  it("strips the /t/{slug} prefix", () => {
    expect(resolveTenant("localhost:3000", "/t/boonbaby/store/stock", "path")).toEqual({
      slug: "boonbaby",
      pathname: "/store/stock",
    });
    expect(resolveTenant("localhost:3000", "/t/boonbaby", "path")).toEqual({ slug: "boonbaby", pathname: "/" });
  });

  it("returns no tenant for other paths", () => {
    expect(resolveTenant("localhost:3000", "/signup", "path").slug).toBeNull();
  });
});

describe("tenant links", () => {
  it("builds paths for each mode", () => {
    expect(tenantPath("boonbaby", "/store", "subdomain")).toBe("/store");
    expect(tenantPath("boonbaby", "/store", "path")).toBe("/t/boonbaby/store");
    expect(tenantPath("boonbaby", "/", "path")).toBe("/t/boonbaby");
  });

  it("builds absolute URLs for each mode", () => {
    expect(tenantUrl("boonbaby", "/login", "subdomain")).toBe("http://boonbaby.localhost:3000/login");
    expect(tenantUrl("boonbaby", "/login", "path")).toBe("http://localhost:3000/t/boonbaby/login");
  });
});

describe("isValidSlug", () => {
  it.each([
    ["boonbaby", true],
    ["tiny-tots", true],
    ["ab", false],
    ["-bad", false],
    ["Bad", false],
    ["admin", false],
  ])("%s → %s", (slug, valid) => {
    expect(isValidSlug(slug)).toBe(valid);
  });
});
