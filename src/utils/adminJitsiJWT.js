import jwt from 'jsonwebtoken';

export const generateAdminJitsiToken = (roomName, adminName, adminId) => {
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
        id: adminId,
        name: adminName,
        email: 'admin@system.local',
        moderator: true,
        avatar: ''
      },
      features: {
        livestreaming: true,
        recording: true,
        transcription: true,
        'outbound-call': true
      }
    },
    moderator: true
  };

  return jwt.sign(payload, secret, { algorithm: 'HS256' });
};