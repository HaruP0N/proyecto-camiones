import bcrypt from "bcryptjs";

const password = "Admin123!"; // cámbiala luego
const hash = bcrypt.hashSync(password, 10);

console.log(hash);
