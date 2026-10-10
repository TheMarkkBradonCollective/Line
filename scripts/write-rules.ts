import fs from "fs";
import { rulesMarkdown } from "../lib/rules";
fs.writeFileSync("docs/RULES.md", rulesMarkdown());
console.log("wrote docs/RULES.md");
