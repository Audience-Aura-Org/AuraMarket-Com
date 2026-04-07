/**
 * scripts/import-cities.js
 * Aura Market — Geographic Data Seeder
 *
 * Scans cities.php and populates the LogisticZone model.
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const LogisticZone = require('../models/LogisticZone.model');

const MONGO_URI = 'mongodb+srv://batitaasah_db_user:ZKqwG9woO4mipI3H@cluster0.dl8yopt.mongodb.net/aura-market';

const importCities = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB.');

    const citiesPath = path.join(__dirname, '../../cities.php');
    const content = fs.readFileSync(citiesPath, 'utf8');

    // Simple parser for the PHP array structure
    // Matches 'Region Name' => array( ... )
    const regionRegex = /'([^']+)'\s*=>\s*array\s*\(([\s\S]*?)\),/g;
    const cityRegex = /'([^']+)'\s*=>\s*'([^']+)'/g;

    let match;
    let regionsCount = 0;
    let citiesCount = 0;

    // Clear existing zones
    await LogisticZone.deleteMany({});
    console.log('Cleared existing zones.');

    while ((match = regionRegex.exec(content)) !== null) {
      const regionName = match[1];
      const citiesContent = match[2];

      const region = await LogisticZone.create({
        name: regionName,
        type: 'region',
        parent_id: null
      });
      regionsCount++;

      let cityMatch;
      while ((cityMatch = cityRegex.exec(citiesContent)) !== null) {
        const cityName = cityMatch[1];
        await LogisticZone.create({
          name: cityName,
          type: 'quartier',
          parent_id: region._id
        });
        citiesCount++;
      }
      // Reset cityRegex for next region
      cityRegex.lastIndex = 0;
    }

    console.log(`Import completed. Regions: ${regionsCount}, Quartiers/Cities: ${citiesCount}`);
    process.exit(0);
  } catch (err) {
    console.error('Import failed:', err);
    process.exit(1);
  }
};

importCities();
