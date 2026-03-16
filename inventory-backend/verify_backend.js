import axios from "axios";
import fs from "fs";

async function verify() {
    try {
        const [locs, cats] = await Promise.all([
            axios.get("http://localhost:5000/api/items/locations"),
            axios.get("http://localhost:5000/api/items/categories")
        ]);
        const output = {
            locations: locs.data,
            categories: cats.data
        };
        fs.writeFileSync("backend_response.json", JSON.stringify(output, null, 2));
        console.log("Captured backend response to backend_response.json");
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

verify();
