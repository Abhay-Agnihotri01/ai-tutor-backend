import ActivityLog from '../models/ActivityLog.js';

export const trackActivity = (action, resource) => {
  return async (req, res, next) => {
    const originalSend = res.send;

    res.send = function (data) {
      // Only log successful operations and exclude activity polling
      if (res.statusCode >= 200 && res.statusCode < 300 && !req.originalUrl.includes('/api/admin/activities')) {
        logActivity(req, action, resource, data);
      }
      originalSend.call(this, data);
    };

    next();
  };
};

const logActivity = async (req, action, resource, responseData) => {
  try {
    if (!req.user) return;

    const details = {
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      query: req.query,
      body: sanitizeBody(req.body)
    };

    await ActivityLog.create({
      userId: req.user.id,
      action,
      resource,
      resourceId: req.params.id || req.params.courseId || req.params.userId,
      details,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    });
  } catch (error) {
    console.error('Activity logging error:', error);
  }
};

const sanitizeBody = (body) => {
  if (!body) return null;

  const sanitized = { ...body };
  // Remove sensitive fields
  delete sanitized.password;
  delete sanitized.token;
  delete sanitized.secret;

  return sanitized;
};

export default trackActivity;