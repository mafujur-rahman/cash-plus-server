const express = require('express');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();


const app = express();
const port = process.env.PORT || 5000;
const secretKey = process.env.ACCESS_TOKEN_SECRET;


app.use(cors());
app.use(bodyParser.json());





const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zjwopdy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const userCollection = client.db('CashDB').collection('users');

// user register api
app.post('/register', async (req, res) => {
    const { name, pin, mobileNumber, email, role } = req.body;

    console.log("Received Data: ", req.body);

    if (!name || !pin || !mobileNumber || !email || !role) {
        return res.status(400).send('All fields are required');
    }

    try {
        // Check if the email already exists
        const existingUserByEmail = await userCollection.findOne({ email });
        const existingUserByMobileNum = await userCollection.findOne({ mobileNumber });
        if (existingUserByEmail) {
            return res.status(400).send('Email is already used, try a different one.');
        }
        if (existingUserByMobileNum) {
            return res.status(400).send('Mobile number is already used, try a different one.');
        }

        // Hash the pin
        const hashedPin = await bcrypt.hash(pin, 10);

        // Set the balance based on the role
        let balance = 0;
        if (role === 'User') {
            balance = 40;
        } else if (role === 'Agent') {
            balance = 10000;
        }

        const newUser = {
            name,
            pin: hashedPin,
            mobileNumber,
            email,
            balance,
            status: 'pending',
            role
        };

        const result = await userCollection.insertOne(newUser);
        res.status(201).send(result);

    } catch (err) {
        console.error(err);
        res.status(500).send('Error registering user');
    }
});





    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);




app.get('/', (req,res) =>{
    res.send('Cash Plus server is running.')
});

app.listen(port, () =>{
    console.log(`Server is running on port:${port}`);
});