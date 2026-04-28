import APIResponse from '../utils/apiResponse';
import asyncHandler from '../utils/asyncHandler';

// ─── Health Check ─────────────────────────────────────────────────────────────

const healthCheck = asyncHandler(async (req, res) => {
  res.json(new APIResponse(200, { message: 'Server up and running', health: 'Good' }));
});

export default healthCheck;
