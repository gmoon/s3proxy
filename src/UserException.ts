export class UserException extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'UserException';
    this.code = code;

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, UserException);
    }
  }
}
