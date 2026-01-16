import jwt from 'jsonwebtoken';

export const generateJitsiJWT = (roomName, userInfo, role) => {
  const appId = process.env.JITSI_APP_ID || 'vpaas-magic-cookie-12345678901234567890';
  const secret = process.env.JITSI_JWT_SECRET || 'jitsi-jwt-secret-key-change-in-production';

  const payload = {
    iss: appId,
    aud: 'jitsi',
    exp: Math.floor(Date.now() / 1000) + 7200,
    nbf: Math.floor(Date.now() / 1000) - 10,
    sub: '8x8.vc',
    room: roomName,
    context: {
      user: {
        id: userInfo.userId || 'user-' + Date.now(),
        name: userInfo.displayName,
        email: userInfo.email,
        moderator: role === 'instructor' || role === 'admin'
      },
      features: {
        livestreaming: role === 'instructor' || role === 'admin',
        recording: role === 'instructor' || role === 'admin'
      }
    }
  };

  return jwt.sign(payload, secret, {
    algorithm: 'HS256'
  });
};