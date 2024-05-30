// Import dependencies.
require(`dotenv`).config();
const express = require(`express`);
const session = require(`express-session`);
const mongoose = require(`mongoose`);
const bcrypt = require(`bcrypt`);
const Joi = require(`joi`);
const cors = require("cors");
const methodOverride = require("method-override");

// Variables from dotenv file.
const mongo_user = process.env.MONGODB_USER;
const mongo_password = process.env.MONGODB_PASSWORD;
const mongo_host = process.env.MONGODB_HOST;
const mongo_db = process.env.MONGODB_DATABASE;
const node_session_secret = process.env.NODE_SESSION_SECRET;
const APIKEY = process.env.GOOGLE_MAPS_API_KEY;

// Setup.
const app = express();
const PORT = process.env.PORT || 3000;
const saltRounds = Number(process.env.SALT_ROUNDS);
const expireTime = 1000 * 60 * 60;
const { Decimal128 } = mongoose.Schema.Types;

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

// Schemas.
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
    address: String,
    orderHistory: Array({
        cardname: String,
        cardnum: String,
        address: String,
        model: String,
        date: String,
        status: Boolean,
    }),
});

const robotSchema = new mongoose.Schema({
    model: String,
    manufacturer: String,
    price: Decimal128,
    location: String,
    type: String,
});

const droneSchema = new mongoose.Schema({
    model: String,
    manufacturer: String,
    price: Decimal128,
    location: String,
    type: String,
});

const cyberSchema = new mongoose.Schema({
    type: String,
    price: Decimal128,
    features: Array({ service: String, description: String }),
});

// Model from the database.
const CriminalProfile = mongoose.model("criminalProfile", criminalSchema);
const Users = mongoose.model("users", userSchema);
const Robots = mongoose.model("robotprofiles", robotSchema);
const Drones = mongoose.model("droneprofiles", droneSchema);
const CyberSecurities = mongoose.model("cybersecurityprofiles", cyberSchema);

// Use ejs view engine.
app.set("view engine", "ejs");

// Middlewares.
app.use(express.static(__dirname + "/../public"));
app.use(
    session({
        secret: node_session_secret,
        resave: false,
        saveUninitialized: true,
        // cookie: { secure: true },
    })
);
app.use(cors());
app.use(express.urlencoded({ extended: false }));
app.use(methodOverride("_method"));
app.use(express.json()); // To parse JSON bodies

// Validate user by email and password.
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

// Calculate total prison years a criminal has.
function calculateTotalPrisonYears(convictions) {
    return convictions.reduce((total, conviction) => {
        const yearsMatch = conviction.sentence.match(/(\d+)\s*years?/i);
        const years = yearsMatch ? parseInt(yearsMatch[1], 10) : 0;

        return total + years;
    }, 0);
}

// Render index.ejs. Home page.
app.get("/", (req, res) => {
    if (req.session.user) {
        res.redirect("/map");
    } else {
        res.render("index");
    }
});

// Render login.ejs.
app.get("/login", (req, res) => {
    if (req.session.user) {
        res.redirect("/map");
    } else {
        res.render("login");
    }
});

// Read from database.
app.post("/login", async (req, res) => {
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

    const existingUser = await Users.findOne({ email: email });
    if (!existingUser) {
        res.render("loginErrorPage", {
            email,
            error: "Email not found. Please sign up.",
        });
        return;
    }

    const isPasswordValid = await bcrypt.compare(
        password,
        existingUser.password
    );
    if (!isPasswordValid) {
        res.render("loginErrorPage", {
            email: email,
            error: "Wrong Password. Try Again.",
        });
    } else {
        req.session.email = email;
        req.session.password = password;
        res.redirect("/map");
    }
});

// Render signup.ejs.
app.get("/signup", (req, res) => {
    if (req.session.user) {
        res.redirect("/map");
    } else {
        res.render("signup");
    }
});

