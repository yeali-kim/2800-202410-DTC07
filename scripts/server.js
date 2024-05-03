require('dotenv').config();
const express = require('express');
const app = express();

const mongoose = require('mongoose')

const mongodb_host = process.env.MONGODB_HOST;
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_database = process.env.MONGODB_DATABASE;

main().catch(err => console.error('MongoDB connection error:', err)); // Log MongoDB connection errors

async function main() {
  try {
    await mongoose.connect(`mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/?retryWrites=true&w=majority`);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error; // Rethrow the error to stop the application startup
  }
}

const criminalSchema = new mongoose.Schema({

});

const criminalModel = mongoose.model('criminal', criminalSchema)

