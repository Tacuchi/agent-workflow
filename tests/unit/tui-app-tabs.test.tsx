import { render } from "ink-testing-library";
import { describe, expect, it, vi } from "vitest";
import { App } from "../../src/cli/tui/app.js";

const ENTER = "\r";
const TAB = "\t";
const ESC = "[";

function buildCtx() {
  return {
    fs: { exists: async () => false } as never,
    env: {
      homeDir: () => "/home/test",
      cwd: () => "/home/test/project",
      get: () => undefined,
    },
    process: {
      run: async () => ({ code: 0, stdout: "", stderr: "" }),
      which: async () => undefined,
    },
    git: {} as never,
    namespace: { namespace: "workflow", source: "default" as const },
    runtime: {
      packageName: "@tacuchi/agent-workflow-cli",
      binName: "agent-workflow",
      source: "default" as const,
    },
    paths: {
      userMcpConnectionsFile: () => "/tmp/non-existent-conns.json",
      userDsnFile: () => "/tmp/non-existent-dsn.env",
      userRoot: () => "/home/test/.workflow",
      cwdRoot: () => "/home/test/project",
      userRuntimeJson: () => "/tmp/runtime.json",
      userLibConfigDir: () => "/home/test/.workflow",
    } as never,
  };
}

describe("App (tabs)", () => {
  it("monta con Status como tab activa por defecto", () => {
    const ctx = buildCtx();
    const { lastFrame } = render(<App version="9.9.9" ctx={ctx} onResult={() => {}} />);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("[ Status ]");
    expect(frame).toContain("◆ agent-workflow");
    expect(frame).toContain("v9.9.9");
  });

  it("renderiza header con cwd como ~/...", () => {
    const ctx = buildCtx();
    const { lastFrame } = render(<App version="9.9.9" ctx={ctx} onResult={() => {}} />);
    expect(lastFrame()).toContain("~/project");
  });

  it("Tab cambia a la siguiente tab (MCP)", async () => {
    const ctx = buildCtx();
    const { stdin, lastFrame } = render(<App version="9.9.9" ctx={ctx} onResult={() => {}} />);
    await new Promise((r) => setTimeout(r, 50));
    stdin.write(TAB);
    await new Promise((r) => setTimeout(r, 50));
    expect(lastFrame()).toContain("[ MCP ]");
  });

  it("número 3 va directo a Skills tab", async () => {
    const ctx = buildCtx();
    const { stdin, lastFrame } = render(<App version="9.9.9" ctx={ctx} onResult={() => {}} />);
    await new Promise((r) => setTimeout(r, 50));
    stdin.write("3");
    await new Promise((r) => setTimeout(r, 50));
    expect(lastFrame()).toContain("[ Skills ]");
  });

  it("'q' resuelve con kind:exit", async () => {
    const ctx = buildCtx();
    const onResult = vi.fn();
    const { stdin } = render(<App version="9.9.9" ctx={ctx} onResult={onResult} />);
    await new Promise((r) => setTimeout(r, 50));
    stdin.write("q");
    await new Promise((r) => setTimeout(r, 50));
    expect(onResult).toHaveBeenCalledWith({ kind: "exit", exitCode: 0 });
  });

  it("'?' abre el panel de ayuda", async () => {
    const ctx = buildCtx();
    const { stdin, lastFrame } = render(<App version="9.9.9" ctx={ctx} onResult={() => {}} />);
    await new Promise((r) => setTimeout(r, 50));
    stdin.write("?");
    await new Promise((r) => setTimeout(r, 50));
    expect(lastFrame()).toContain("Ayuda");
  });

  // ESC se referencia para asegurar el import del byte ESC en el test bundle.
  it("constante ESC del módulo está definida", () => {
    expect(ESC).toBeDefined();
    expect(ENTER).toBe("\r");
    expect(TAB).toBe("\t");
  });
});
