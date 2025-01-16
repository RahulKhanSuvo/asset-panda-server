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
