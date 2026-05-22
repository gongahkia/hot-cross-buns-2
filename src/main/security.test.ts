import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  shell: {
    openExternal: vi.fn()
  }
}));

import { shell } from "electron";
import {
  PRODUCTION_CONTENT_SECURITY_POLICY,
  configureNavigationLockdown,
  configureSessionHardening,
  contentSecurityPolicy,
  isAllowedAppNavigation,
  isApprovedExternalUrl
} from "./security";

describe("Electron security policy", () => {
  it("defines a production CSP without remote network or inline script access", () => {
    expect(contentSecurityPolicy(true)).toBe(PRODUCTION_CONTENT_SECURITY_POLICY);
    expect(PRODUCTION_CONTENT_SECURITY_POLICY).toContain("default-src 'none'");
    expect(PRODUCTION_CONTENT_SECURITY_POLICY).toContain("script-src 'self'");
    expect(PRODUCTION_CONTENT_SECURITY_POLICY).toContain("connect-src 'none'");
    expect(PRODUCTION_CONTENT_SECURITY_POLICY).toContain("object-src 'none'");
    expect(PRODUCTION_CONTENT_SECURITY_POLICY).toContain("frame-src 'none'");
    expect(PRODUCTION_CONTENT_SECURITY_POLICY).not.toContain("script-src 'unsafe-inline'");
    expect(PRODUCTION_CONTENT_SECURITY_POLICY).not.toContain("http://127.0.0.1");
  });

  it("injects CSP headers and denies renderer permission prompts", () => {
    let permissionHandler:
      | ((_contents: unknown, _permission: string, callback: (allowed: boolean) => void) => void)
      | undefined;
    let headersCallback:
      | ((
          details: { responseHeaders?: Record<string, string[]> },
          callback: (response: { responseHeaders: Record<string, string[]> }) => void
        ) => void)
      | undefined;
    const session = {
      setPermissionRequestHandler: vi.fn((handler) => {
        permissionHandler = handler;
      }),
      webRequest: {
        onHeadersReceived: vi.fn((callback) => {
          headersCallback = callback;
        })
      }
    };

    configureSessionHardening(session as never, { isPackaged: true });

    const permissionResult = vi.fn();
    permissionHandler?.({}, "notifications", permissionResult);
    expect(permissionResult).toHaveBeenCalledWith(false);

    const response = vi.fn();
    headersCallback?.({ responseHeaders: { "X-Test": ["1"] } }, response);
    expect(response).toHaveBeenCalledWith({
      responseHeaders: expect.objectContaining({
        "Content-Security-Policy": [PRODUCTION_CONTENT_SECURITY_POLICY]
      })
    });
  });

  it("allows only the active app file URL or configured local dev origin", () => {
    expect(
      isAllowedAppNavigation(
        "file:///Applications/Hot%20Cross%20Buns/index.html#tasks",
        "file:///Applications/Hot%20Cross%20Buns/index.html#today"
      )
    ).toBe(true);
    expect(
      isAllowedAppNavigation(
        "file:///Users/person/secret.html",
        "file:///Applications/Hot%20Cross%20Buns/index.html"
      )
    ).toBe(false);
    expect(
      isAllowedAppNavigation(
        "http://localhost:5173/settings",
        "http://localhost:5173/",
        "http://localhost:5173/"
      )
    ).toBe(true);
    expect(
      isAllowedAppNavigation(
        "https://example.com",
        "http://localhost:5173/",
        "http://localhost:5173/"
      )
    ).toBe(false);
  });

  it("opens only approved external allowlist URLs from new-window requests", () => {
    expect(isApprovedExternalUrl("https://accounts.google.com/o/oauth2/v2/auth")).toBe(true);
    expect(isApprovedExternalUrl("mailto:support@example.invalid")).toBe(true);
    expect(isApprovedExternalUrl("https://example.com/phish")).toBe(false);
    expect(isApprovedExternalUrl("file:///Users/person/private")).toBe(false);

    let newWindowHandler: ((details: { url: string }) => { action: "deny" }) | undefined;
    const preventDefault = vi.fn();
    const window = {
      webContents: {
        setWindowOpenHandler: vi.fn((handler) => {
          newWindowHandler = handler;
        }),
        on: vi.fn((_eventName, listener) => {
          listener({ preventDefault }, "https://example.com/phish");
        }),
        getURL: vi.fn(() => "file:///Applications/Hot%20Cross%20Buns/index.html")
      }
    };

    configureNavigationLockdown(window as never);

    expect(newWindowHandler?.({ url: "https://accounts.google.com/o/oauth2/v2/auth" })).toEqual({
      action: "deny"
    });
    expect(shell.openExternal).toHaveBeenCalledWith(
      "https://accounts.google.com/o/oauth2/v2/auth"
    );
    expect(newWindowHandler?.({ url: "https://example.com/phish" })).toEqual({ action: "deny" });
    expect(shell.openExternal).not.toHaveBeenCalledWith("https://example.com/phish");
    expect(preventDefault).toHaveBeenCalled();
  });
});
