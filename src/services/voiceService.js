import axios from 'axios';

const API_URL = 'http://localhost:5202/api/voice';

const voiceService = {
  getVoices: async () => {
    try {
      const response = await axios.get(`${API_URL}/voices`);
      return response.data;
    } catch (error) {
      console.error('Error fetching voices:', error);
      throw new Error('Failed to fetch voices');
    }
  },

  generateVoice: async (text, voiceId) => {
    try {
      const response = await axios.post(`${API_URL}/generate`, { text, voiceId }, {
        responseType: 'arraybuffer',
      });
      return response.data;
    } catch (error) {
      console.error('Error generating voice:', error);
      throw new Error('Failed to generate voice');
    }
  }
};

export default voiceService;