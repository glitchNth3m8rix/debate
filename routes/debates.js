const express = require('express');
const router = express.Router();
const Debate = require('../models/Debate');
const auth = require('../middleware/auth');
const { generateResponse, judgeDebate } = require('../services/openRouterService');
const voiceService = require('../services/voiceService');
const path = require('path');
const fs = require('fs');

// Create a new debate
router.post('/', auth, async (req, res) => {
  console.log('Received request to create debate:', req.body);
  try {
    const debateData = {
      ...req.body,
      rounds: req.body.questions.map(question => ({ question, responses: [] }))
    };
    const debate = new Debate(debateData);
    await debate.save();
    console.log('Debate created successfully:', debate);
    res.status(201).json(debate);
  } catch (error) {
    console.error('Error creating debate:', error);
    res.status(400).json({ message: error.message });
  }
});

// Get all debates
router.get('/', auth, async (req, res) => {
  try {
    const debates = await Debate.find();
    res.json(debates);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get a specific debate
router.get('/:id', auth, async (req, res) => {
  try {
    const debate = await Debate.findById(req.params.id);
    if (!debate) {
      return res.status(404).json({ message: 'Debate not found' });
    }
    res.json(debate);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update the response generation route
router.post('/:id/response', auth, async (req, res) => {
  try {
    const { round, turn, speaker } = req.body;
    console.log(`Generating response for debate ${req.params.id}, round ${round}, turn ${turn}, speaker ${speaker}`);
    
    const debate = await Debate.findById(req.params.id);

    if (!debate) {
      return res.status(404).json({ message: 'Debate not found' });
    }

    if (!debate.rounds[round]) {
      console.error(`Invalid round: ${round}. Available rounds:`, debate.rounds);
      return res.status(400).json({ message: 'Invalid round' });
    }

    const prompt = `${debate.topic}\n\nQuestion: ${debate.rounds[round].question}\n\nPrevious responses:\n${debate.rounds[round].responses.map(r => `${r.botId}: ${r.content}`).join('\n')}\n\nYour turn to respond as ${speaker}.`;

    console.log('Generating response with prompt:', prompt);
    const response = await generateResponse(speaker, prompt);
    console.log('Generated response:', response);

    // Generate voice for the response
    const aiConfig = debate.aiConfigurations.find(config => config.side === speaker);
    if (!aiConfig) {
      throw new Error(`AI configuration not found for speaker: ${speaker}`);
    }
    const voiceId = aiConfig.voiceId;
    console.log('Using voice ID:', voiceId);
    const audioData = await voiceService.generateVoice(response, voiceId);

    const fileName = `debate_${debate._id}_round_${round}_turn_${turn}.mp3`;
    const filePath = path.join(__dirname, '..', 'public', 'audio', fileName);
    fs.writeFileSync(filePath, audioData);

    const updatedDebate = await Debate.findOneAndUpdate(
      { _id: debate._id },
      {
        $push: { [`rounds.${round}.responses`]: {
          botId: speaker,
          content: response,
          audioFileName: fileName
        }},
        $set: { currentRound: round, currentTurn: turn }
      },
      { new: true, runValidators: true }
    );

    if (!updatedDebate) {
      throw new Error('Failed to update debate');
    }

    res.json(updatedDebate.rounds[round].responses[updatedDebate.rounds[round].responses.length - 1]);
  } catch (error) {
    console.error('Error in /response route:', error);
    res.status(500).json({ message: 'Failed to generate response', error: error.message });
  }
});

// Update the judge route
router.post('/:id/judge', auth, async (req, res) => {
  try {
    const debate = await Debate.findById(req.params.id);

    if (!debate) {
      return res.status(404).json({ message: 'Debate not found' });
    }

    const judgement = await judgeDebate(debate);

    // Parse the judgement
    const winnerMatch = judgement.match(/Winner:\s*(Side 1|Side 2)/);
    const reasoningMatch = judgement.match(/Reasoning:\s*([\s\S]*)/);

    if (!winnerMatch || !reasoningMatch) {
      throw new Error('Failed to parse judgement');
    }

    const judgeDecision = {
      winner: winnerMatch[1] === 'Side 1' ? 'side1' : 'side2',
      reasoning: reasoningMatch[1].trim()
    };

    // Generate voice for the judgement
    const audioData = await voiceService.generateVoice(judgement, debate.presenterVoiceId);

    const fileName = `debate_${debate._id}_judgement.mp3`;
    const filePath = path.join(__dirname, '..', 'public', 'audio', fileName);
    fs.writeFileSync(filePath, audioData);

    judgeDecision.audioFileName = fileName;

    const updatedDebate = await Debate.findOneAndUpdate(
      { _id: debate._id },
      {
        $set: {
          judgeDecision: judgeDecision,
          status: 'completed'
        }
      },
      { new: true, runValidators: true }
    );

    if (!updatedDebate) {
      throw new Error('Failed to update debate with judge decision');
    }

    res.json(updatedDebate.judgeDecision);
  } catch (error) {
    console.error('Error judging debate:', error);
    res.status(500).json({ message: 'Failed to judge debate' });
  }
});

// Add a new route for generating the full debate audio
router.post('/:id/generate-full-audio', auth, async (req, res) => {
  try {
    const debate = await Debate.findById(req.params.id);

    if (!debate) {
      return res.status(404).json({ message: 'Debate not found' });
    }

    let fullScript = `Welcome to our AI debate on the topic: ${debate.topic}. `;
    fullScript += `Our two AI opponents will be discussing this topic in depth. Let's begin!\n\n`;

    for (let i = 0; i < debate.rounds.length; i++) {
      fullScript += `Round ${i + 1}, Question: ${debate.rounds[i].question}\n\n`;
      for (const response of debate.rounds[i].responses) {
        fullScript += `${response.botId === 'side1' ? 'AI 1' : 'AI 2'}: ${response.content}\n\n`;
      }
      if (i < debate.rounds.length - 1) {
        fullScript += `Now, let's move on to the next round.\n\n`;
      }
    }

    if (debate.judgeDecision) {
      fullScript += `The debate has concluded. The winner is ${debate.judgeDecision.winner === 'side1' ? 'AI 1' : 'AI 2'}. `;
      fullScript += `The reasoning for this decision is: ${debate.judgeDecision.reasoning}\n\n`;
    }

    fullScript += `Thank you for listening to our AI debate. We hope you found it informative and engaging.`;

    const audioData = await voiceService.generateVoice(fullScript, debate.presenterVoiceId);

    const fileName = `debate_${debate._id}_full_audio.mp3`;
    const filePath = path.join(__dirname, '..', 'public', 'audio', fileName);
    fs.writeFileSync(filePath, audioData);

    const updatedDebate = await Debate.findOneAndUpdate(
      { _id: debate._id },
      { $set: { fullDebateAudioFileName: fileName } },
      { new: true, runValidators: true }
    );

    if (!updatedDebate) {
      throw new Error('Failed to update debate with full audio file name');
    }

    res.json({ fileName: updatedDebate.fullDebateAudioFileName });
  } catch (error) {
    console.error('Error generating full debate audio:', error);
    res.status(500).json({ message: 'Failed to generate full debate audio' });
  }
});

module.exports = router;