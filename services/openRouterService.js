const axios = require('axios');

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

const models = {
  side1: 'meta-llama/llama-2-13b-chat',
  side2: 'mistralai/mistral-7b-instruct',
  judge: 'nousresearch/nous-hermes-2-mixtral-8x7b-dpo'
};

const apiKeys = {
  side1: process.env.OPENROUTER_API_KEY_SIDE1,
  side2: process.env.OPENROUTER_API_KEY_SIDE2,
  judge: process.env.OPENROUTER_API_KEY_JUDGE
};

async function generateResponse(side, prompt, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Generating response for ${side} (Attempt ${attempt})`);
      const response = await axios.post(OPENROUTER_API_URL, {
        model: models[side],
        messages: [{ role: 'user', content: prompt }]
      }, {
        headers: {
          'Authorization': `Bearer ${apiKeys[side]}`,
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'AI Debates App'
        },
        timeout: 30000 // 30 seconds timeout
      });

      console.log(`Response generated successfully for ${side}`);
      return response.data.choices[0].message.content;
    } catch (error) {
      console.error(`Error generating response for ${side} (Attempt ${attempt}):`, error.message);
      if (attempt === retries) {
        throw new Error(`Failed to generate response for ${side} after ${retries} attempts: ${error.message}`);
      }
      // Wait for 2 seconds before the next retry
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

async function judgeDebate(debate) {
  console.log('Judging debate');
  const prompt = `You are an impartial judge. Review the following debate and decide the winner:
  
  Topic: ${debate.topic}
  
  Side 1 Arguments:
  ${debate.rounds.map(round => round.responses.find(r => r.botId === 'side1').content).join('\n')}
  
  Side 2 Arguments:
  ${debate.rounds.map(round => round.responses.find(r => r.botId === 'side2').content).join('\n')}
  
  Please provide your decision and reasoning in the following format:
  Winner: [Side 1 or Side 2]
  Reasoning: [Your detailed explanation for the decision]`;

  try {
    const judgement = await generateResponse('judge', prompt);
    console.log('Judgement generated successfully');
    return judgement;
  } catch (error) {
    console.error('Error judging debate:', error.message);
    throw new Error(`Failed to judge debate: ${error.message}`);
  }
}

module.exports = { generateResponse, judgeDebate };