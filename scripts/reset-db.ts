import fs from "fs";
import path from "path";

const file = path.join(process.cwd(), "data", "line.sqlite");
for (const suffix of ["", "-shm", "-wal"]) {
  const target = file + suffix;
  if (fs.existsSync(target)) fs.unlinkSync(target);
}
console.log("Removed data/line.sqlite. The next dev or start request seeds a fresh world.");
