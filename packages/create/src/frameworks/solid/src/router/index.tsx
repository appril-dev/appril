import { Router } from "@solidjs/router";

import { baseurl } from "@/config";
import routes from "./routes";
import App from "../App";

export default () => (
  <Router root={App} base={baseurl}>
    {routes}
  </Router>
);
