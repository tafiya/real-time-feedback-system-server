const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const bodyParser = require('body-parser');
require('dotenv').config();
const { HfInference } = require('@huggingface/inference');

// Express app initialization
const app = express();

// Middleware for parsing JSON
app.use(bodyParser.json());

// Enable CORS for all routes
app.use(cors({
    origin: 'https://real-time-feedback-system.vercel.app',  // Allow only this origin
  }));

// MongoDB connection URI using environment variables
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.bescutn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create MongoClient with stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let feedbackCollection;

// Hugging Face Inference Client
const hf = new HfInference(process.env.HF_API_KEY);

// Connect to MongoDB and initialize feedback collection
async function connectDB() {
  try {
    // await client.connect();
    const db = client.db('feedbackSystemDB');
    feedbackCollection = db.collection('feedbacks');
    console.log("Connected to MongoDB!");
  } catch (err) {
    console.error("Error connecting to MongoDB:", err);
  }
}
connectDB();

// Use Hugging Face for sentiment analysis
async function analyzeSentiment(feedback) {
  try {
    const result = await hf.textClassification({
      model: 'distilbert-base-uncased-finetuned-sst-2-english', // Hugging Face sentiment analysis model
      inputs: feedback,
    });

    const label = result[0].label.toLowerCase(); // "positive" or "negative"
    return label.includes('positive') ? 'positive' : label.includes('negative') ? 'negative' : 'neutral';
  } catch (error) {
    console.error("Error analyzing sentiment:", error);
    return 'neutral';
  }
}

// POST route for submitting feedback
app.post('/feedbacks', async (req, res) => {
  const { feedback } = req.body;

  if (!feedback) {
    return res.status(400).json({ message: 'Feedback is required' });
  }

  // Analyze sentiment of the feedback using Hugging Face
  const sentiment = await analyzeSentiment(feedback);

  // Save feedback and sentiment analysis in MongoDB
  const feedbackData = {
    feedback,
    sentiment,
    date: new Date(),
  };

  try {
    await feedbackCollection.insertOne(feedbackData);
    return res.status(200).json({ message: 'Feedback submitted successfully', sentiment });
  } catch (err) {
    return res.status(500).json({ message: 'Error saving feedback', error: err });
  }
});

// Simple GET route to retrieve all feedbacks
app.get('/feedbacks', async (req, res) => {
  try {
    const feedbacks = await feedbackCollection.find({}).toArray();
    return res.status(200).json(feedbacks);
  } catch (err) {
    return res.status(500).json({ message: 'Error retrieving feedback', error: err });
  }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
