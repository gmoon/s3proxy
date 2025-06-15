export class UserException extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.name = 'UserException';
        this.code = code;
        // Maintains proper stack trace for where our error was thrown
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, UserException);
        }
    }
}
//# sourceMappingURL=UserException.js.map