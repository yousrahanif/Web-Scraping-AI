const express = require('express');
const puppeteer = require('puppeteer');
const morgan = require('morgan');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config(); // Load environment variables

const app = express();
const port = process.env.PORT || 3000;

// MongoDB connection string from environment variables
const uri = process.env.MONGODB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// Middleware
app.use(express.json()); // Parse JSON request bodies
app.use(express.static('public')); // Serve static files from the 'public' directory
app.use(morgan('dev')); // Log HTTP requests

// Function to connect to MongoDB and handle data insertion
async function connectToMongoDB() {
  try {
    // Connect to MongoDB
    await client.connect();
    return client.db('scrapingDB').collection('scrapedData');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    throw error;
  }
}

// Route for scraping a webpage title
app.post('/scrape', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).send('URL is required');
  }

  try {
    const collection = await connectToMongoDB();

    // Launch Puppeteer and scrape the webpage title
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // Extract the title of the webpage
    const title = await page.evaluate(() => {
      const titleElement = document.querySelector('title');
      return titleElement ? titleElement.textContent.trim() : 'No title found';
    });

    await browser.close();

    // Insert the scraped title into MongoDB
    const result = await collection.insertOne({ url, title, date: new Date() });
    console.log('Title inserted into MongoDB:', result.insertedId);

    // Send a response with a message and the title
    res.status(200).send(`Title of the webpage: ${title}`);
  } catch (error) {
    console.error('Error scraping the webpage:', error);
    res.status(500).send('Error scraping the webpage');
  }
});

// Route to serve the frontend
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
