const mongoose = require('mongoose');

const DebateSchema = new mongoose.Schema({
  topic: {
    type: String,
    required: true,
  },
  isPremium: {
    type: Boolean,
    default: false,
  },
  questions: [{
    type: String,
    required: true,
  }],
  aiConfigurations: [{
    instructions: String,
    side: {
      type: String,
      enum: ['side1', 'side2'],
      required: true
    },
    voiceId: String,
  }],
  firstSpeaker: {
    type: String,
    enum: ['side1', 'side2'],
    required: true
  },
  rounds: [{
    question: {
      type: String,
      required: true
    },
    responses: [{
      botId: {
        type: String,
        enum: ['side1', 'side2'],
        required: true
      },
      content: {
        type: String,
        required: true
      },
      audioFileName: String,
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],
  }],
  currentRound: {
    type: Number,
    default: 0
  },
  currentTurn: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['created', 'in_progress', 'completed'],
    default: 'created'
  },
  judgeDecision: {
    winner: {
      type: String,
      enum: ['side1', 'side2']
    },
    reasoning: String,
    audioFileName: String,
  },
  presenterVoiceId: String,
  fullDebateAudioFileName: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

DebateSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Debate', DebateSchema);