const axios = require('axios');

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

async function getVoices() {
  try {
    const response = await axios.get(`${ELEVENLABS_API_URL}/voices`, {
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
      },
    });
    return response.data.voices;
  } catch (error) {
    console.error('Error fetching voices:', error.response?.data || error.message);
    throw new Error('Failed to fetch voices');
  }
}

async function generateVoice(text, voiceId) {
  if (!voiceId) {
    throw new Error('Voice ID is required');
  }
  try {
    const response = await axios.post(
      `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`,
      { text },
      {
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error generating voice:', error.response?.data || error.message);
    throw new Error('Failed to generate voice');
  }
}

module.exports = { getVoices, generateVoice };