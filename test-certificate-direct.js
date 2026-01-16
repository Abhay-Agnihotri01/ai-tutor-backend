import fetch from 'node-fetch';

// Test certificate generation directly
async function testCertificateGeneration() {
  console.log('🚀 === DIRECT CERTIFICATE TEST START ===');
  
  try {
    // You'll need to replace these with actual values
    const API_URL = 'http://localhost:5000';
    const COURSE_ID = '1'; // Replace with actual course ID
    const TOKEN = 'your_jwt_token_here'; // Replace with actual JWT token
    
    console.log('📡 Testing certificate generation endpoint...');
    console.log('🔗 URL:', `${API_URL}/api/certificates/generate/${COURSE_ID}`);
    
    const response = await fetch(`${API_URL}/api/certificates/generate/${COURSE_ID}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📊 Response status:', response.status);
    console.log('✅ Response ok:', response.ok);
    
    const responseText = await response.text();
    console.log('📄 Raw response:', responseText);
    
    try {
      const data = JSON.parse(responseText);
      console.log('📊 Parsed response:', JSON.stringify(data, null, 2));
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError.message);
    }
    
  } catch (error) {
    console.error('💥 Test error:', error.message);
    console.error('📍 Error stack:', error.stack);
  }
}

// Run the test
testCertificateGeneration();