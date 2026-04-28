class APIError extends Error {
  public statusCode: number;
  public data: any;
  public errors: any[] | Record<string, any>;
  public success: boolean;

  constructor(
    statusCode: number,
    message: string,
    errors: any[] | Record<string, any> = [],
    stack: string = '',
  ) {
    super(message);
    this.statusCode = statusCode;
    this.data = null;
    this.errors = errors;
    this.success = false;
    this.name = this.constructor.name;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export default APIError;
