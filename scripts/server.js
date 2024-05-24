require(`dotenv`).config();
const express = require(`express`);
const session = require(`express-session`);
const mongoose = require(`mongoose`);
const bcrypt = require(`bcrypt`);
const Joi = require(`joi`);
const cors = require("cors");

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
    price: Number,
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
    price: Number,
    features: Array({ service: String, description: String }),
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

app.use(cors());

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
        address: "Add your address",
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

app.get('/filterCriminals', async (req, res) => {
    const name = req.query.name;
    const crime = req.query.crime;
    const sentenceMin = req.query.sentenceMin;
    const sentenceMax = req.query.sentenceMax;

    try {
        let filter = {};

        if (name) {
            filter.$or = [
                { firstName: new RegExp(name, 'i') },
                { middleName: new RegExp(name, 'i') },
                { lastName: new RegExp(name, 'i') }
            ];
        }

        if (crime) {
            filter['convictions.crime'] = new RegExp(crime, 'i');
        }

        if (sentenceMin) {
            filter['convictions.sentence'] = { $gte: parseInt(sentenceMin, 10) };
        }

        if (sentenceMax) {
            filter['convictions.sentence'] = { ...filter['convictions.sentence'], $lte: parseInt(sentenceMax, 10) };
        }

        const filteredCriminals = await CriminalProfile.find(filter);
        res.json({ success: true, criminals: filteredCriminals });
    } catch (error) {
        console.error('Error fetching filtered criminals:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

function calculateTotalPrisonYears(convictions) {
    return convictions.reduce((total, conviction) => {
        const yearsMatch = conviction.sentence.match(/(\d+)\s*years?/i);
        const years = yearsMatch ? parseInt(yearsMatch[1], 10) : 0;
        return total + years;
    }, 0);
}

app.get("/list", async (req, res) => {
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

app.get("/protection", validateUser, (req, res) => {
    res.render("protection");
});

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
                $lte: maxPrice };
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

app.get("/drones", validateUser, async (req, res) => {
    try {
        const type = req.query.type;
        const manufacturer = req.query.manufacturer;
        const minPrice = req.query.minPrice;
        const maxPrice = req.query.maxPrice;

        console.log(type, manufacturer, minPrice, maxPrice);
 
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
            // filter.price = { $lte: mongoose.Types.Decimal128.fromString(minPrice) }
        }

        console.log(filter);

        const drones = await Drones.find(filter);
        console.log(drones);
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

app.get("/cybersecurity", validateUser, async (req, res) => {
    const cybersecurities = await CyberSecurities.find();
    res.render("cybersecurity", {
        cybersecurities: cybersecurities,
        user: req.session.user,
    });
});

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

app.get("/profile", validateUser, async (req, res) => {
    res.render("profile", { user: req.session.user });
});

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

app.get("/createOrder", async (req, res) => {
    const order = {
        cardname: "TestUser",
        cardnum: "1234123412341234",
        address: "myAddress",
        model: "Mini 2 SE",
        date: new Date(),
        status: true,
    };
    await Users.updateOne(
        { email: "test@user.ca" },
        { $push: { orderHistory: order } }
    );
    res.send("Complete");
});

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

const methodOverride = require("method-override");
app.use(methodOverride("_method"));

app.use(express.json()); // To parse JSON bodies

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

app.get("/resetPasswordProfile", validateUser, (req, res) => {
    res.render("resetPasswordProfile", { email: req.session.user.email });
});

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

app.get("/logout", validateUser, (req, res) => {
    req.session.destroy();
    res.redirect("/login");
});

app.get("/*", (req, res) => {
    res.status(404);
    res.send("404: Page Not Found");
});
