import { initializeDatabase, seedDatabase } from './init.js';
import { closeDb } from '../config/db.js';

initializeDatabase({ seedIfEmpty: false });
seedDatabase({ reset: true });
closeDb();
console.log('CareerForge database reset and seeded successfully.');
