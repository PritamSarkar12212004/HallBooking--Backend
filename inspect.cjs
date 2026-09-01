const { MONGO_URI } = require('dotenv').config().parsed;
const mongoose = require('mongoose');
(async () => {
  await mongoose.connect(MONGO_URI);
  const r = await mongoose.connection.db.collection('bookings').findOne({ bookingNumber: 'BK-2026-483060' });
  if (!r) { console.log('NOT FOUND'); process.exit(0); }
  console.log('FINANCIAL: ' + JSON.stringify(r.financial));
  console.log('PAYMENTS: ' + JSON.stringify(r.payments));
  await mongoose.disconnect();
  process.exit(0);
})().catch(e=>{console.error(e.message);process.exit(1)});
