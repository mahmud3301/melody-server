const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

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

    app.get("/classes", async (req, res) => {
      const result = await classes.find({}).toArray();
      res.send(result);
    });

    app.get("/instructors", async (req, res) => {
      const result = await instructors.find({}).toArray();
      res.send(result);
    });

    // cart related apis

    app.get("/carts", async (req, res) => {
      const { email } = req.query;

      if (!email) {
        res.send([]);
      }

      const query = { email: email };
      const result = await carts.find(query).toArray();
      res.send(result);
    });

    app.post("/carts", async (req, res) => {
      const cart = req.body;
      const result = await carts.insertOne(cart);
      res.send(result);
    })

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
