exports.handler = async (event, context) => {
  console.log('Logout called');
  
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // For demo purposes, logout is just a success response
  // In a real implementation, you'd invalidate tokens in a database
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ message: 'Logged out successfully' }),
  };
};