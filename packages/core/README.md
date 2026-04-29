# @sendwyrd/core

> **DEPRECATED.** This package has been renamed to [`@openwyrd/mop`](https://www.npmjs.com/package/@openwyrd/mop) and relicensed Apache-2.0 as part of the OpenWyrd MOP open-source release. The full implementation lives at <https://github.com/openwyrd/mop-js>.
>
> **`@sendwyrd/core@0.2.0` is a re-export shim** for `@openwyrd/mop@0.2.0`. Existing imports keep working without code changes:
>
> ```ts
> import { composeWyrd } from "@sendwyrd/core"; // still works (this shim)
> import { composeWyrd } from "@openwyrd/mop"; // canonical going forward
> ```
>
> Migrate at your convenience. The shim will be `npm deprecate`'d 60 days after v0.2.0 ships.

---

OpenWyrd MOP is a federated, capability-URL, host-blind encrypted-messaging protocol. SendWyrd is the canonical reference deployment at <https://sendwyrd.com>. The wire spec — [MOP-001](https://github.com/openwyrd/mop/blob/main/spec/MOP-001.md) — and the conformance suite live under the [`openwyrd`](https://github.com/openwyrd) GitHub org.

## License

Apache-2.0. Earlier releases of this package (`@sendwyrd/core@0.1.0`) shipped under MIT and remain available under those terms.
