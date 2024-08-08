import { Router } from "@solidjs/router";

import { baseurl } from "@/config";
import routes from "_/router/routes";
import App from "../App";

export default () => (
  <Router root={App} base={baseurl}>
    {routes}
  </Router>
);