// Write to database.
app.post("/signup", async (req, res) => {
    const username = req.body.name;
    const email = req.body.email;
    const password = req.body.password;

    const schema = Joi.object({
        username: Joi.string().max(20).required(),
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

    const existingUser = await Users.findOne({ email: email });
    if (existingUser) {
        res.render("signup", {
            error: "An account with this email already exists. Please login.",
        });
        return;
    } else {
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        await Users.create({
            username: username,
            email: email,
            password: hashedPassword,
            address: "Add your address",
        });

        req.session.email = email;
        req.session.password = password;

        res.redirect("/map");
    }
});

// Render resetPassword.ejs.
app.get("/resetPassword", (req, res) => {
    if (req.session.user) {
        res.redirect("/map");
    } else {
        res.render("resetPassword");
    }
});

// Write to database.
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

// Render filter.ejs.
app.get("/filter", validateUser, (req, res) => {
    res.render("filter");
});

// Render map.ejs. Pass criminals from the database, user, and api key.
app.get("/map", validateUser, async (req, res) => {
    const criminals = await CriminalProfile.find();

    res.render("map", {
        criminals: criminals,
        user: req.session.user,
        apiKey: APIKEY,
    });
});

// Filter criminals by name, crime types, and/or sentence duration.
app.get("/filterCriminals", validateUser, async (req, res) => {
    const name = req.query.name;
    const crimeTypes = req.query.crimeTypes
        ? req.query.crimeTypes.split(",")
        : [];
    const sentenceRange = req.query.sentenceRange;

    try {
        let filter = {};

        if (name) {
            filter.$or = [
                { firstName: new RegExp(name, "i") },
                { middleName: new RegExp(name, "i") },
                { lastName: new RegExp(name, "i") },
            ];
        }
        if (crimeTypes.length > 0) {
            filter["convictions.crime"] = {
                $in: crimeTypes.map((crime) => new RegExp(crime, "i")),
            };
        }
        if (sentenceRange) {
            filter["convictions.sentence"] = {
                $gte: parseInt(sentenceRange, 10),
            };
        }

        const filteredCriminals = await CriminalProfile.find(filter);

        res.json({ success: true, criminals: filteredCriminals });
    } catch (error) {
        console.error("Error fetching filtered criminals:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});

// Render list.ejs. Pass criminals from the database, user, and api key.
app.get("/list", validateUser, async (req, res) => {
    const criminals = await CriminalProfile.find({});

    criminals.forEach((criminal) => {
        criminal.totalPrisonYears = calculateTotalPrisonYears(
            criminal.convictions
        );

        criminal.convictions.forEach((conviction) => {
            if (conviction && conviction.crime) {
                conviction.crime = conviction.crime
                    .replace(" ", "")
                    .toLowerCase();
            }
        });
    });

    res.render("list", {
        criminals: criminals,
        user: req.session.user,
        apiKey: APIKEY,
    });
});

// Render protection.ejs.
app.get("/protection", validateUser, (req, res) => {
    res.render("protection");
});

// Render robots.ejs. Apply filters passed by queries.
app.get("/robots", validateUser, async (req, res) => {
    try {
        const type = req.query.type;
        const manufacturer = req.query.manufacturer;
        const minPrice = req.query.minPrice;
        const maxPrice = req.query.maxPrice;

        let filter = {};
        if (type) {
            filter.type = type;
        }
        if (manufacturer) {
            filter.manufacturer = manufacturer;
        }
        if (minPrice && maxPrice) {
            filter.price = {
                $gte: minPrice,
                $lte: maxPrice,
            };
        }

        const robots = await Robots.find(filter);
        const uniqueTypes = await Robots.distinct("type");
        const uniqueManufacturers = await Robots.distinct("manufacturer");

        res.render("robots", {
            robots: robots,
            uniqueTypes: uniqueTypes,
            uniqueManufacturers: uniqueManufacturers,
            user: req.session.user,
        });
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// Render drones.ejs. Apply filters passed by queries.
app.get("/drones", validateUser, async (req, res) => {
    try {
        const type = req.query.type;
        const manufacturer = req.query.manufacturer;
        const minPrice = req.query.minPrice;
        const maxPrice = req.query.maxPrice;

        let filter = {};
        if (type) {
            filter.type = type;
        }
        if (manufacturer) {
            filter.manufacturer = manufacturer;
        }
        if (minPrice && maxPrice) {
            filter.price = {
                $gte: mongoose.Types.Decimal128.fromString(minPrice),
                $lte: mongoose.Types.Decimal128.fromString(maxPrice),
            };
        }

        const drones = await Drones.find(filter);
        const uniqueTypes = await Drones.distinct("type");
        const uniqueManufacturers = await Drones.distinct("manufacturer");

        res.render("drones", {
            drones: drones,
            uniqueTypes: uniqueTypes,
            uniqueManufacturers: uniqueManufacturers,
            user: req.session.user,
        });
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// Render cybersecurity.ejs. Pass cybersecurity data from the database and user.
app.get("/cybersecurity", validateUser, async (req, res) => {
    const cybersecurities = await CyberSecurities.find();

    res.render("cybersecurity", {
        cybersecurities: cybersecurities,
        user: req.session.user,
    });
});

// Send json response of a product by product id.
app.get("/getProductByID/", validateUser, async (req, res) => {
    const ID = req.query.id;

    var product = await Drones.findOne({ _id: ID });
    if (!product) {
        product = await Robots.findOne({ _id: ID });
    }
    if (!product) {
        product = await CyberSecurities.findOne({ _id: ID });
    }

    res.json(product);
});

// Render profile.ejs. Pass user information.
app.get("/profile", validateUser, async (req, res) => {
    res.render("profile", { user: req.session.user });
});

// Send json response of a product by order id.
app.get("/getProduct", validateUser, async (req, res) => {
    const id = req.query.id;

    const histories = req.session.user.orderHistory;
    const order = histories.find((history) => {
        return history._id == id;
    });

    const model = order.model;

    var product = await Drones.findOne({ model: model });
    if (!product) {
        var product = await Robots.findOne({ model: model });
    }
    if (!product) {
        var product = await CyberSecurities.findOne({ type: model });
    }

    res.json(product);
});

// Update user's order history status to false.
app.post("/cancelSubscription", validateUser, async (req, res) => {
    const id = req.body.orderid;
    const email = req.session.user.email;

    const user = await Users.findOne({ email: email });

    const histories = user.orderHistory;

    const newHistories = histories.map((history) => {
        if (history.id == id) {
            history.status = false;
        }
        return history;
    });

    await Users.updateOne({ email: email }, { orderHistory: newHistories });

    res.redirect("/profile");
});

// Update user information in database.
app.put("/updateProfile", validateUser, async (req, res) => {
    const { username, email, address } = req.body;
    const sessionUsername = req.session.user.username; // Use session to identify the user

    try {
        const user = await Users.findOneAndUpdate(
            { username: sessionUsername },
            { username, email, address: address },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Update the session user information
        req.session.user.username = username;
        req.session.user.email = email;
        req.session.user.address = address;

        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server Error" });
    }
});

// Render resetPasswordProfile.ejs. Pass email address.
app.get("/resetPasswordProfile", validateUser, (req, res) => {
    res.render("resetPasswordProfile", { email: req.session.user.email });
});

// Update user's password.
app.post("/resetPasswordProfile", validateUser, async (req, res) => {
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
        res.redirect("/profile");
        return;
    }
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const user = await Users.findOne({ email: email });

    if (user) {
        await Users.updateOne({ email: email }, { password: hashedPassword });
    }

    res.redirect("/profile");
});

// Append an order to user's order history.
app.post("/order", validateUser, async (req, res) => {
    const email = req.body.user;
    const model = req.body.drone;
    const cardnumber = req.body.cardNumber;
    const cardname = req.body.cardName;
    const address = req.body.address;
    const setAddress = req.body.setAddress;

    const schema = Joi.object({
        email: Joi.string().email({
            minDomainSegments: 2,
            tlds: { allow: ["com", "ca"] },
        }),
        model: Joi.string(),
        cardnumber: Joi.number(),
        cardname: Joi.string(),
        address: Joi.string(),
    });

    const validationResult = schema.validate({
        email,
        model,
        cardnumber,
        cardname,
        address,
    });

    if (validationResult.error != null) {
        console.log(validationResult.error);
        res.json({ success: false });
        return;
    }

    const order = {
        cardname: cardname,
        cardnum: cardnumber,
        address: address,
        model: model,
        date: new Date(),
        status: true,
    };

    await Users.updateOne({ email: email }, { $push: { orderHistory: order } });

    if (setAddress) {
        await Users.updateOne({ email: email }, { address: address });
    }

    const user = await Users.findOne({ email: email });
    let drone = await Drones.findOne({ model: model });
    if (!drone) {
        drone = await Robots.findOne({ model: model });
    }
    if (!drone) {
        drone = await CyberSecurities.findOne({ type: model });
    }
    if (!drone) {
        res.json({ success: false });
        return;
    }

    res.json({ success: true, user: user, drone: drone });
});

// Destory session.
app.get("/logout", validateUser, (req, res) => {
    req.session.destroy();
    res.redirect("/login");
});

// URL not found error.
app.get("/*", (req, res) => {
    res.status(404);
    res.send("404: Page Not Found");
});
