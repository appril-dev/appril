import type { UseSpec } from "@appril/api";

import useGlobal from "@/core/api/use";

// middleware defined here will be used on every route.
// and can be overridden by every route via slot key.
export default (): Array<UseSpec> => useGlobal();
