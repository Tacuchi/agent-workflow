import { render } from "ink";
import type { CliContext } from "../types.js";
import { App, type TuiResult } from "./app.js";

export async function runTui(version: string, ctx: CliContext): Promise<TuiResult> {
  let resolveResult!: (result: TuiResult) => void;
  const resultPromise = new Promise<TuiResult>((resolve) => {
    resolveResult = resolve;
  });

  let resolved = false;
  const settle = (result: TuiResult) => {
    if (resolved) return;
    resolved = true;
    resolveResult(result);
  };

  const instance = render(<App version={version} ctx={ctx} onResult={settle} />, {
    exitOnCtrlC: true,
  });

  instance
    .waitUntilExit()
    .then(() => settle({ kind: "exit", exitCode: 0 }))
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`tui error: ${message}\n`);
      settle({ kind: "exit", exitCode: 1 });
    });

  const result = await resultPromise;

  // Await full ink unmount before returning. Otherwise the caller can race
  // ink's teardown — for example dispatching `aw self update` would let
  // inquirer take over a stdin still being released, causing a phantom
  // "(cancelled)" because residual bytes look like a force-close.
  try {
    await instance.waitUntilExit();
  } catch {
    // already logged above
  }

  return result;
}
