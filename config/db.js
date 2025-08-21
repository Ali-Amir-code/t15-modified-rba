import mongoose from "mongoose";

export default async function connectDB() {
    const uri = process.env.MONGO_URI;
    if(!uri) throw new Error('MONGO_URI not set in env or env is not loaded');
    try{
        await mongoose.connect(uri);
        console.log('DB Connected Successfully');
    }catch(e){
        console.log('Error connecting with DB: ', e);
        process.exit(1);
    }
}