/*
 * Copyright 2024 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { DefaultApiClient } from './generated';
import { CatalogRequestOptions } from './types';

// Ensures that only one feature callback is started at any given time, and
// memoizes its result.
export function featureDetector<TArgs extends any[]>(
  hasFeature: (...args: TArgs) => Promise<boolean | undefined>,
): (...args: TArgs) => Promise<boolean | undefined> {
  let promise: Promise<boolean | undefined> | undefined;
  let deadline: number | undefined;

  return (...args) => {
    if (!promise) {
      promise = new Promise<boolean | undefined>(resolve => {
        Promise.resolve()
          .then(() => {
            if (!deadline) {
              deadline = Date.now() + 30_000;
            } else if (Date.now() > deadline) {
              // stop trying
              return false;
            }
            return hasFeature(...args);
          })
          .then(
            res => {
              if (res === undefined) {
                // we don't know for sure yet, try again next round
                promise = undefined;
              }
              resolve(res);
            },
            () => {
              // something went wrong, try again next round
              promise = undefined;
              resolve(undefined);
            },
          );
      });
    }

    return promise;
  };
}

export function hasQueryEntities(
  client: DefaultApiClient,
): (options?: CatalogRequestOptions) => Promise<boolean | undefined> {
  return async (options?: CatalogRequestOptions) => {
    const response = await client.getEntitiesByQuery(
      { query: { limit: 1 } },
      options,
    );
    if (!response.ok) {
      if (response.status === 404) {
        return false;
      }
      return undefined;
    }
    return true;
  };
}
