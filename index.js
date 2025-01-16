const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.STRIPE_SEC_KEY);
// middleware
app.use(cors());
app.use(express.json());

// middlewares
const verifyToken = (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "forbidden access" });
  }
  const token = req.headers.authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
};
// admin verify

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const e = require("express");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.6ihkv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const userCollection = client.db("Assets").collection("users");
    const packageCollection = client.db("Assets").collection("packages");
    const teamCollection = client.db("Assets").collection("teams");

    app.post("/employees/:email", async (req, res) => {
      const employee = req.body;
      const email = req.params.email;
      const query = { email };
      const isExist = await userCollection.findOne(query);
      if (isExist) {
        return res.send(isExist);
      }
      const result = await userCollection.insertOne({
        ...employee,
        role: "employee",
        jobStatus: "not",
        timestamp: Date.now(),
      });
      res.send(result);
    });
    // for post data for hr
    app.post("/hr/:email", async (req, res) => {
      const employee = req.body;
      const email = req.params.email;
      const query = { email };
      const isExist = await userCollection.findOne(query);
      if (isExist) {
        return res.send(isExist);
      }
      const result = await userCollection.insertOne({
        ...employee,
        role: "hr",
        paymentStatus: "pending",
        timestamp: Date.now(),
      });
      res.send(result);
    });
    // for checking payment status
    app.get("/payment/status/:email", async (req, res) => {
      const email = req.params.email;
      const result = await userCollection.findOne({ email });
      res.send({
        role: result?.role,
        paymentStatus: result?.paymentStatus,
        packageOption: result?.packageOption,
        companyLogo: result?.companyLogo,
      });
    });
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });
    app.post("/paymentDone", async (req, res) => {
      const payment = req.body;
      let members = 0;
      if (payment.price === 5) {
        members = 5;
      } else if (payment.price === 8) {
        members = 10;
      } else if (payment.price === 15) {
        members = 20;
      } else {
        return res.status(400).send({ message: "Invalid payment price." });
      }
      payment.members = members;
      const paymentResult = await packageCollection.insertOne(payment);
      res.send(paymentResult);
    });
    // get employee free employee
    app.get("/freeEmployee", async (req, res) => {
      const filter = { jobStatus: "not" };
      const result = await userCollection.find(filter).toArray();
      res.send(result);
    });
    // for count
    app.get("/employeeCount/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { email };
      const result = await packageCollection.findOne(filter);
      res.send(result);
    });
    // for user data
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const result = await userCollection.findOne(filter);
      res.send(result);
    });
    // added team
    app.post("/addTeam", async (req, res) => {
      const data = req.body;
      const memberId = data.memberId;
      const filter = { _id: new ObjectId(memberId) };
      const updateDoc = {
        $set: {
          jobStatus: "yes",
        },
      };
      const updateResult = await userCollection.updateOne(filter, updateDoc);
      const result = await teamCollection.insertOne(data);
      res.send(result);
    });
    // get all team member
    app.get("/team/:email", async (req, res) => {
      const email = req.params.email;
      const result = await teamCollection.find({ hrEmail: email }).toArray();
      res.send(result);
    });
    // update member count after payment
  } catch (error) {
    console.log(error);
  }
}
run();

app.get("/", (req, res) => {
  res.send("boss is running");
});
app.listen(port, () => {
  console.log("App listening on port 5000!");
});
