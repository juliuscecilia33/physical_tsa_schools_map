// Quick test script for the AI Search API
// Run with: node test-ai-api.js

async function testAISearch() {
  try {
    console.log('Testing AI Search API...\n');

    const response = await fetch('http://localhost:3001/api/ai-search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: 'Show me facilities in Austin with 4.5+ rating',
        conversationHistory: []
      }),
    });

    console.log('Status:', response.status);

    const data = await response.json();

    if (response.ok) {
      console.log('\n✅ SUCCESS!\n');
      console.log('AI Response:', data.message);
      console.log('\nFilters Applied:', JSON.stringify(data.filters, null, 2));
    } else {
      console.log('\n❌ ERROR!\n');
      console.log('Error:', data.error);
      console.log('Message:', data.message);
    }
  } catch (error) {
    console.error('\n❌ FETCH ERROR:\n', error.message);
  }
}

testAISearch();
