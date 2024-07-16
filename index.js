const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const app = express();
const port = process.env.PORT || 5000;



app.use(bodyParser.json());



app.get('/', (req,res) =>{
    res.send('Cash Plus server is running.')
});

app.listen(port, () =>{
    console.log(`Server is running on port:${port}`);
});