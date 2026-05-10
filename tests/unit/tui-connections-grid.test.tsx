import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import type { SelfMcpConnectionView } from "../../src/application/self/mcp-config.js";
import { ConnectionsGrid } from "../../src/cli/tui/components/connections-grid.js";

function view(
  nombre: string,
  dsnVar: string,
  claude: "si" | "no" | "drift" = "no",
  codex: "si" | "no" | "drift" = "no",
): SelfMcpConnectionView {
  return {
    nombre,
    server_name: nombre,
    dsn_var: dsnVar,
    dsn_visible: false,
    instalado: { claude_code: claude, codex },
  };
}

describe("ConnectionsGrid (TUI)", () => {
  it("placeholder cuando vacío menciona la hotkey n", () => {
    const { lastFrame } = render(<ConnectionsGrid connections={[]} cursor={0} isActive={true} />);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("sin conexiones");
    expect(frame).toContain("n");
  });

  it("muestra header columnar (nombre / DSN var / Claude / Codex)", () => {
    const { lastFrame } = render(
      <ConnectionsGrid
        connections={[view("cert", "DB_CERT_DSN", "si", "no")]}
        cursor={0}
        isActive={true}
      />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("nombre");
    expect(frame).toContain("DSN var");
    expect(frame).toContain("Claude");
    expect(frame).toContain("Codex");
  });

  it("renderea ✓ / – / ! para los estados", () => {
    const { lastFrame } = render(
      <ConnectionsGrid
        connections={[view("a", "A", "si", "no"), view("b", "B", "drift", "si")]}
        cursor={0}
        isActive={true}
      />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("✓");
    expect(frame).toContain("–");
    expect(frame).toContain("!");
  });

  it("cursor muestra ❯ en la fila activa", () => {
    const { lastFrame } = render(
      <ConnectionsGrid
        connections={[view("alpha", "A_DSN"), view("beta", "B_DSN")]}
        cursor={1}
        isActive={true}
      />,
    );
    const lines = (lastFrame() ?? "").split("\n");
    const betaLine = lines.find((l) => l.includes("beta"));
    expect(betaLine).toContain("❯");
    const alphaLine = lines.find((l) => l.includes("alpha"));
    expect(alphaLine).not.toContain("❯");
  });
});
