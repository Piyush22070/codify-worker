import mongoose from "mongoose";
import { DB_NAME } from "../constant.js";

const connectDB = async ()=>{
    try{

       const db = await mongoose.connect(`${process.env.MONGODB_URL}/${DB_NAME}`)
        console.log(`\nMongoDB Connected !!! Host Name : ${db.connection.host}`)
        
    }
    catch(error){
        console.log(error)
        process.exit(1)
    }
}
export default connectDB 
