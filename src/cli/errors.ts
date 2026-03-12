export class CLIAbortError extends Error {
  public readonly exitCode: number;

  constructor(exitCode = 1) {
    super(`CLI aborted with exit code ${exitCode}`);
    this.name = 'CLIAbortError';
    this.exitCode = exitCode;
  }
}

export function abortCli(exitCode = 1): never {
  throw new CLIAbortError(exitCode);
}

export function isCLIAbortError(error: unknown): error is CLIAbortError {
  return error instanceof CLIAbortError;
}
