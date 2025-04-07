/**
 * Standard success response
 */
export const successResponse = (res, data, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
};

/**
 * Standard error response
 */
export const errorResponse = (res, message = 'Internal server error', statusCode = 500, error = null) => {
  const response = {
    success: false,
    message
  };

  if (error && process.env.NODE_ENV === 'development') {
    // Safely extract error information without serializing the entire object
    response.errorDetails = {
      message: error.message || 'Unknown error',
      name: error.name || 'Error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };
  }

  return res.status(statusCode).json(response);
};