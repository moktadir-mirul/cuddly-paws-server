require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const port = 5000;
let admin = require("firebase-admin");

app.use(cors());
app.use(express.json());

const decodedKey = Buffer.from(process.env.FB_Service_key, "base64").toString(
  "utf8"
);
let serviceAccount = JSON.parse(decodedKey);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.mnwmrsu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const stripe = require("stripe")(process.env.Stripe_Backend_Key);

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // await client.connect();

    const userCollection = client.db("petsDB").collection("users");
    const petsCollection = client.db("petsDB").collection("pets");
    const donationsCollection = client.db("petsDB").collection("donations");
    const donationPaymentsCollection = client
      .db("petsDB")
      .collection("donationPayments");
    const adoptsReqCollection = client.db("petsDB").collection("requests");

    // middleware
    const verifyFBToken = async (req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res
          .status(401)
          .json({ message: "Unauthorized: No token provided" });
      }
      const token = authHeader.split(" ")[1];
      if (!token) {
        return res
          .status(401)
          .json({ message: "Unauthorized: No token provided" });
      }
      try {
        const decoded = await admin.auth().verifyIdToken(token);
        req.decoded = decoded;
        next();
      } catch (error) {
        console.error("Token verification failed:", error.message);
        return res.status(403).json({ message: "Forbidden: Invalid token" });
      }
    };

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded?.email;
      if (!email) {
        return res
          .status(403)
          .json({ message: "Forbidden: No email found in token" });
      }
      let query = { email };
      const user = await userCollection.findOne(query);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Forbidden: Admins only" });
      }
      next();
    };


    app.get("/allpets", verifyFBToken, async (req, res) => {
      const { search, category, email } = req.query;

      let query = {};
      if (email) {
        query.email = email;
      }
      if (search) {
        query.name = { $regex: search, $options: "i" };
      }
      if (category) {
        query.category = category;
      }

      try {
        const pets = await petsCollection
          .find(query)
          .sort({ createdAt: -1 })
          .toArray();

        res.send(pets);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch pets", error });
      }
    });

    app.get("/pets", async (req, res) => {
      const { search, category, email, page = 1, limit = 6 } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      let query = { adopted: false };

      if (email) {
        query.email = email;
      }

      if (search) {
        query.name = { $regex: search, $options: "i" };
      }

      if (category) {
        query.category = category;
      }

      try {
        const total = await petsCollection.countDocuments(query);
        const pets = await petsCollection
          .find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .toArray();

        res.send({ pets, total });
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch pets", error });
      }
    });

    app.get("/pets/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const pet = await petsCollection.findOne({
          petId: id,
        });

        if (!pet) {
          return res.status(404).json({ message: "Pet not found" });
        }

        res.status(200).send(pet);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch pet", error });
      }
    });

    app.post("/pets", verifyFBToken, async (req, res) => {
      const newPet = req.body;

      try {
        const result = await petsCollection.insertOne(newPet);
        res.send(result);
      } catch (error) {
        res.status(500).json({ message: "Failed to add pet", error });
      }
    });

    app.put("/pets/:petId", verifyFBToken, async (req, res) => {
      const { petId } = req.params;
      const updatedData = req.body;
      try {
        const result = await petsCollection.updateOne(
          { petId },
          { $set: updatedData }
        );
        res.send(result);
      } catch (err) {
        res.status(500).json({ message: "Update failed", error: err.message });
      }
    });

    app.delete("/pets/:id", verifyFBToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      try {
        const result = await petsCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.send(result);
      } catch (err) {
        res.status(500).json({ message: "Failed to delete pet", error: err });
      }
    });

    app.patch(
      "/pets/:id/status",
      verifyFBToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const { adopted } = req.body;
        try {
          const result = await petsCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { adopted } }
          );
          res.send(result);
        } catch (err) {
          res
            .status(500)
            .json({ message: "Failed to toggle adopted status", error: err });
        }
      }
    );

    app.patch("/pets/:id/adopt", verifyFBToken, async (req, res) => {
      try {
        const result = await petsCollection.updateOne(
          { _id: new ObjectId(req.params.id) },
          { $set: { adopted: true } }
        );
        res.send(result);
      } catch (error) {
        res.status(500).json({ message: "Failed to update pet status", error });
      }
    });

    app.delete("/pets/:id", verifyFBToken, async (req, res) => {
      try {
        const result = await petsCollection.deleteOne({
          _id: new ObjectId(req.params.id),
        });
        res.send(result);
      } catch (error) {
        res.status(500).json({ message: "Failed to delete pet", error });
      }
    });

    app.get("/donations/infinite", async (req, res) => {
      try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 6;
        const skip = (page - 1) * limit;

        const donations = await donationsCollection
          .find()
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .toArray();

        const total = await donationsCollection.countDocuments();
        const hasMore = skip + donations.length < total;

        res.send({ donations, hasMore });
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch donations", error });
      }
    });

    app.get("/donations", async (req, res) => {
      try {
        const { email } = req.query;
        let query = {};
        if (email) {
          query.email = email;
        }
        const donations = await donationsCollection
          .find(query)
          .sort({ createdAt: -1 })
          .toArray();
        res.status(200).send(donations);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch donations", error });
      }
    });

    app.get("/donations/:id", async (req, res) => {
      const id = req.params.id;

      try {
        const donation = await donationsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!donation) {
          return res.status(404).json({ message: "Donation not found" });
        }

        res.status(200).json(donation);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch donation", error });
      }
    });

    app.put(
      "/donations/:id",
      verifyFBToken,
      verifyFBToken,
      async (req, res) => {
        const id = req.params.id;
        const updatedData = req.body;

        try {
          const result = await donationsCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: updatedData }
          );
          res.status(200).send(result);
        } catch (error) {
          res.status(500).json({ message: "Failed to update donation", error });
        }
      }
    );

    app.patch("/donations/:id", verifyFBToken, async (req, res) => {
      const id = req.params.id;
      const { donationStatus } = req.body;
      const result = await donationsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { donationStatus } }
      );
      res.send(result);
    });

    app.post("/donations", verifyFBToken, async (req, res) => {
      const newDonation = req.body;

      try {
        const result = await donationsCollection.insertOne(newDonation);
        res.send(result);
      } catch (error) {
        res
          .status(500)
          .json({ message: "Failed to create donation campaign", error });
      }
    });

    app.delete(
      "/donations/:id",
      verifyFBToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const id = req.params.id;
          const result = await donationsCollection.deleteOne({
            _id: new ObjectId(id),
          });
          res.send(result);
        } catch (error) {
          res.status(500).json({ message: "Failed to delete donation", error });
        }
      }
    );

    app.post("/create-payment-intent", async (req, res) => {
      let amountInCents = req.body.amount;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: "usd",
        automatic_payment_methods: { enabled: true },
      });
      res.json({ clientSecret: paymentIntent.client_secret });
    });

    app.get("/donation-payments", verifyFBToken, async (req, res) => {
      try {
        const { email, donId } = req.query;
        let query = {};
        if (email) {
          query.email = email;
        }
        if (donId) {
          query.donId = donId;
        }
        const payments = await donationPaymentsCollection
          .find(query)
          .sort({ createdAt: -1 })
          .toArray();

        res.status(200).send(payments);
      } catch (error) {
        res
          .status(500)
          .json({ message: "Failed to fetch donation payments", error });
      }
    });

    app.post("/donation-payments", verifyFBToken, async (req, res) => {
      const payment = req.body;

      try {
        const result = await donationPaymentsCollection.insertOne(payment);
        res.status(201).send({
          message: "Donation payment recorded successfully",
          insertedId: result.insertedId,
        });
      } catch (error) {
        res
          .status(500)
          .json({ message: "Failed to record donation payment", error });
      }
    });

    app.delete("/donation-payments/:id", verifyFBToken, async (req, res) => {
      try {
        const { id } = req.params;
        const result = await donationPaymentsCollection.deleteOne({
          _id: new ObjectId(id),
          email: req.query.email,
        });

        if (result.deletedCount === 0) {
          return res.status(404).json({
            message: "Donation not found or not authorized",
          });
        }

        res.status(200).send({
          message: "Donation refund requested successfully",
        });
      } catch (error) {
        res.status(500).json({
          message: "Failed to process refund",
          error: error.message,
        });
      }
    });

    app.get("/adoption-requests", verifyFBToken, async (req, res) => {
      try {
        const { email, status } = req.query;
        let query = {};

        if (email) {
          query.petOwnerEmail = email;
        }

        if (status) {
          query.reqStatus = status;
        }

        const result = await adoptsReqCollection
          .find(query)
          .sort({ createdAt: -1 })
          .toArray();

        res.send(result);
      } catch (error) {
        res
          .status(500)
          .json({ message: "Failed to load adoption requests", error });
      }
    });

    app.get("/adoption-requests/:id", verifyFBToken, async (req, res) => {
      const id = req.params.id;
      try {
        const result = await adoptsReqCollection
          .find({
            petId: id,
          })
          .sort({ createdAt: -1 })
          .toArray();
        res.send(result);
      } catch (error) {
        res
          .status(500)
          .json({ message: "Failed to load adoption requests.", error });
      }
    });

    app.patch("/adoption-requests/:id", verifyFBToken, async (req, res) => {
      try {
        const { id } = req.params;
        const { status } = req.body;

        const result = await adoptsReqCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { reqStatus: status } }
        );

        res.send(result);
      } catch (error) {
        res.status(500).json({ message: "Failed to update request", error });
      }
    });

    app.post("/adoption-requests", verifyFBToken, async (req, res) => {
      const adoptData = req.body;

      const { petId, adoptedReqByEmail } = adoptData;

      try {
        const existingRequest = await adoptsReqCollection.findOne({
          petId,
          adoptedReqByEmail,
        });

        if (existingRequest) {
          return res.status(409).json({
            message:
              "You’ve already submitted an adoption request for this pet.",
          });
        }

        const result = await adoptsReqCollection.insertOne(adoptData);

        res.status(201).send({
          message: "Request recorded successfully",
          insertedId: result.insertedId,
        });
      } catch (error) {
        res.status(500).json({ message: "Failed to record request", error });
      }
    });

    app.get("/users", verifyFBToken, async (req, res) => {
      const { email } = req.query;
      let query = {};
      if (email) {
        query.email = email;
      }
      try {
        const result = await userCollection
          .find(query)
          .sort({ createdAt: -1 })
          .toArray();
        res.send(result);
      } catch (error) {
        res.status(500).json({ message: "Failed to users.", error });
      }
    });

    app.get("/users/role", async (req, res) => {
      const email = req.query.email;

      if (!email) {
        return res.status(400).json({ message: "Email is required." });
      }

      try {
        const user = await userCollection.findOne({ email });

        const role = user?.role || "user"; // fallback to 'user' if not found or role missing

        res.status(200).json({ role });
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch user role.", error });
      }
    });

    app.post("/users", async (req, res) => {
      const email = req.body.email;
      const emailExists = await userCollection.findOne({ email });
      if (emailExists) {
        return res
          .status(200)
          .send({ message: "User Already Exists", inserted: false });
      }
      const user = req.body;
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.put("/users/role/:id", verifyFBToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const { role } = req.body;

      try {
        const result = await userCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { role } }
        );
        res.send(result);
      } catch (error) {
        res.status(500).json({ message: "Failed to update user role", error });
      }
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Pets are waiting for you");
});

app.listen(port, () => {
  console.log(`Pet Server is running on port- ${port}`);
});
