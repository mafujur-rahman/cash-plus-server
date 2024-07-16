const express = require('express');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const { MongoClient, ObjectId, ServerApiVersion } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;
const secretKey = process.env.ACCESS_TOKEN_SECRET;

app.use(cors());
app.use(bodyParser.json());

// Middleware to authenticate JWT
const authenticateJWT = (req, res, next) => {
    const token = req.header('Authorization')?.split(' ')[1];

    if (token) {
        jwt.verify(token, secretKey, (err, user) => {
            if (err) {
                return res.sendStatus(403);
            }
            req.user = user;
            next();
        });
    } else {
        res.sendStatus(401);
    }
};

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
        await client.connect();

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

        app.get('/register', async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        });

        // send money api
        app.post('/send-money', authenticateJWT, async (req, res) => {
            const { senderId, receiverNumber, amount, pin, totalAmount } = req.body;

            try {
                // Find sender and receiver
                const sender = await userCollection.findOne({ _id: new ObjectId(senderId) });
                const receiver = await userCollection.findOne({ mobileNumber: receiverNumber });

                if (!sender || !receiver) {
                    return res.status(404).json({ success: false, message: 'Sender or receiver not found' });
                }

                // Verify sender's pin
                const isPinValid = await bcrypt.compare(pin, sender.pin);
                if (!isPinValid) {
                    return res.status(403).json({ success: false, message: 'Invalid pin' });
                }

                // Check if sender has enough balance
                if (sender.balance < totalAmount) {
                    return res.status(400).json({ success: false, message: 'Insufficient balance' });
                }

                // Perform transaction
                const updatedSender = await userCollection.updateOne(
                    { _id: new ObjectId(senderId) },
                    { $inc: { balance: -totalAmount } }
                );
                const updatedReceiver = await userCollection.updateOne(
                    { mobileNumber: receiverNumber },
                    { $inc: { balance: amount } }
                );

                res.json({ success: true, message: 'Transaction successful' });
            } catch (err) {
                res.status(500).json({ success: false, message: 'Server error', error: err.message });
            }
        });

        // log in api
        app.post('/login', async (req, res) => {
            const { mobileNumber, email, pin } = req.body;

            const query = email ? { email } : { mobileNumber };

            try {
                const user = await userCollection.findOne(query);

                if (!user) {
                    return res.status(404).send('User not found');
                }

                if (user.status !== 'approved') {
                    return res.status(403).send('User not approved');
                }

                const isPinValid = await bcrypt.compare(pin, user.pin);
                if (!isPinValid) {
                    return res.status(403).send('Invalid PIN');
                }

                // Generate JWT token
                const token = jwt.sign({ id: user._id, role: user.role }, secretKey, { expiresIn: '1h' });

                res.json({
                    token,
                    user: {
                        id: user._id,
                        name: user.name,
                        email: user.email,
                        mobileNumber: user.mobileNumber,
                        role: user.role
                    }
                });
            } catch (err) {
                console.error('Error logging in:', err);
                res.status(500).send('Error logging in');
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

app.get('/', (req, res) => {
    res.send('Cash Plus server is running.')
});

app.listen(port, () => {
    console.log(`Server is running on port:${port}`);
});
