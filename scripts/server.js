const express = require('express');
const app = express();

app.use('/public/', express.static('./public'));

const mongoose = require('mongoose')

main().catch(err => console.error('MongoDB connection error:', err)); // Log MongoDB connection errors

async function main() {
  // try {
  //   await mongoose.connect('mongodb+srv://Daniel:2foADJtqgvjQ8CMA@cluster0.n7n7slw.mongodb.net/?retryWrites=true&w=majority');
  //   console.log('Connected to MongoDB');
  // } catch (error) {
  //   console.error('MongoDB connection error:', error);
  //   throw error; // Rethrow the error to stop the application startup
  // }
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

app.set("view engine", "ejs");

app.get('/crime', async (req, res) => {
  try {
    const allCriminals = await CriminalProfile.find({});
    res.json(allCriminals);
  } catch (error) {
    console.error('Error fetching criminal data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get("/", (req, res) => {
    res.render("index");
});

app.get('/login', (req, res) => {
  res.render("login");
})

app.get("/signup", (req, res) => {
    res.render("signup");
});

app.get("/map", (req, res) => {
    res.render("map");
});

app.get("/list", (req, res) => {
    res.render("list");
});

app.get("/protection", (req, res) => {
    res.render("protection");
});

app.get("/robots", (req, res) => {
    res.render("login");
});

app.get("/drones", (req, res) => {
    res.render("login");
});

app.get("/cybersecurity", (req, res) => {
    res.render("login");
});

app.listen(3000, () => {
  console.log("Listening to Port 3000.")
})
