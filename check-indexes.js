// Quick script to check search indexes
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb://localhost:58746/?directConnection=true';
const client = new MongoClient(uri);

async function checkIndexes() {
  try {
    await client.connect();
    const db = client.db('code_reader');
    const collection = db.collection('embeddings');

    console.log('\n=== Checking for Search Indexes ===\n');

    // Check build info
    const buildInfo = await db.admin().command({ buildInfo: 1 });
    console.log('MongoDB Version:', buildInfo.version);
    console.log('Modules:', buildInfo.modules);
    console.log('Git Version:', buildInfo.gitVersion);
    console.log();

    // List all regular indexes
    console.log('Regular Indexes:');
    const regularIndexes = await collection.listIndexes().toArray();
    console.log(JSON.stringify(regularIndexes, null, 2));
    console.log();

    // Try to get search indexes (Atlas-specific)
    console.log('Search Indexes (Atlas):');
    try {
      const searchIndexes = await collection.aggregate([
        { $listSearchIndexes: {} }
      ]).toArray();
      console.log(JSON.stringify(searchIndexes, null, 2));
    } catch (error) {
      console.log('Error getting search indexes:', error.message);
      console.log('(This is expected if search indexes API is not supported)');
    }
    console.log();

    // Check if getSearchIndexes method exists
    console.log('Using getSearchIndexes() method:');
    try {
      if (typeof collection.getSearchIndexes === 'function') {
        const indexes = await collection.getSearchIndexes();
        console.log(JSON.stringify(indexes, null, 2));
      } else {
        console.log('getSearchIndexes() method not available');
      }
    } catch (error) {
      console.log('Error:', error.message);
    }

    console.log('\n=== Done ===\n');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkIndexes();
