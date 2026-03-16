import express from "express";
import cors from "cors";
import { queryDatabase } from "./db.js";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.js";
dotenv.config();

const app = express();

app.use(
    cors({
        origin: "http://localhost:3000",
        methods: ["GET", "POST", "PUT", "DELETE"],
        credentials: true
    })
);
app.use(express.json());

app.use((req, res, next) => {
    console.log(`${req.method} ${req.url} - Content-Type: ${req.get('Content-Type')}`);
    next();
});

app.use("/api/auth", authRoutes);

//simple test route
app.get("/", (req, res) => {
    res.send("Backend is running!");
});
//--DASHBOARD STATS---

app.get("/api/dashboard/stats", async (req, res) => {
    try {
        const totalItemsQuery = "SELECT COUNT(*) AS count FROM Items";
        const lowStockQuery = "SELECT COUNT(*) AS count FROM Items WHERE quantity < 10";
        const issuedQuery = "SELECT SUM(quantity) AS count FROM Issues";

        const [total, low, issued] = await Promise.all([
            queryDatabase(totalItemsQuery),
            queryDatabase(lowStockQuery),
            queryDatabase(issuedQuery)
        ]);

        res.json({
            totalItems: total[0].count,
            lowStock: low[0].count,
            itemsIssued: issued[0]?.count || 0
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch stats" });
    }
});

//--ISSUES (History & Transactions)---

app.get("/api/issues", async (req, res) => {
    try {
        const query = `
            SELECT i.id, i.issued_to, i.quantity, i.issue_date, i.sap_notification, i.note, i.type, it.name AS item_name 
            FROM Issues i 
            JOIN Items it ON i.item_id = it.id 
            ORDER BY i.issue_date DESC`;
        const issues = await queryDatabase(query);
        res.json(issues);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch issues" });
    }
});

app.post("/api/issues", async (req, res) => {
    const { item_id, quantity, issued_to, sap_notification, note, issue_date, type } = req.body;
    const transactionType = type || 'ISSUE'; // Default to ISSUE

    if (!item_id || !quantity || !issued_to || quantity <= 0) {
        return res.status(400).json({ error: "Insufficient data or invalid quantity" });
    }

    try {
        const stockCheck = await queryDatabase("SELECT quantity FROM Items WHERE id=@param0", [item_id]);
        if (!stockCheck.length) return res.status(404).json({ error: "Item not found" });

        const currentQty = stockCheck[0].quantity;

        if (transactionType === 'ISSUE') {
            if (currentQty < quantity) {
                return res.status(400).json({ error: "Not enough stock available" });
            }
            await queryDatabase("UPDATE Items SET quantity = quantity - @param0 WHERE id=@param1", [quantity, item_id]);
        } else if (transactionType === 'REPLENISH') {
            await queryDatabase("UPDATE Items SET quantity = quantity + @param0 WHERE id=@param1", [quantity, item_id]);
        } else {
            return res.status(400).json({ error: "Invalid transaction type" });
        }

        // Format date for SQL Server (replace 'T' with space)
        const formattedDate = issue_date ? issue_date.replace('T', ' ') : null;

        // Ensure type column exists (Basic migration check)
        try {
            await queryDatabase("IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Issues' AND COLUMN_NAME = 'type') BEGIN ALTER TABLE Issues ADD type NVARCHAR(20) DEFAULT 'ISSUE' WITH VALUES; END");
        } catch (migErr) {
            console.error("Migration warning:", migErr);
            // Continue, assuming column might exist or will fail on insert if critical
        }

        const insertQuery = formattedDate
            ? "INSERT INTO Issues (item_id, quantity, issued_to, sap_notification, note, issue_date, type) VALUES (@param0, @param1, @param2, @param3, @param4, @param5, @param6)"
            : "INSERT INTO Issues (item_id, quantity, issued_to, sap_notification, note, type) VALUES (@param0, @param1, @param2, @param3, @param4, @param5)";

        const params = [item_id, quantity, issued_to, sap_notification || "", note || ""];
        if (formattedDate) params.push(formattedDate);
        params.push(transactionType);

        await queryDatabase(insertQuery, params);

        res.status(201).json({ message: "Transaction successful" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Transaction failed" });
    }
});

app.delete("/api/issues/:id", async (req, res) => {
    const { id } = req.params;
    try {
        await queryDatabase("DELETE FROM Issues WHERE id=@param0", [id]);
        res.json({ message: "Issue record deleted" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to delete issue record" });
    }
});

app.put("/api/issues/:id", async (req, res) => {
    const { id } = req.params;
    const { quantity, issued_to, sap_notification, note, issue_date } = req.body;

    try {
        // 1. Get the old issue record
        const oldIssueResult = await queryDatabase("SELECT item_id, quantity FROM Issues WHERE id=@param0", [id]);
        if (!oldIssueResult.length) return res.status(404).json({ error: "Issue record not found" });

        const oldIssue = oldIssueResult[0];
        const newQty = parseFloat(quantity);
        const qtyDiff = oldIssue.quantity - newQty; // If newQty is larger, qtyDiff is negative

        // 2. Adjust Item quantity
        // New Item Qty = Current Item Qty + Old Issue Qty - New Issue Qty
        // Which is: Current Item Qty + qtyDiff
        await queryDatabase("UPDATE Items SET quantity = quantity + @param0 WHERE id=@param1", [qtyDiff, oldIssue.item_id]);

        // 3. Update Issue record
        const updateQuery = `
            UPDATE Issues 
            SET quantity = @param0, 
                issued_to = @param1, 
                sap_notification = @param2, 
                note = @param3, 
                issue_date = @param4 
            WHERE id = @param5`;

        const formattedDate = issue_date ? issue_date.replace('T', ' ') : null;
        await queryDatabase(updateQuery, [newQty, issued_to, sap_notification || "", note || "", formattedDate, id]);

        res.json({ message: "Issue record updated successfully" });
    } catch (err) {
        console.error("Update issue failed:", err);
        res.status(500).json({ error: "Failed to update issue record" });
    }
});


//--READ----

app.get("/api/items/locations", async (req, res) => {
    try {
        const locations = await queryDatabase("SELECT DISTINCT location FROM Items WHERE location IS NOT NULL AND location <> '' ORDER BY location");
        const results = locations.map(l => l.location);
        console.log("Locations found:", results.length);
        res.json(results);
    } catch (err) {
        console.error("Failed to fetch locations:", err);
        res.status(500).json({ error: "Failed to fetch locations" });
    }
});

app.get("/api/items/categories", async (req, res) => {
    try {
        const categories = await queryDatabase("SELECT DISTINCT category FROM Items WHERE category IS NOT NULL AND category <> '' ORDER BY category");
        const results = categories.map(c => c.category);
        console.log("Categories found:", results.length);
        res.json(results);
    } catch (err) {
        console.error("Failed to fetch categories:", err);
        res.status(500).json({ error: "Failed to fetch categories" });
    }
});

app.get("/api/items", async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const searchStr = req.query.search || "";
    const searchPattern = `%${searchStr}%`;
    const category = req.query.category && req.query.category !== "All" ? req.query.category : null;
    const location = req.query.location && req.query.location !== "All" ? req.query.location : null;
    const status = req.query.status && req.query.status !== "All" ? req.query.status : null;

    try {
        let whereClauses = ["(name LIKE @param0 OR location LIKE @param0 OR category LIKE @param0 OR make LIKE @param0 OR material_code LIKE @param0)"];
        let params = [searchPattern];

        if (category) {
            whereClauses.push("category = @param" + params.length);
            params.push(category);
        }

        if (location) {
            whereClauses.push("location = @param" + params.length);
            params.push(location);
        }

        if (status) {
            if (status === "out_of_stock") {
                whereClauses.push("quantity = 0");
            } else if (status === "low_stock") {
                whereClauses.push("quantity > 0 AND quantity <= ISNULL(min_quantity, 0)");
            } else if (status === "in_stock") {
                whereClauses.push("quantity > ISNULL(min_quantity, 0)");
            }
        }

        const whereSql = whereClauses.join(" AND ");
        const totalQuery = `SELECT COUNT(*) AS count FROM Items WHERE ${whereSql}`;
        const dataQuery = `SELECT * FROM Items WHERE ${whereSql} ORDER BY id DESC OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`;

        console.log("Fetching items with status:", status);
        const totalResult = await queryDatabase(totalQuery, params);
        const total = totalResult[0].count;
        const items = await queryDatabase(dataQuery, params);

        res.json({
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            data: items,
        });
    } catch (err) {
        console.error("Database read failed:", err);
        res.status(500).json({ error: "Database read failed" });
    }
});



//--CREATE---

app.post("/api/items", async (req, res) => {
    const { name, quantity, location, category, make, material_code, min_quantity } = req.body;

    if (!name || quantity === undefined || quantity < 0) {
        return res.status(400).json({ error: "Valid Name and Quantity are required" });
    }

    try {
        await queryDatabase(
            "INSERT INTO Items (name, quantity, location, category, make, material_code, min_quantity) VALUES (@param0,@param1,@param2,@param3,@param4,@param5,@param6)",
            [name, parseInt(quantity), location, category, make || "", material_code || "", parseInt(min_quantity) || 0]
        );
        res.status(201).json({ message: "Item added successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database insert failed" });
    }
});


//--UPDATE---

app.put("/api/items/:id", async (req, res) => {
    const { id } = req.params;
    const { name, quantity, location, category, make, material_code, min_quantity } = req.body;

    if (!name || quantity === undefined || quantity < 0) {
        return res.status(400).json({ error: "Valid Name and Quantity are required" });
    }

    try {
        await queryDatabase(
            "UPDATE Items SET name=@param0, quantity=@param1, location=@param2, category=@param3, make=@param4, material_code=@param5, min_quantity=@param6 WHERE id=@param7",
            [name, parseInt(quantity), location, category, make || "", material_code || "", parseInt(min_quantity) || 0, id]
        );
        res.json({ message: "Item updated" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Update failed" });
    }
});

//--DELETE---

app.delete("/api/items/:id", async (req, res) => {
    const { id } = req.params;
    try {
        await queryDatabase("DELETE FROM Items WHERE  id=@param0", [id]);
        res.json({ message: "Item deleted" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Delete failed" });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port http://0.0.0.0:${PORT}`);
});