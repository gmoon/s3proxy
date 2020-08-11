module.exports = class UserException extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
};
