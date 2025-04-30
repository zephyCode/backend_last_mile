import express from 'express';
import bodyParser from 'body-parser';
import { makeIVRCall, callPassengersRepeatedly, scheduleCallsBasedOnLandingTime } from './server.js';
import dotenv from 'dotenv';
import cors from 'cors';
dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/api/call', async (req, res) => {
    const result = await callPassengersRepeatedly();
    return res.json({
        status: result,
        message: 'Ok'
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
