// Simple token refresh for demo purposes
const generateToken = (userId) => {
  const payload = {
    userId,
    exp: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
    iat: Date.now(),
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
};

exports.handler = async (event, context) => {
  console.log('Token refresh called');
  
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { refreshToken } = JSON.parse(event.body || '{}');
    
    if (!refreshToken) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Refresh token is required' }),
      };
    }

    // Decode the refresh token (simple demo implementation)
    try {
      const payload = JSON.parse(Buffer.from(refreshToken, 'base64').toString());
      
      if (payload.exp < Date.now()) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Refresh token expired' }),
        };
      }

      const userId = payload.userId.replace('-refresh', '');
      const newAccessToken = generateToken(userId);
      const newRefreshToken = generateToken(userId + '-refresh');

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
          expiresIn: 86400,
        }),
      };
    } catch (error) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid refresh token' }),
      };
    }
  } catch (error) {
    console.error('Token refresh error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};