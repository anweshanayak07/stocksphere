import React, { useState } from "react";
import './ItemList.css';

function ItemList({
    items, onDelete, onUpdate, onIssue, onReplenish, searchTerm, userRole,
    selectedCategory, selectedLocation, selectedStatus,
    uniqueCategories, uniqueLocations,
    onCategoryFilter, onLocationFilter, onStatusFilter
}) {
    const [editId, setEditId] = useState(null);
    const [editData, setEditData] = useState({
        name: "",
        make: "",
        material_code: "",
        quantity: "",
        location: "",
        category: "",
        min_quantity: ""
    });

    const highlightText = (text, searchTerm) => {
        if (!searchTerm || !text) return text || "";
        const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`(${escaped})`, "gi");
        return text.toString().replace(regex, "<mark>$1</mark>");
    };

    const handleEditChange = (e) => {
        const { name, value } = e.target;
        setEditData({ ...editData, [name]: value });
    };

    const startEdit = (item) => {
        setEditId(item.id);
        setEditData(item);
    };

    const saveEdit = () => {
        onUpdate(editData);
        setEditId(null);
    };

    const cancelEdit = () => {
        setEditId(null);
    };

    return (
        <div className="item-list">
            <table>
                <thead>
                    <tr>
                        <th>Item Name</th>
                        <th>Make</th>
                        <th>Material Code</th>
                        <th>Quantity</th>
                        {userRole === 'admin' && <th>Min Qty</th>}
                        <th>
                            <div className="status-header">
                                <span>Location</span>
                                <select
                                    className="status-filter"
                                    value={selectedLocation}
                                    onChange={(e) => onLocationFilter(e.target.value)}
                                >
                                    <option value="All">All Locations</option>
                                    {uniqueLocations.map(loc => (
                                        <option key={loc} value={loc}>{loc}</option>
                                    ))}
                                </select>
                            </div>
                        </th>
                        <th>
                            <div className="status-header">
                                <span>Category</span>
                                <select
                                    className="status-filter"
                                    value={selectedCategory}
                                    onChange={(e) => onCategoryFilter(e.target.value)}
                                >
                                    <option value="All">All Categories</option>
                                    {uniqueCategories.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                        </th>
                        <th>
                            <div className="status-header">
                                <span>Status</span>
                                <select
                                    className="status-filter"
                                    value={selectedStatus}
                                    onChange={(e) => onStatusFilter(e.target.value)}
                                >
                                    <option value="All">All</option>
                                    <option value="in_stock">In Stock</option>
                                    <option value="low_stock">Low Stock</option>
                                    <option value="out_of_stock">Out of Stock</option>
                                </select>
                            </div>
                        </th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {items.length === 0 ? (
                        <tr>
                            <td colSpan={userRole === 'admin' ? "9" : "8"} style={{ textAlign: "center" }}>No items found</td>
                        </tr>
                    ) : (
                        items.map((item) => editId === item.id ? (
                            <tr key={item.id}>
                                <td><input name="name" value={editData.name} onChange={handleEditChange} /></td>
                                <td><input name="make" value={editData.make} onChange={handleEditChange} /></td>
                                <td><input name="material_code" value={editData.material_code} onChange={handleEditChange} /></td>
                                <td><input name="quantity" type="number" value={editData.quantity} onChange={handleEditChange} /></td>
                                {userRole === 'admin' && <td><input name="min_quantity" type="number" value={editData.min_quantity} onChange={handleEditChange} /></td>}
                                <td><input name="location" value={editData.location} onChange={handleEditChange} /></td>
                                <td><input name="category" value={editData.category} onChange={handleEditChange} /></td>
                                <td>
                                    <button onClick={saveEdit}>Save</button>
                                    <button onClick={cancelEdit}>Cancel</button>
                                </td>
                            </tr>
                        ) : (
                            <tr key={item.id}>
                                <td dangerouslySetInnerHTML={{ __html: highlightText(item.name || "", searchTerm) }}></td>
                                <td dangerouslySetInnerHTML={{ __html: highlightText(item.make || "", searchTerm) }}></td>
                                <td dangerouslySetInnerHTML={{ __html: highlightText(item.material_code || "", searchTerm) }}></td>
                                <td className="qty-bubble" dangerouslySetInnerHTML={{ __html: highlightText(item.quantity?.toString() || "0", searchTerm) }}></td>
                                {userRole === 'admin' && <td dangerouslySetInnerHTML={{ __html: highlightText(item.min_quantity?.toString() || "0", searchTerm) }}></td>}
                                <td dangerouslySetInnerHTML={{ __html: highlightText(item.location || "", searchTerm) }}></td>
                                <td dangerouslySetInnerHTML={{ __html: highlightText(item.category || "", searchTerm) }}></td>
                                <td>
                                    {item.quantity === 0 ? (
                                        <span className="status-badge error">Out of Stock</span>
                                    ) : item.quantity <= item.min_quantity ? (
                                        <span className="status-badge warning">Low Stock</span>
                                    ) : (
                                        <span className="status-badge success">In Stock</span>
                                    )}
                                </td>
                                <td>
                                    {userRole === 'admin' && (
                                        <>
                                            <button className="btn-issue" onClick={() => onIssue(item)}>Issue</button>
                                            <button className="btn-replenish" onClick={() => onReplenish(item)}>Replenish</button>
                                            <button className="btn-edit" onClick={() => startEdit(item)}>Edit</button>
                                            <span className="action-divider">|</span>
                                            <button className="btn-delete" onClick={() => onDelete(item.id)}>Delete</button>
                                        </>
                                    )}
                                </td>
                            </tr>
                        )
                        )
                    )}
                </tbody>
            </table>
        </div>
    );
}

export default ItemList;
