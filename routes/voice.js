const express = require('express');
const router = express.Router();
const voiceService = require('../services/voiceService');
const path = require('path');
const fs = require('fs');

router.get('/voices', async (req, res) => {
  try {
    const voices = await voiceService.getVoices();
    res.json(voices);
  } catch (error) {
    console.error('Error fetching voices:', error);
    res.status(500).json({ message: 'Failed to fetch voices' });
  }
});

router.post('/generate', async (req, res) => {
  try {
    const { text, voiceId } = req.body;
    const audioData = await voiceService.generateVoice(text, voiceId);
    
    const fileName = `generated_voice_${Date.now()}.mp3`;
    const filePath = path.join(__dirname, '..', 'public', 'audio', fileName);
    
    fs.writeFileSync(filePath, audioData);
    
    res.json({ fileName });
  } catch (error) {
    console.error('Error generating voice:', error);
    res.status(500).json({ message: 'Failed to generate voice' });
  }
});

module.exports = router;