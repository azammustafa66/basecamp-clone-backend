class APIResponse {
  public statusCode;
  public data;
  public message;
  public success;

  constructor(statusCode: number, data: any = null, message: string = 'Success') {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    this.success = this.statusCode < 400;
  }
}

export default APIResponse;
