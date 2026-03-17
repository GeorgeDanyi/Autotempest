import { crawlTutut } from "../lib/ingest/sources/tutut";

crawlTutut(5)
  .then((r) => {
    console.log("tutut result:", r);
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
