/**
 * Rebuilds the local test database from the shim + every migration, in order.
 * `npm run db:reset`
 *
 * Replaying migrations from scratch on every run is deliberate: the day they stop
 * being replayable is the day you no longer have a database you can rebuild.
 */
import { resetSchema, TEST_DATABASE_URL } from "../tests/setup/db";

resetSchema()
  .then(() => console.log(`Rebuilt ${TEST_DATABASE_URL}`))
  .catch((e) => { console.error(e); process.exit(1); });
