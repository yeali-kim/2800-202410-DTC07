const express = require('express');
const app = express();
const mongoose = require('mongoose');
require('dotenv').config();
const PORT = 3000;

main().catch(err => console.log(err));

const mongoPassword = process.env.MONGODB_PASSWORD;

async function main() {
  await mongoose.connect(`mongodb+srv://Daniel:${mongoPassword}@cluster0.n7n7slw.mongodb.net/criminals`);
  console.log('Connected to MongoDB');
  
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

const criminalSchema = new mongoose.Schema({
  name: String,
  DOB: String,
  coordinates: Object,
  date_of_crime: String,
  sentence: String
});

// Ensure that the model name matches the actual collection name
const CriminalProfile = mongoose.model('criminalProfile', criminalSchema);

app.get('/crime', async (req, res) => {
  try {
    const allCriminals = await CriminalProfile.find({});
    res.json(allCriminals);
  } catch (error) {
    console.error('Error fetching criminal data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
