import type { ParentComponent } from "solid-js";

const App: ParentComponent = (props) => {
  return <main>{props.children}</main>;
};

export default App;
