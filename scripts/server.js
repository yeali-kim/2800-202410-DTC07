require(`dotenv`).config();
const express = require(`express`);
const session = require(`express-session`);
const mongoose = require(`mongoose`);
const bcrypt = require(`bcrypt`);
const Joi = require(`joi`);

const mongo_user = process.env.MONGODB_USER;
const mongo_password = process.env.MONGODB_PASSWORD;
const mongo_host = process.env.MONGODB_HOST;
const mongo_db = process.env.MONGODB_DATABASE;
const node_session_secret = process.env.NODE_SESSION_SECRET;

const app = express();
const PORT = process.env.PORT || 3000;
const saltRounds = Number(process.env.SALT_ROUNDS);
const expireTime = 1000 * 60 * 60;

main().catch(err => console.error('MongoDB connection error:', err)); // Log MongoDB connection errors

async function main() {
  try {
    await mongoose.connect(`mongodb+srv://${mongo_user}:${mongo_password}@${mongo_host}/${mongo_db}`);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error; // Rethrow the error to stop the application startup
  }

  app.listen(PORT, () => {
      console.log("Listening to port "+PORT);
  });
}

const criminalSchema = new mongoose.Schema({
  name: String,
  DOB: String,
  coordinates: Object,
  date_of_crime: String,
  sentence: String
});

const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
})

// Ensure that the model name matches the actual collection name
const CriminalProfile = mongoose.model("criminalProfile", criminalSchema);
const Users = mongoose.model("users", userSchema);

app.set("view engine", "ejs");

app.use(
    session({
        secret: node_session_secret,
        resave: false,
        saveUninitialized: true,
        // cookie: { secure: true },
    })
);

app.use(express.urlencoded({ extended: false }));

app.get('/crime', async (req, res) => {
  try {
    const allCriminals = await CriminalProfile.find();
    console.log(allCriminals)
    res.json(allCriminals);
  } catch (error) {
    console.error('Error fetching criminal data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/users', async(req, res) => {
  const users = await Users.find();
  res.json(users)
})

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

app.get("/*", (req, res) => {
  res.status(404);
  res.send("404: Page Not Found");
})
