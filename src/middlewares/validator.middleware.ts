import type { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

import { APIError } from '../utils/index';

export function validate(req: Request, res: Response, next: NextFunction) {
  const result = validationResult(req);
  if (result.isEmpty()) {
    return next();
  }

  const extractedErrors: Record<string, string[]> = {};
  result.array().forEach((error) => {
    if (error.type === 'field') {
      if (!extractedErrors[error.path]) {
        extractedErrors[error.path] = [];
      }
      extractedErrors[error.path]?.push(error.msg);
    }
  });

  throw new APIError(422, 'Recieved data is not valid', extractedErrors);
}
