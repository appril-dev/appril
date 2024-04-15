import { useStore, actionListeners } from "./store";

const store = useStore();

for (const handler of actionListeners) {
  store.$onAction(handler);
}
