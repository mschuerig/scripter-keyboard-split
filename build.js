import { readFileSync, writeFileSync } from "fs";

const router = readFileSync("split-router.js", "utf8");
const template = readFileSync("scripter-keyboard-split.template.js", "utf8");

const routerCode = router.replace(/\bexport\s+/g, "").trim();

const output = template.replace(
    /\/\/\s*@inject:split-router[\s\S]*?\/\/\s*@end-inject/,
    `// @inject:split-router\n${routerCode}\n// @end-inject`
);

writeFileSync("scripter-keyboard-split.js", output);
console.log("Built scripter-keyboard-split.js");
