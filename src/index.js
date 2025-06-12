import connectDB from "./db/index.js";
import { listenQueue } from './controllers/handleSubmissionQueue.controller.js';
connectDB()
listenQueue()
