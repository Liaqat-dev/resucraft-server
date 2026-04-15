import 'dotenv/config';
import connectDB from '#utils/db.js';
import Template from '#models/Template.js';

await connectDB();

const result = await Template.updateMany(
    { $or: [{ visibility: { $exists: false } }, { status: { $exists: false } }] },
    { $set: { visibility: 'private', status: 'draft' } }
);

console.log(`✅ Migration complete — ${result.modifiedCount} template(s) updated.`);
process.exit(0);