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
const APIKEY = process.env.GOOGLE_MAPS_API_KEY;

const app = express();
const PORT = process.env.PORT || 3000;
const saltRounds = Number(process.env.SALT_ROUNDS);
const expireTime = 1000 * 60 * 60;

main().catch((err) => console.error("MongoDB connection error:", err)); // Log MongoDB connection errors

async function main() {
    try {
        await mongoose.connect(
            `mongodb+srv://${mongo_user}:${mongo_password}@${mongo_host}/${mongo_db}`
        );
        console.log("Connected to MongoDB");
    } catch (error) {
        console.error("MongoDB connection error:", error);
        throw error; // Rethrow the error to stop the application startup
    }

    app.listen(PORT, () => {
        console.log("Listening to port " + PORT);
    });
}

const criminalSchema = new mongoose.Schema({
    firstName: String,
    middleName: String,
    lastName: String,
    address: String,
    dob: String,
    gender: String,
    image: String,
    physicalDescriptions: Array(String),
    convictions: Array({ crime: String, date: String, sentence: String }),
});

const userSchema = new mongoose.Schema({
    username: String,
    email: String,
    password: String,
});

const robotSchema = new mongoose.Schema({
    model: String,
    manufacturer: String,
    price: Number,
    description: String,
});

const droneSchema = new mongoose.Schema({
    model: String,
    manufacturer: String,
    price: Number,
    colour: String,
    weight: Number,
    description: String,
});

const cyberSchema = new mongoose.Schema({
    price: Number,
    description: String,
    manufacturer: String,
    model: String,
    url: String,
});

// Ensure that the model name matches the actual collection name
const CriminalProfile = mongoose.model("criminalProfile", criminalSchema);
const Users = mongoose.model("users", userSchema);
const Robots = mongoose.model("robotprofiles", robotSchema);
const Drones = mongoose.model("droneprofiles", droneSchema);
const CyberSecurities = mongoose.model("cybersecurityprofiles", cyberSchema);

app.set("view engine", "ejs");

app.use(express.static(__dirname + "/../public"));

app.use(
    session({
        secret: node_session_secret,
        resave: false,
        saveUninitialized: true,
        // cookie: { secure: true },
    })
);

app.use(express.urlencoded({ extended: false }));

app.get("/crimes", async (req, res) => {
    try {
        const allCriminals = await CriminalProfile.find();
        console.log(allCriminals);
        res.json(allCriminals);
    } catch (error) {
        console.error("Error fetching criminal data:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get("/createCrimes", async (req, res) => {
    await CriminalProfile.create();
    res.send("Completed");
});

app.get("/users", async (req, res) => {
    const users = await Users.find();
    res.json(users);
});

app.get("/", (req, res) => {
    res.render("index");
});

app.get("/login", (req, res) => {
    res.render("login");
});

app.post("/login", (req, res) => {
    const email = req.body.email;
    const password = req.body.password;

    const schema = Joi.object({
        password: Joi.string().max(20).required(),
        email: Joi.string().email({
            minDomainSegments: 2,
            tlds: { allow: ["com", "ca"] },
        }),
    });

    const validationResult = schema.validate({ password, email });
    if (validationResult.error != null) {
        console.log(validationResult.error);
        res.redirect("/login");
        return;
    }

    req.session.email = email;
    req.session.password = password;

    res.redirect("/map");
});

app.get("/signup", (req, res) => {
    res.render("signup");
});

app.post("/signup", async (req, res) => {
    const username = req.body.name;
    const email = req.body.email;
    const password = req.body.password;

    const schema = Joi.object({
        username: Joi.string().alphanum().max(20).required(),
        password: Joi.string().max(20).required(),
        email: Joi.string().email({
            minDomainSegments: 2,
            tlds: { allow: ["com", "ca"] },
        }),
    });

    const validationResult = schema.validate({ username, password, email });
    if (validationResult.error != null) {
        console.log(validationResult.error);
        res.redirect("/signup");
        return;
    }
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    await Users.create({
        username: username,
        email: email,
        password: hashedPassword,
    });

    req.session.email = email;
    req.session.password = password;

    res.redirect("/map");
});

app.get("/resetPassword", (req, res) => {
    res.render("resetPassword");
});

app.post("/resetPassword", async (req, res) => {
    const email = req.body.email;
    const password = req.body.password;

    const schema = Joi.object({
        password: Joi.string().max(20).required(),
        email: Joi.string().email({
            minDomainSegments: 2,
            tlds: { allow: ["com", "ca"] },
        }),
    });

    const validationResult = schema.validate({ password, email });
    if (validationResult.error != null) {
        console.log(validationResult.error);
        res.redirect("/login");
        return;
    }
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const user = await Users.findOne({ email: email });

    if (user) {
        await Users.updateOne({ email: email }, { password: hashedPassword });
    }

    res.redirect("/login");
});

async function validateUser(req, res, next) {
    if (req.session.email && req.session.password) {
        const user = await Users.findOne({ email: req.session.email });

        if (user && bcrypt.compareSync(req.session.password, user.password)) {
            req.session.user = user;
            req.session.cookie.maxAge = expireTime;
            return next();
        }
    }

    res.redirect("/login");
}

app.get("/filter", validateUser, (req, res) => {
    res.render("filter");
});

app.get("/map", validateUser, async (req, res) => {
    const criminals = await CriminalProfile.find();
    res.render("map", {
        criminals: criminals,
        user: req.session.user,
        apiKey: APIKEY,
    });
});

app.get("/list", async (req, res) => {
    const criminals = await CriminalProfile.find({});
    res.render("list", {
        criminals: criminals,
        user: req.session.user,
        apiKey: APIKEY,
    });
});

app.get("/protection", validateUser, (req, res) => {
    res.render("protection");
});

app.get("/robots", validateUser, async (req, res) => {
    const robots = await Robots.find();
    res.render("robots", { robots: robots, user: req.session.user });
});

app.get("/drones", validateUser, async (req, res) => {
    const drones = await Drones.find();
    res.render("drones", { drones: drones, user: req.session.user });
});

app.get("/cybersecurity", validateUser, async (req, res) => {
    const cybersecurities = await CyberSecurities.find();
    res.render("cybersecurity", {
        cybersecurities: cybersecurities,
        user: req.session.user,
    });
});

app.get("/profile", validateUser, async (req, res) => {
    res.render("profile", { user: req.session.user });
});

app.get("/logout", validateUser, (req, res) => {
    req.session.destroy();
    res.redirect("/login");
});

app.get("/*", (req, res) => {
    res.status(404);
    res.send("404: Page Not Found");
});
