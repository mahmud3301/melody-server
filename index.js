const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
require("dotenv").config();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const { authorization } = req.headers;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@mahmud.mxmnc58.mongodb.net/classesDB?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection

    const classes = client.db("summerCamp").collection("classes");
    const instructors = client.db("summerCamp").collection("instructors");
    const carts = client.db("summerCamp").collection("carts");
    const users = client.db("summerCamp").collection("users");
    const payments = client.db("summerCamp").collection("payments");

    // jwt available for apis
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });

      res.send({ token });
    });

    const verifyAdmin = async (req, res, next) => {
      const { email } = req.decoded;
      const query = { email: email };
      const user = await users.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };
    const verifyInstructor = async (req, res, next) => {
      const { email } = req.decoded;
      const query = { email: email };
      const user = await users.findOne(query);
      if (user?.role !== "instructor") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };

    // user related APIs
    app.get("/users", verifyJWT, async (req, res) => {
      const result = await users.find({}).toArray();
      res.send(result);
    });

    app.post("/user", async (req, res) => {
      const user = req.body;
      const existingUser = await users.findOne({ email: user.email });
      if (existingUser) {
        return res.status(400).json({ error: "User already exists" });
      }
      const result = await users.insertOne(user);
      res.json(result);
    });

    // Admin related api
    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const { email } = req.params;
      if (req.decoded.email !== email) {
        res.send({ admin: false });
      }
      const query = { email: email };
      const user = await users.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    app.patch("/users/admin/:id", async (req, res) => {
      const { id } = req.params;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await users.updateOne(filter, updateDoc);
      res.send(result);
    });

    // Instructor related api
    app.get("/users/instructor/:email", verifyJWT, async (req, res) => {
      const { email } = req.params;
      if (req.decoded.email !== email) {
        res.send({ admin: false });
      }
      const query = { email: email };
      const user = await users.findOne(query);
      const result = { instructor: user?.role === "instructor" };
      res.send(result);
    });

    app.patch("/users/instructor/:id", async (req, res) => {
      const { id } = req.params;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "instructor",
        },
      };
      const result = await users.updateOne(filter, updateDoc);
      res.send(result);
    });

    

    // cart related apis
    app.get("/carts", verifyJWT, async (req, res) => {
      const { email } = req.query;
      if (!email) {
        res.send([]);
      }

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }

      const query = { email: email };
      const result = await carts.find(query).toArray();
      res.send(result);
    });

    app.post("/carts", async (req, res) => {
      const cart = req.body;
      const result = await carts.insertOne(cart);
      res.send(result);
    });

    app.delete("/carts/:id", async (req, res) => {
      const { id } = req.params;
      const query = { _id: new ObjectId(id) };
      const result = await carts.deleteOne(query);
      res.send(result);
    });

    // create payment intent
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // payment related api
    app.post("/payments", verifyJWT, async (req, res) => {
      const payment = req.body;
      const insertResult = await payments.insertOne(payments);

      const query = {
        _id: { $in: payments.carts.map((id) => new ObjectId(id)) },
        // _id: { $in: new ObjectId(payment.cartId) },
      };
      const deleteResult = await carts.deleteOne(query);

      res.send({ insertResult, deleteResult });
    });

    app.get("/admin-stats", verifyJWT, verifyAdmin, async (req, res) => {
      const users = await users.estimatedDocumentCount();
      const products = await menu.estimatedDocumentCount();
      const orders = await payments.estimatedDocumentCount();

      const payments = await payments.find().toArray();
      const revenue = payments.reduce(
        (sum, payments) => sum + payments.price,
        0
      );

      res.send({
        revenue,
        users,
        products,
        orders,
      });
    });

    // classes api
    app.get("/classes", async (req, res) => {
      const result = await classes.find({}).toArray();
      res.send(result);
    });

    // classes api
    app.get("/approved-classes", async (req, res) => {
      const query = {
        status: "approved",
      };
      const result = await classes.find(query).toArray();
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello Singers");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
