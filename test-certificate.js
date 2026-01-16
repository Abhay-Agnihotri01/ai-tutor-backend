// Simple test script to check certificate generation
import fetch from 'node-fetch';

const testCertificate = async () => {
  try {
    // You'll need to replace these with actual values
    const courseId = 'your-course-id';
    const token = 'your-jwt-token';
    
    console.log('Testing certificate generation...');
    
    const response = await fetch(`http://localhost:5000/api/certificates/generate/${courseId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    console.log('Response:', data);
    
  } catch (error) {
    console.error('Test error:', error);
  }
};

// Uncomment to run test
// testCertificate();

console.log('Certificate test script ready. Update courseId and token, then uncomment testCertificate() to run.');