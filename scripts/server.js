const express = require('express');
const app = express();


const mongoose = require('mongoose')

main().catch(err => console.error('MongoDB connection error:', err)); // Log MongoDB connection errors

async function main() {
  try {
    await mongoose.connect('mongodb+srv://Daniel:2foADJtqgvjQ8CMA@cluster0.n7n7slw.mongodb.net/?retryWrites=true&w=majority');
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error; // Rethrow the error to stop the application startup
  }
}

const criminalSchema = new mongoose.Schema({

});

const criminalModel = mongoose.model('criminal', criminalSchema)

