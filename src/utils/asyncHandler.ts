import type { Request, Response, NextFunction, RequestHandler } from 'express';

const asyncHandler = <ReqType = Request>(
  requestHandler: (req: ReqType, res: Response, next: NextFunction) => Promise<any>,
): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(requestHandler(req as any, res, next)).catch((err) => next(err));
  };
};

export default asyncHandler;
