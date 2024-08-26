import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import authService from '../services/auth.js';
import voiceService from '../services/voiceService.js';
import './CreateDebate.css';

const CreateDebate = () => {
  const [topic, setTopic] = useState('');
  const [isPremium, setIsPremium] = useState(false);
  const [questions, setQuestions] = useState(['', '']);
  const [aiConfigurations, setAiConfigurations] = useState([
    { instructions: '', side: 'side1', voiceId: '' },
    { instructions: '', side: 'side2', voiceId: '' },
  ]);
  const [firstSpeaker, setFirstSpeaker] = useState('side1');
  const [debate, setDebate] = useState(null);
  const [currentRound, setCurrentRound] = useState(0);
  const [currentTurn, setCurrentTurn] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [currentResponse, setCurrentResponse] = useState(null);
  const [user, setUser] = useState(null);
  const [audioPlaying, setAudioPlaying] = useState(null);
  const [fullDebateAudio, setFullDebateAudio] = useState(null);
  const [presenterVoiceId, setPresenterVoiceId] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
    } else {
      navigate('/login');
    }
  }, [navigate]);

  useEffect(() => {
    async function fetchVoices() {
      try {
        const voices = await voiceService.getVoices();
        if (voices && voices.length >= 3) {
          setAiConfigurations([
            { ...aiConfigurations[0], voiceId: voices[0].voice_id },
            { ...aiConfigurations[1], voiceId: voices[1].voice_id },
          ]);
          setPresenterVoiceId(voices[2].voice_id);
        } else {
          throw new Error('Not enough voices available');
        }
      } catch (error) {
        console.error('Error fetching voices:', error);
        setError('Failed to fetch voices. Please try again.');
      }
    }
    fetchVoices();
  }, []);

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    console.log('Create Debate button clicked');
    try {
      console.log('Sending request to create debate');
      const response = await axios.post('http://localhost:5202/api/debates', {
        topic,
        isPremium,
        questions,
        aiConfigurations,
        firstSpeaker,
        presenterVoiceId,
      }, {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });
      console.log('Debate created successfully:', response.data);
      setDebate(response.data);
      setCurrentRound(0);
      setCurrentTurn(-1);
      generateNextResponse(response.data._id, 0, 0, response.data.firstSpeaker);
    } catch (error) {
      console.error('Error creating debate:', error.response ? error.response.data : error.message);
      setError(error.response?.data?.message || 'Failed to create debate. Please try again.');
    }
    setLoading(false);
  };

  const generateNextResponse = async (debateId, round, turn, speaker) => {
    try {
      console.log(`Generating response for debate ${debateId}, round ${round}, turn ${turn}, speaker ${speaker}`);
      const response = await axios.post(`http://localhost:5202/api/debates/${debateId}/response`, {
        round,
        turn,
        speaker
      }, {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });
      
      console.log('Response received:', response.data);
      
      setDebate(prevDebate => {
        const updatedDebate = { ...prevDebate };
        if (!updatedDebate.rounds[round]) {
          updatedDebate.rounds[round] = { responses: [] };
        }
        updatedDebate.rounds[round].responses[turn] = response.data;
        updatedDebate.currentRound = round;
        updatedDebate.currentTurn = turn;
        return updatedDebate;
      });
      setCurrentRound(round);
      setCurrentTurn(turn);
    } catch (error) {
      console.error('Error generating response:', error.response?.data || error.message);
      setError('Failed to generate response. Please try again.');
    }
  };

  const judgeDebate = async (debateId) => {
    try {
      const response = await axios.post(`http://localhost:5202/api/debates/${debateId}/judge`, {}, {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });
      setDebate(prevDebate => ({ ...prevDebate, judgeDecision: response.data }));
    } catch (error) {
      console.error('Error judging debate:', error);
      setError('Failed to judge debate. Please try again.');
    }
  };

  const playAudio = (fileName) => {
    if (audioPlaying) {
      audioPlaying.pause();
    }
    const audio = new Audio(`http://localhost:5202/audio/${fileName}`);
    audio.play();
    setAudioPlaying(audio);
  };

  const generateFullDebateAudio = async (debateId) => {
    try {
      const response = await axios.post(`http://localhost:5202/api/debates/${debateId}/generate-full-audio`, {}, {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });
      setFullDebateAudio(response.data.fileName);
    } catch (error) {
      console.error('Error generating full debate audio:', error);
      setError('Failed to generate full debate audio. Please try again.');
    }
  };

  const downloadFullDebateAudio = () => {
    if (fullDebateAudio) {
      window.open(`http://localhost:5202/audio/${fullDebateAudio}`, '_blank');
    }
  };

  const handleNextTurn = () => {
    if (!debate) return;

    let nextTurn = currentTurn + 1;
    let nextRound = currentRound;
    let nextSpeaker;

    if (nextTurn >= 4) {
      nextTurn = 0;
      nextRound++;
    }

    if (nextRound >= questions.length) {
      // Debate is finished, trigger judging
      judgeDebate(debate._id);
      return;
    }

    if (nextTurn === 0) {
      // Start of a new round
      nextSpeaker = debate.firstSpeaker;
    } else {
      // Alternate speakers within the round
      nextSpeaker = currentTurn % 2 === 0 ? 
        (debate.firstSpeaker === 'side1' ? 'side2' : 'side1') : 
        debate.firstSpeaker;
    }

    generateNextResponse(debate._id, nextRound, nextTurn, nextSpeaker);
  };

  return (
    <div className="debate-container">
      {user && (
        <div className="user-info">
          <p>Welcome, {user.username}!</p>
          <button onClick={handleLogout}>Logout</button>
        </div>
      )}
      <div className="create-debate">
        <h2>Create New Debate</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="topic">Debate Topic:</label>
            <input
              type="text"
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Enter debate topic"
              required
            />
          </div>
          <div className="form-group checkbox">
            <input
              type="checkbox"
              id="isPremium"
              checked={isPremium}
              onChange={(e) => setIsPremium(e.target.checked)}
            />
            <label htmlFor="isPremium">Premium Debate</label>
          </div>
          {questions.map((question, index) => (
            <div key={index} className="form-group">
              <label htmlFor={`question-${index}`}>Question {index + 1}:</label>
              <input
                type="text"
                id={`question-${index}`}
                value={question}
                onChange={(e) => {
                  const newQuestions = [...questions];
                  newQuestions[index] = e.target.value;
                  setQuestions(newQuestions);
                }}
                placeholder={`Enter question ${index + 1}`}
                required
              />
            </div>
          ))}
          {aiConfigurations.map((config, index) => (
            <div key={index} className="form-group">
              <label htmlFor={`ai-instructions-${index}`}>AI {index + 1} Instructions:</label>
              <textarea
                id={`ai-instructions-${index}`}
                value={config.instructions}
                onChange={(e) => {
                  const newConfigs = [...aiConfigurations];
                  newConfigs[index].instructions = e.target.value;
                  setAiConfigurations(newConfigs);
                }}
                placeholder={`Enter instructions for AI ${index + 1}`}
                required
              />
            </div>
          ))}
          <div className="form-group">
            <label htmlFor="firstSpeaker">First Speaker:</label>
            <select
              id="firstSpeaker"
              value={firstSpeaker}
              onChange={(e) => setFirstSpeaker(e.target.value)}
            >
              <option value="side1">AI 1</option>
              <option value="side2">AI 2</option>
            </select>
          </div>
          <button type="submit" disabled={loading}>
            {loading ? 'Creating Debate...' : 'Create Debate'}
          </button>
        </form>
      </div>
      
      {debate && (
        <div className="debate-results">
          <h2>Debate Results</h2>
          <div className="debate-topic">
            <h3>Topic: {debate.topic}</h3>
            {debate.questions.map((question, index) => (
              <p key={index}>Question {index + 1}: {question}</p>
            ))}
          </div>
          {debate.rounds && debate.rounds.map((round, roundIndex) => (
            <div key={roundIndex} className="debate-round">
              <h4>Round {roundIndex + 1}</h4>
              <div className="round-responses">
                {round.responses && round.responses.map((response, responseIndex) => (
                  <div key={responseIndex} className="ai-response">
                    <h5>{response.botId === 'side1' ? 'AI 1' : 'AI 2'} - Response {responseIndex + 1}</h5>
                    <p>{response.content}</p>
                    {response.audioFileName && (
                      <button onClick={() => playAudio(response.audioFileName)}>
                        Play Audio
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {currentRound < questions.length && !debate.judgeDecision && (
            <button onClick={handleNextTurn} className="next-turn-button">
              Generate Next Response
            </button>
          )}
          {debate.judgeDecision && (
            <div className="judge-decision">
              <h3>Judge's Decision</h3>
              <p><strong>Winner:</strong> {debate.judgeDecision.winner === 'side1' ? 'AI 1' : 'AI 2'}</p>
              <p><strong>Reasoning:</strong> {debate.judgeDecision.reasoning}</p>
              {debate.judgeDecision.audioFileName && (
                <button onClick={() => playAudio(debate.judgeDecision.audioFileName)}>
                  Play Judge's Decision Audio
                </button>
              )}
              {!fullDebateAudio && (
                <button onClick={() => generateFullDebateAudio(debate._id)} className="generate-audio-button">
                  Generate Full Debate Audio
                </button>
              )}
              {fullDebateAudio && (
                <button onClick={downloadFullDebateAudio} className="download-audio-button">
                  Download Full Debate Audio
                </button>
              )}
            </div>
          )}
        </div>
      )}
      
      {error && <div className="error-message">{error}</div>}
      
      {showResponseModal && currentResponse && (
        <div className="modal">
          <div className="modal-content">
            <h3>{currentResponse.botId === 'side1' ? 'AI 1' : 'AI 2'} Response</h3>
            <p>{currentResponse.content}</p>
            <button onClick={() => setShowResponseModal(false)} className="close-modal-btn">Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateDebate;