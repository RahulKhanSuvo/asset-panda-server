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
    const assetsCollection = client.db("Assets").collection("assets");
    const requestCollection = client.db("Assets").collection("request");

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
      await userCollection.updateOne(filter, updateDoc);
      const hrFilter = { email: data.hrEmail };
      const hrUpdateDoc = {
        $inc: {
          members: -1,
        },
      };
      await packageCollection.updateOne(hrFilter, hrUpdateDoc);
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
    app.patch("/paymentStatus/update", async (req, res) => {
      const { email, price } = req.body;
      let members = 0;
      if (price === 5) {
        members = 5;
      } else if (price === 8) {
        members = 10;
      } else if (price === 15) {
        members = 20;
      } else {
        return res.status(400).send({ message: "Invalid payment price." });
      }
      const filter = { email: email };
      const updateDoc = {
        $inc: {
          members: members,
        },
      };
      const result = await packageCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    // api for delete member
    app.delete("/memberDelete/:id", async (req, res) => {
      const id = req.params.id;
      const hrEmail = req.query.hrEmail;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          jobStatus: "not",
        },
      };
      await userCollection.updateOne(filter, updateDoc);
      const hrFilter = { email: hrEmail };
      const hrUpdateDoc = {
        $inc: {
          members: 1,
        },
      };
      await packageCollection.updateOne(hrFilter, hrUpdateDoc);
      const result = await teamCollection.deleteOne({ memberId: id });
      res.send(result);
    });
    // for add hr new asset
    app.post("/addedAsset", async (req, res) => {
      let data = req.body;
      data.timestamp = Date.now();
      const result = await assetsCollection.insertOne(data);
      res.send(result);
    });
    // get all asset that add by hr
    app.get("/allAssets/:email", async (req, res) => {
      const email = req.params.email;
      const {
        search = "",
        filterStatus = "all",
        sortOrder = "default",
      } = req.query;
      let query = { hrEmail: email };
      if (search) {
        query.name = { $regex: search, $options: "i" };
      }
      if (filterStatus === "available") {
        query.quantity = { $gt: 0 };
      } else if (filterStatus === "out-of-stock") {
        query.quantity = 0;
      } else if (filterStatus === "returnable") {
        query.productType = "returnable";
      } else if (filterStatus == "non-returnable") {
        query.productType = "non-returnable";
      }
      let sort = {};
      if (sortOrder === "asc") {
        sort.quantity = 1;
      } else if (sortOrder === "desc") {
        sort.quantity = -1;
      }
      const result = await assetsCollection.find(query).sort(sort).toArray();
      res.send(result);
    });
    // delete asset
    app.delete("/deleteAsset/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await assetsCollection.deleteOne(query);
      res.send(result);
    });
    // for get an assets
    app.get("/assetsUpdate/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await assetsCollection.findOne(query);
      res.send(result);
    });
    // for update assets
    app.patch("/assetsUpdate/:id", async (req, res) => {
      const id = req.params.id;
      const assetData = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          name: assetData.name,

          productType: assetData.productType,
          quantity: assetData.quantity,
          image: assetData.image,
          hrEmail: assetData.hrEmail,
          timestamp: assetData.timestamp,
        },
      };
      const result = await assetsCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    // for finding company logo and info
    app.get("/userStatus/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const findRole = await userCollection.findOne(query);
      if (findRole?.role === "employee" && findRole?.jobStatus === "yes") {
        const team = await teamCollection.findOne({
          memberEmail: email,
        });
        res.send({
          hrEmail: team?.hrEmail,
          companyLogo: team?.companyLogo,
          role: team?.memberRole,
          companyName: team?.companyName,
        });
      }

      if (findRole?.role === "hr") {
        const team = await teamCollection.findOne({
          hrEmail: email,
        });
        res.send({
          role: findRole?.role,
          companyLogo: team?.companyLogo,
          companyName: team?.companyName,
        });
      }
    });
    // get all of my team member
    app.get("/myTeamMember/:email", async (req, res) => {
      const email = req.params.email;
      const query = {
        hrEmail: email,
      };
      const teamMembers = await teamCollection.find(query).toArray();
      for (let member of teamMembers) {
        const user = await userCollection.findOne({
          _id: new ObjectId(member.memberId),
        });
        member.MemberImage = user.image;
      }
      res.send(teamMembers);
    });
    //for asset request
    app.get("/assistRequest/:email", async (req, res) => {
      const hrEmail = req.params.email;
      const { search = "", filterStatus = "" } = req.query;
      let query = { hrEmail: hrEmail };
      if (search) {
        query.name = {
          $regex: search,
          $options: "i",
        };
      }
      if (filterStatus === "available") {
        query.quantity = { $gt: 0 };
      } else if (filterStatus === "out-of-stock") {
        query.quantity = 0;
      } else if (filterStatus === "returnable") {
        query.productType = "returnable";
      } else if (filterStatus == "non-returnable") {
        query.productType = "non-returnable";
      }
      const result = await assetsCollection.find(query).toArray();
      res.send(result);
    });
    app.post("/assetRequest", async (req, res) => {
      const data = req.body;
      const result = await requestCollection.insertOne(data);
      const filter = { _id: new ObjectId(data.assetId) };
      const updateDoc = {
        $inc: {
          quantity: -1,
        },
      };
      await assetsCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    app.get("/hr/allRequest/:email", async (req, res) => {
      const email = req.params.email;
      let query = { hrEmail: email };
      const { search = "" } = req.query;
      if (search) {
        query = {
          ...query,
          $or: [
            { reqName: { $regex: search, $options: "i" } },
            { reqEmail: { $regex: search, $options: "i" } },
          ],
        };
      }
      const result = await requestCollection.find(query).toArray();
      res.send(result);
    });
    // employee asset list
    app.get("/employee/assetsList/:email", async (req, res) => {
      const email = req.params.email;
      let query = {
        reqEmail: email,
      };
      const { search = "", filter = "all" } = req.query;
      if (search) {
        query.assetName = { $regex: search, $options: "i" };
      }
      if (filter === "returnable") {
        query.assetType = "returnable";
      } else if (filter === "non-returnable") {
        query.assetType = "non-returnable";
      } else if (filter === "approved") {
        query.status = "approved";
      } else if (filter === "pending") {
        query.status = "pending";
      }
      const result = await requestCollection.find(query).toArray();
      res.send(result);
    });
    // for hr approveRequest
    app.patch("/hr/approveRequest/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          status: "approved",
          approvalDate: Date.now(),
        },
      };
      const result = await requestCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });
    // for hr rejectRequest
    app.patch("/hr/rejectRequest/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "rejected",
        },
      };
      const result = await requestCollection.updateOne(filter, updateDoc);
      res.send(result);
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
