import { A } from "@solidjs/router";

import { type LinkProps, linkReplcements } from "@/router/assets";

export default (props: {
  href: LinkProps;
  children: import("solid-js").JSXElement;
}) => {
  const [path, ...params] = props.href;
  const href = linkReplcements[path]?.(params as string[]);
  return <A href={href}>{props.children}</A>;
};
