/**
 * scripts/seedZones.js
 * Seed script for Logistic Zones (Cameroon) — Optimized with Unified Data from cities.php
 */
const mongoose = require('mongoose');
const LogisticZone = require('../models/LogisticZone.model');
require('dotenv').config();

const zoneData = {
    'Yaoundé 1': ['Bastos', 'Centre commercial', 'Djoungolo II', 'Djoungolo III', 'Emana', 'Elig-Edzoa', 'Messassi', 'Ngousso', 'Olembe I', 'Olembe II'],
    'Yaoundé 2': ['Briqueterie', 'Cité Verte', 'Madagascar', 'Mokolo marché', 'Tsinga'],
    'Yaoundé 3': ['Ahala 1', 'Ahala 2', 'Efoulan', 'Mvan', 'Mvolyé', 'Ngoa Ekélé', 'Nsimeyong', 'Obili', 'Obobogo', 'Simbock'],
    'Yaoundé 4': ['Anguissa', 'Ekounou I', 'Ekounou II-Nord', 'Messamendongo', 'Mvan-Nord', 'Mvan-Sud', 'Odza I', 'Odza II', 'Tropicana'],
    'Yaoundé 5': ['Eleveur', 'Essos Centre', 'Essos Nord', 'Mvog-Ada', 'Ngousso-Ntem'],
    'Yaoundé 6': ['Biyem-Assi', 'Etoug-Ebe I', 'Mendong Camp Sic', 'Mvog-Betsi'],
    'Yaoundé 7': ['Akono', 'Nkolbisson', 'Oyom Abang I', 'Oyom Abang II'],
    'Douala I': ['Akwa', 'Bali', 'Bessengue', 'Bonadouma', 'Bonanjo', 'Bonapriso', 'Deido', 'Koumassi', 'Nkongmondo'],
    'Douala II': ['Aéroport', 'Congo', 'Kassalafam', 'New-Bell', 'Youpwé'],
    'Douala III': ['Japoma', 'Logbaba', 'Logbessou', 'Ndokoti', 'Nyalla', 'Nylon', 'PK 8', 'PK 12', 'Yassa'],
    'Douala IV': ['Bonassama', 'Mambanda', 'Ndobo', 'Sodiko Village'],
    'Douala V': ['Bépanda', 'Bonamoussadi', 'Cité des Palmiers', 'Makèpè Maturité', 'Makèpè Petit Pays', 'PK 17', 'PK 21'],
    'Kumba I': ['Administrative District', 'Barombi Mbo', 'Kumba Njuki'],
    'Kumba II': ['Fiango', 'Kossalai'],
    'Kumba III': ['Mambanda', 'Teke'],
    'Bamenda I': ['Abangoh', 'Ayaba'],
    'Bamenda II': ['Alakuma', 'Atuakom', 'Azire', 'Ngomgham', 'Nitob'],
    'Bamenda III': ['Bayelle', 'Nkwen', 'Sisia']
};

// We will map Cities/Districts (Yaoundé 1, Douala I) as "Regions" for the purpose of this simple hierarchy
// And their children as "Quartiers".

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to AURA Node...');

    // Clear existing to avoid duplicates if necessary
    await LogisticZone.deleteMany({});

    for (const [parentName, quartiers] of Object.entries(zoneData)) {
      // Create Parent (District/City)
      const parent = await LogisticZone.create({ 
        name: parentName, 
        type: 'region' 
      });
      console.log(`Fulfillment Hub Created: ${parentName}`);

      for (const qName of quartiers) {
        await LogisticZone.create({ 
          name: qName, 
          parent_id: parent._id, 
          type: 'quartier' 
        });
        console.log(`  Quartier Linked: ${qName}`);
      }
    }

    console.log('Seeding protocol complete. Network Topology Optimized.');
    process.exit(0);
  } catch (err) {
    console.error('Seeding failure:', err);
    process.exit(1);
  }
}

seed();
