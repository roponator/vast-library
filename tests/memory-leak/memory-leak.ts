import * as memwatch from "@airbnb/node-memwatch";
import { generateMinimalVast } from "../test-helpers";

memwatch.on("leak", (info: string) => {
  // tslint:disable-next-line:no-console
  console.error("memory leak detected");
  throw new Error(info);
});

for (let i = 0; i < 20000; i++) {
  const vast = generateMinimalVast();
  vast.toXml();
}

process.exit(0);
