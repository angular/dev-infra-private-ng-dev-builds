
import {createRequire as __cjsCompatRequire} from 'module';
const require = __cjsCompatRequire(import.meta.url);

import {
  assertValidReleaseConfig,
  getConfig
} from "../../chunk-YDWHIINW.mjs";
import "../../chunk-UHIZKGIY.mjs";

// ng-dev/release/build/build-worker.ts
main().catch((e) => {
  console.error(e);
  throw e;
});
async function main() {
  if (process.send === void 0) {
    throw Error("This script needs to be invoked as a NodeJS worker.");
  }
  const config = await getConfig();
  assertValidReleaseConfig(config);
  const builtPackages = await config.release.buildPackages();
  process.send(builtPackages);
}
/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
